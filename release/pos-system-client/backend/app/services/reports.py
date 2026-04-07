import csv
import io
import json
import re
import smtplib
import threading
import textwrap
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

from app.core.config import get_settings
from app.db.mysql import get_db
from app.services.sales import (
    _ensure_sales_tables,
    _normalize_user_id,
    _parse_datetime_filter,
    _serialize_datetime,
    get_sales_reports,
)
from app.services.stock import _decimal_to_float, _ensure_stock_tables

REPORT_TYPE_DEFINITIONS = {
    "DAILY_PROFIT": "Daily Profit",
    "DAILY_SALES_FULL": "Daily Sales Report (Full Sale Report)",
    "ITEM_WISE_SALES": "Item-wise Sales Report",
    "CATEGORY_WISE_SALES": "Category-wise Sales Report",
    "BILL_WISE": "Bill Wise Report",
    "CURRENT_STOCK": "Current Stock Report",
}
REPORT_FORMATS = {"CSV", "PDF"}
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
_report_tables_ready = False
_scheduler_thread = None
_scheduler_stop_event = threading.Event()


def _normalize_report_type(value: str | None):
    normalized_value = (value or "DAILY_SALES_FULL").strip().upper()
    return (
        normalized_value
        if normalized_value in REPORT_TYPE_DEFINITIONS
        else "DAILY_SALES_FULL"
    )


def _normalize_report_type_list(values):
    normalized_values = []
    seen_values = set()

    for value in values or []:
        normalized_value = _normalize_report_type(value)

        if normalized_value in seen_values:
            continue

        seen_values.add(normalized_value)
        normalized_values.append(normalized_value)

    return normalized_values


def _normalize_report_format(value: str | None):
    normalized_value = (value or "CSV").strip().upper()
    return normalized_value if normalized_value in REPORT_FORMATS else "CSV"


def _normalize_email_list(values):
    normalized_values = []
    seen_values = set()

    for value in values or []:
        normalized_value = str(value or "").strip()

        if not normalized_value:
            continue

        if not _EMAIL_PATTERN.match(normalized_value):
            continue

        lowered_value = normalized_value.lower()

        if lowered_value in seen_values:
            continue

        seen_values.add(lowered_value)
        normalized_values.append(normalized_value)

    return normalized_values


def _normalize_auto_send_time(value: str | None):
    normalized_value = str(value or "").strip()
    return normalized_value if _TIME_PATTERN.match(normalized_value) else "23:59"


def _get_env_mail_config_defaults():
    settings = get_settings()
    from_name, from_email = parseaddr(settings.email_from or "")
    smtp_from_email = from_email or (settings.email_user or "").strip()
    smtp_port = int(settings.email_port or 587)
    smtp_use_ssl = bool(settings.email_secure)

    return {
        "smtp_host": (settings.email_host or "").strip(),
        "smtp_port": smtp_port,
        "smtp_username": (settings.email_user or "").strip(),
        "smtp_password": settings.email_pass or "",
        "smtp_from_email": smtp_from_email,
        "smtp_from_name": from_name.strip(),
        "smtp_use_auth": bool((settings.email_user or "").strip()),
        "smtp_use_tls": not smtp_use_ssl and smtp_port == 587,
        "smtp_use_ssl": smtp_use_ssl,
    }


def _ensure_report_tables(db):
    global _report_tables_ready

    if _report_tables_ready:
        return

    cursor = db.cursor()

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS report_mail_config (
                id TINYINT PRIMARY KEY,
                smtp_host VARCHAR(255) NULL,
                smtp_port INT NOT NULL DEFAULT 587,
                smtp_username VARCHAR(255) NULL,
                smtp_password VARCHAR(500) NULL,
                smtp_from_email VARCHAR(255) NULL,
                smtp_from_name VARCHAR(255) NULL,
                smtp_use_auth TINYINT(1) NOT NULL DEFAULT 1,
                smtp_use_tls TINYINT(1) NOT NULL DEFAULT 1,
                smtp_use_ssl TINYINT(1) NOT NULL DEFAULT 0,
                default_recipients_json LONGTEXT NULL,
                auto_send_enabled TINYINT(1) NOT NULL DEFAULT 0,
                auto_send_time VARCHAR(5) NOT NULL DEFAULT '23:59',
                auto_report_type VARCHAR(50) NOT NULL DEFAULT 'DAILY_SALES_FULL',
                auto_report_types_json LONGTEXT NULL,
                auto_report_format VARCHAR(10) NOT NULL DEFAULT 'CSV',
                auto_recipients_json LONGTEXT NULL,
                last_auto_sent_at TIMESTAMP NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute("SHOW COLUMNS FROM report_mail_config")
        config_columns = {row[0] for row in cursor.fetchall()}

        if "smtp_port" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_port INT NOT NULL DEFAULT 587
                AFTER smtp_host
                """
            )

        if "smtp_username" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_username VARCHAR(255) NULL
                AFTER smtp_port
                """
            )

        if "smtp_password" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_password VARCHAR(500) NULL
                AFTER smtp_username
                """
            )

        if "smtp_from_email" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_from_email VARCHAR(255) NULL
                AFTER smtp_password
                """
            )

        if "smtp_from_name" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_from_name VARCHAR(255) NULL
                AFTER smtp_from_email
                """
            )

        if "smtp_use_auth" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_use_auth TINYINT(1) NOT NULL DEFAULT 1
                AFTER smtp_from_name
                """
            )

        if "smtp_use_tls" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_use_tls TINYINT(1) NOT NULL DEFAULT 1
                AFTER smtp_use_auth
                """
            )

        if "smtp_use_ssl" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN smtp_use_ssl TINYINT(1) NOT NULL DEFAULT 0
                AFTER smtp_use_tls
                """
            )

        if "default_recipients_json" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN default_recipients_json LONGTEXT NULL
                AFTER smtp_use_ssl
                """
            )

        if "auto_send_enabled" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN auto_send_enabled TINYINT(1) NOT NULL DEFAULT 0
                AFTER default_recipients_json
                """
            )

        if "auto_send_time" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN auto_send_time VARCHAR(5) NOT NULL DEFAULT '23:59'
                AFTER auto_send_enabled
                """
            )

        if "auto_report_type" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN auto_report_type VARCHAR(50) NOT NULL DEFAULT 'DAILY_SALES_FULL'
                AFTER auto_send_time
                """
            )

        if "auto_report_format" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN auto_report_format VARCHAR(10) NOT NULL DEFAULT 'CSV'
                AFTER auto_report_type
                """
            )

        if "auto_report_types_json" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN auto_report_types_json LONGTEXT NULL
                AFTER auto_report_type
                """
            )

        if "auto_recipients_json" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN auto_recipients_json LONGTEXT NULL
                AFTER auto_report_format
                """
            )

        if "last_auto_sent_at" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN last_auto_sent_at TIMESTAMP NULL
                AFTER auto_recipients_json
                """
            )

        if "updated_at" not in config_columns:
            cursor.execute(
                """
                ALTER TABLE report_mail_config
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
                AFTER last_auto_sent_at
                """
            )

        cursor.execute(
            """
            INSERT IGNORE INTO report_mail_config (
                id,
                smtp_port,
                smtp_use_auth,
                smtp_use_tls,
                smtp_use_ssl,
                default_recipients_json,
                auto_send_enabled,
                auto_send_time,
                auto_report_type,
                auto_report_types_json,
                auto_report_format,
                auto_recipients_json
            )
            VALUES (
                1,
                587,
                1,
                1,
                0,
                '[]',
                0,
                '23:59',
                'DAILY_SALES_FULL',
                '[\"DAILY_SALES_FULL\"]',
                'CSV',
                '[]'
            )
            """
        )

        db.commit()
        _report_tables_ready = True
    finally:
        cursor.close()


def _read_mail_config_row(cursor):
    cursor.execute("SELECT * FROM report_mail_config WHERE id=1")
    return cursor.fetchone()


def _parse_json_email_list(value):
    try:
        parsed_value = json.loads(value or "[]")
    except json.JSONDecodeError:
        parsed_value = []

    return _normalize_email_list(parsed_value if isinstance(parsed_value, list) else [])


def _parse_json_report_type_list(value):
    try:
        parsed_value = json.loads(value or "[]")
    except json.JSONDecodeError:
        parsed_value = []

    if not isinstance(parsed_value, list):
        parsed_value = []

    return _normalize_report_type_list(parsed_value)


def _serialize_mail_config_row(row):
    if not row:
        row = {}

    env_defaults = _get_env_mail_config_defaults()
    has_saved_smtp_values = any(
        str(row.get(key) or "").strip()
        for key in (
            "smtp_host",
            "smtp_username",
            "smtp_password",
            "smtp_from_email",
            "smtp_from_name",
        )
    )
    smtp_defaults = env_defaults if not has_saved_smtp_values else {}
    auto_report_types = _parse_json_report_type_list(row.get("auto_report_types_json"))

    if not auto_report_types:
        auto_report_types = [_normalize_report_type(row.get("auto_report_type"))]

    return {
        "smtp_host": row.get("smtp_host") or smtp_defaults.get("smtp_host") or "",
        "smtp_port": int(row.get("smtp_port") or smtp_defaults.get("smtp_port") or 587),
        "smtp_username": (
            row.get("smtp_username") or smtp_defaults.get("smtp_username") or ""
        ),
        "smtp_password": (
            row.get("smtp_password") or smtp_defaults.get("smtp_password") or ""
        ),
        "smtp_from_email": (
            row.get("smtp_from_email") or smtp_defaults.get("smtp_from_email") or ""
        ),
        "smtp_from_name": (
            row.get("smtp_from_name") or smtp_defaults.get("smtp_from_name") or ""
        ),
        "smtp_use_auth": bool(
            (
                row.get("smtp_use_auth")
                if has_saved_smtp_values
                else smtp_defaults.get("smtp_use_auth", row.get("smtp_use_auth", 1))
            )
        ),
        "smtp_use_tls": bool(
            (
                row.get("smtp_use_tls")
                if has_saved_smtp_values
                else smtp_defaults.get("smtp_use_tls", row.get("smtp_use_tls"))
            )
        ),
        "smtp_use_ssl": bool(
            (
                row.get("smtp_use_ssl")
                if has_saved_smtp_values
                else smtp_defaults.get("smtp_use_ssl", row.get("smtp_use_ssl"))
            )
        ),
        "default_recipients": _parse_json_email_list(row.get("default_recipients_json")),
        "auto_send_enabled": bool(row.get("auto_send_enabled")),
        "auto_send_time": row.get("auto_send_time") or "23:59",
        "auto_report_type": _normalize_report_type(row.get("auto_report_type")),
        "auto_report_types": auto_report_types,
        "auto_report_format": _normalize_report_format(row.get("auto_report_format")),
        "auto_recipients": _parse_json_email_list(row.get("auto_recipients_json")),
        "last_auto_sent_at": _serialize_datetime(row.get("last_auto_sent_at")),
        "updated_at": _serialize_datetime(row.get("updated_at")),
    }


def _serialize_mail_only_config(config):
    return {
        "smtp_host": config.get("smtp_host", ""),
        "smtp_port": int(config.get("smtp_port") or 587),
        "smtp_username": config.get("smtp_username", ""),
        "smtp_password": config.get("smtp_password", ""),
        "smtp_from_email": config.get("smtp_from_email", ""),
        "smtp_from_name": config.get("smtp_from_name", ""),
        "smtp_use_auth": bool(config.get("smtp_use_auth", True)),
        "smtp_use_tls": bool(config.get("smtp_use_tls", True)),
        "smtp_use_ssl": bool(config.get("smtp_use_ssl", False)),
        "default_recipients": _normalize_email_list(
            config.get("default_recipients", []),
        ),
        "updated_at": config.get("updated_at"),
    }


def _serialize_auto_report_config(config):
    auto_report_types = _normalize_report_type_list(config.get("auto_report_types"))

    if not auto_report_types:
        auto_report_types = [_normalize_report_type(config.get("auto_report_type"))]

    return {
        "default_recipients": _normalize_email_list(
            config.get("default_recipients", []),
        ),
        "auto_send_enabled": bool(config.get("auto_send_enabled")),
        "auto_send_time": _normalize_auto_send_time(config.get("auto_send_time")),
        "auto_report_type": _normalize_report_type(config.get("auto_report_type")),
        "auto_report_types": auto_report_types,
        "auto_report_format": _normalize_report_format(config.get("auto_report_format")),
        "auto_recipients": _normalize_email_list(config.get("auto_recipients", [])),
        "last_auto_sent_at": config.get("last_auto_sent_at"),
        "updated_at": config.get("updated_at"),
    }


def get_report_mail_config():
    db = get_db()
    _ensure_report_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        return _serialize_mail_config_row(_read_mail_config_row(cursor))
    finally:
        cursor.close()
        db.close()


def get_mail_config():
    return _serialize_mail_only_config(get_report_mail_config())


def get_auto_report_config():
    return _serialize_auto_report_config(get_report_mail_config())


def save_report_mail_config(payload):
    db = get_db()
    _ensure_report_tables(db)
    cursor = db.cursor()

    try:
        smtp_host = payload.smtp_host.strip()
        smtp_port = int(payload.smtp_port or 587)
        smtp_username = payload.smtp_username.strip()
        smtp_password = payload.smtp_password
        smtp_from_email = payload.smtp_from_email.strip()
        smtp_from_name = payload.smtp_from_name.strip()
        smtp_use_auth = bool(payload.smtp_use_auth)
        smtp_use_ssl = bool(payload.smtp_use_ssl)
        smtp_use_tls = bool(payload.smtp_use_tls) if not smtp_use_ssl else False
        default_recipients = _normalize_email_list(payload.default_recipients)
        auto_recipients = _normalize_email_list(payload.auto_recipients)
        auto_send_time = _normalize_auto_send_time(payload.auto_send_time)
        auto_report_type = _normalize_report_type(payload.auto_report_type)
        auto_report_types = _normalize_report_type_list(payload.auto_report_types)
        if not auto_report_types:
            auto_report_types = [auto_report_type]
        auto_report_type = auto_report_types[0]
        auto_report_format = _normalize_report_format(payload.auto_report_format)

        if smtp_port <= 0:
            return {"error": "Enter a valid SMTP port"}

        if smtp_from_email and not _EMAIL_PATTERN.match(smtp_from_email):
            return {"error": "Enter a valid sender email"}

        cursor.execute(
            """
            UPDATE report_mail_config
            SET
                smtp_host=%s,
                smtp_port=%s,
                smtp_username=%s,
                smtp_password=%s,
                smtp_from_email=%s,
                smtp_from_name=%s,
                smtp_use_auth=%s,
                smtp_use_tls=%s,
                smtp_use_ssl=%s,
                default_recipients_json=%s,
                auto_send_enabled=%s,
                auto_send_time=%s,
                auto_report_type=%s,
                auto_report_types_json=%s,
                auto_report_format=%s,
                auto_recipients_json=%s
            WHERE id=1
            """,
            (
                smtp_host or None,
                smtp_port,
                smtp_username or None,
                smtp_password or None,
                smtp_from_email or None,
                smtp_from_name or None,
                1 if smtp_use_auth else 0,
                1 if smtp_use_tls else 0,
                1 if smtp_use_ssl else 0,
                json.dumps(default_recipients),
                1 if payload.auto_send_enabled else 0,
                auto_send_time,
                auto_report_type,
                json.dumps(auto_report_types),
                auto_report_format,
                json.dumps(auto_recipients),
            ),
        )
        db.commit()
        cursor.close()
        cursor = db.cursor(dictionary=True)
        return _serialize_mail_config_row(_read_mail_config_row(cursor))
    finally:
        cursor.close()
        db.close()


def save_mail_config(payload):
    db = get_db()
    _ensure_report_tables(db)
    cursor = db.cursor()

    try:
        smtp_host = payload.smtp_host.strip()
        smtp_port = int(payload.smtp_port or 587)
        smtp_username = payload.smtp_username.strip()
        smtp_password = payload.smtp_password
        smtp_from_email = payload.smtp_from_email.strip()
        smtp_from_name = payload.smtp_from_name.strip()
        smtp_use_auth = bool(payload.smtp_use_auth)
        smtp_use_ssl = bool(payload.smtp_use_ssl)
        smtp_use_tls = bool(payload.smtp_use_tls) if not smtp_use_ssl else False
        default_recipients = _normalize_email_list(payload.default_recipients)

        if smtp_port <= 0:
            return {"error": "Enter a valid SMTP port"}

        if smtp_from_email and not _EMAIL_PATTERN.match(smtp_from_email):
            return {"error": "Enter a valid sender email"}

        cursor.execute(
            """
            UPDATE report_mail_config
            SET
                smtp_host=%s,
                smtp_port=%s,
                smtp_username=%s,
                smtp_password=%s,
                smtp_from_email=%s,
                smtp_from_name=%s,
                smtp_use_auth=%s,
                smtp_use_tls=%s,
                smtp_use_ssl=%s,
                default_recipients_json=%s
            WHERE id=1
            """,
            (
                smtp_host or None,
                smtp_port,
                smtp_username or None,
                smtp_password or None,
                smtp_from_email or None,
                smtp_from_name or None,
                1 if smtp_use_auth else 0,
                1 if smtp_use_tls else 0,
                1 if smtp_use_ssl else 0,
                json.dumps(default_recipients),
            ),
        )
        db.commit()
        cursor.close()
        cursor = db.cursor(dictionary=True)
        return _serialize_mail_only_config(
            _serialize_mail_config_row(_read_mail_config_row(cursor)),
        )
    finally:
        cursor.close()
        db.close()


def save_auto_report_config(payload):
    db = get_db()
    _ensure_report_tables(db)
    cursor = db.cursor()

    try:
        auto_send_time = _normalize_auto_send_time(payload.auto_send_time)
        auto_report_type = _normalize_report_type(payload.auto_report_type)
        auto_report_types = _normalize_report_type_list(payload.auto_report_types)

        if not auto_report_types:
            return {"error": "Select at least one automatic report"}

        auto_report_type = auto_report_types[0]
        auto_report_format = _normalize_report_format(payload.auto_report_format)
        auto_recipients = _normalize_email_list(payload.auto_recipients)

        cursor.execute(
            """
            UPDATE report_mail_config
            SET
                auto_send_enabled=%s,
                auto_send_time=%s,
                auto_report_type=%s,
                auto_report_types_json=%s,
                auto_report_format=%s,
                auto_recipients_json=%s
            WHERE id=1
            """,
            (
                1 if payload.auto_send_enabled else 0,
                auto_send_time,
                auto_report_type,
                json.dumps(auto_report_types),
                auto_report_format,
                json.dumps(auto_recipients),
            ),
        )
        db.commit()
        cursor.close()
        cursor = db.cursor(dictionary=True)
        return _serialize_auto_report_config(
            _serialize_mail_config_row(_read_mail_config_row(cursor)),
        )
    finally:
        cursor.close()
        db.close()


def _build_report_filter_params(date_from, date_to, table_id, category_id, product_id):
    return {
        "date_from": date_from,
        "date_to": date_to,
        "table_id": _normalize_user_id(table_id),
        "category_id": _normalize_user_id(category_id),
        "product_id": _normalize_user_id(product_id),
    }


def _get_profit_report(
    date_from=None,
    date_to=None,
    table_id=None,
    category_id=None,
    product_id=None,
):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        parsed_date_from = _parse_datetime_filter(date_from)
        parsed_date_to = _parse_datetime_filter(date_to)
        normalized_table_id = _normalize_user_id(table_id)
        normalized_category_id = _normalize_user_id(category_id)
        normalized_product_id = _normalize_user_id(product_id)
        filters = ["b.is_deleted = 0"]
        params = []

        if parsed_date_from is not None:
            filters.append("b.created_at >= %s")
            params.append(parsed_date_from.strftime("%Y-%m-%d %H:%M:%S"))

        if parsed_date_to is not None:
            filters.append("b.created_at <= %s")
            params.append(parsed_date_to.strftime("%Y-%m-%d %H:%M:%S"))

        if normalized_table_id is not None:
            filters.append("b.table_id = %s")
            params.append(normalized_table_id)

        if normalized_category_id is not None:
            filters.append("c.id = %s")
            params.append(normalized_category_id)

        if normalized_product_id is not None:
            filters.append("bi.product_id = %s")
            params.append(normalized_product_id)

        where_clause = " AND ".join(filters)
        base_query = f"""
            FROM sale_bill_items bi
            JOIN sale_bills b ON b.id = bi.bill_id
            LEFT JOIN stock_products p ON p.id = bi.product_id
            LEFT JOIN stock_categories c ON c.id = p.category_id
            WHERE {where_clause}
        """

        cursor.execute(
            f"""
            SELECT
                COUNT(DISTINCT bi.bill_id) AS total_bills,
                COALESCE(SUM(bi.qty), 0) AS total_units,
                COALESCE(SUM(bi.line_total), 0) AS total_sales,
                COALESCE(SUM(COALESCE(bi.cost_price, p.cost_price, 0) * bi.qty), 0) AS total_cost
            {base_query}
            """,
            tuple(params),
        )
        summary_row = cursor.fetchone() or {}
        total_sales = round(_decimal_to_float(summary_row.get("total_sales")) or 0, 2)
        total_cost = round(_decimal_to_float(summary_row.get("total_cost")) or 0, 2)
        total_profit = round(total_sales - total_cost, 2)

        cursor.execute(
            f"""
            SELECT
                bi.product_id,
                COALESCE(p.name, bi.item_name) AS item_name,
                COALESCE(c.name, 'Uncategorized') AS category_name,
                COALESCE(SUM(bi.qty), 0) AS total_qty,
                COALESCE(SUM(bi.line_total), 0) AS total_sales,
                COALESCE(SUM(COALESCE(bi.cost_price, p.cost_price, 0) * bi.qty), 0) AS total_cost
            {base_query}
            GROUP BY bi.product_id, p.name, bi.item_name, c.name
            ORDER BY total_sales DESC, item_name ASC
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

        return {
            "summary": {
                "total_bills": int(summary_row.get("total_bills") or 0),
                "total_units": int(summary_row.get("total_units") or 0),
                "total_sales": total_sales,
                "total_cost": total_cost,
                "total_profit": total_profit,
                "profit_margin_pct": round((total_profit / total_sales) * 100, 2)
                if total_sales
                else 0,
            },
            "rows": [
                {
                    "product_id": row["product_id"],
                    "item_name": row["item_name"],
                    "category_name": row["category_name"],
                    "total_qty": int(row["total_qty"] or 0),
                    "total_sales": round(_decimal_to_float(row["total_sales"]) or 0, 2),
                    "total_cost": round(_decimal_to_float(row["total_cost"]) or 0, 2),
                    "total_profit": round(
                        (round(_decimal_to_float(row["total_sales"]) or 0, 2))
                        - (round(_decimal_to_float(row["total_cost"]) or 0, 2)),
                        2,
                    ),
                }
                for row in rows
            ],
        }
    finally:
        cursor.close()
        db.close()


def get_report_dashboard(
    date_from=None,
    date_to=None,
    table_id=None,
    category_id=None,
    product_id=None,
):
    filters = _build_report_filter_params(
        date_from,
        date_to,
        table_id,
        category_id,
        product_id,
    )
    sales_report = get_sales_reports(**filters)
    profit_report = _get_profit_report(**filters)

    return {
        "filters": sales_report.get("filters") or {},
        "available_reports": [
            {"key": key, "label": label}
            for key, label in REPORT_TYPE_DEFINITIONS.items()
        ],
        "daily_profit": profit_report,
        "daily_sales_full": {
            "summary": sales_report.get("summary") or {},
            "item_wise_sales": sales_report.get("item_wise_sales") or [],
            "category_wise_sales": sales_report.get("category_wise_sales") or [],
            "bill_wise_sales": sales_report.get("bill_wise_sales") or [],
            "daily_expenses": sales_report.get("daily_expenses") or [],
        },
        "item_wise_sales": sales_report.get("item_wise_sales") or [],
        "category_wise_sales": sales_report.get("category_wise_sales") or [],
        "bill_wise_sales": sales_report.get("bill_wise_sales") or [],
        "current_stock_report": sales_report.get("current_stock_report") or [],
    }


def _format_money(value):
    return f"{float(value or 0):.2f}"


def _format_quantity(value):
    return f"{float(value or 0):.3f}".rstrip("0").rstrip(".") or "0"


def _format_display_datetime(value):
    if not value:
        return "-"
    return str(value)


def _build_report_document(
    report_type,
    date_from=None,
    date_to=None,
    table_id=None,
    category_id=None,
    product_id=None,
):
    normalized_report_type = _normalize_report_type(report_type)
    dashboard = get_report_dashboard(
        date_from,
        date_to,
        table_id,
        category_id,
        product_id,
    )
    filters = dashboard.get("filters") or {}
    title = REPORT_TYPE_DEFINITIONS[normalized_report_type]
    sales_summary = dashboard.get("daily_sales_full", {}).get("summary") or {}
    sections = []
    highlights = []
    show_filtered_bill_total = bool(filters.get("category_id") or filters.get("product_id"))

    def make_section(
        section_title,
        headers,
        rows,
        footer=None,
        column_widths=None,
        alignments=None,
        empty_message="No data available for the selected filters.",
    ):
        return {
            "title": section_title,
            "headers": headers,
            "rows": rows,
            "footer": footer,
            "column_widths": column_widths or [1] * len(headers),
            "alignments": alignments or ["left"] * len(headers),
            "empty_message": empty_message,
        }

    if normalized_report_type == "DAILY_PROFIT":
        summary = dashboard["daily_profit"]["summary"]
        highlights = [
            {"label": "Total Bills", "value": str(summary.get("total_bills") or 0)},
            {"label": "Units Sold", "value": _format_quantity(summary.get("total_units"))},
            {"label": "Sales", "value": _format_money(summary.get("total_sales"))},
            {"label": "Cost", "value": _format_money(summary.get("total_cost"))},
            {"label": "Profit", "value": _format_money(summary.get("total_profit"))},
            {
                "label": "Margin %",
                "value": f"{float(summary.get('profit_margin_pct') or 0):.2f}%",
            },
        ]
        sections.append(
            make_section(
                "Item Profitability",
                ["Item", "Category", "Qty", "Sales", "Cost", "Profit"],
                [
                    [
                        row["item_name"],
                        row["category_name"],
                        _format_quantity(row["total_qty"]),
                        _format_money(row["total_sales"]),
                        _format_money(row["total_cost"]),
                        _format_money(row["total_profit"]),
                    ]
                    for row in dashboard["daily_profit"]["rows"]
                ],
                footer=[
                    "Total",
                    "",
                    _format_quantity(summary.get("total_units")),
                    _format_money(summary.get("total_sales")),
                    _format_money(summary.get("total_cost")),
                    _format_money(summary.get("total_profit")),
                ],
                column_widths=[3.2, 2.1, 0.9, 1.2, 1.2, 1.2],
                alignments=["left", "left", "right", "right", "right", "right"],
                empty_message="No profitability rows for the selected period.",
            )
        )
    elif normalized_report_type == "DAILY_SALES_FULL":
        highlights = [
            {"label": "Total Sales", "value": _format_money(sales_summary.get("total_sales"))},
            {"label": "UPI", "value": _format_money(sales_summary.get("total_upi_paid"))},
            {"label": "Card", "value": _format_money(sales_summary.get("total_card_paid"))},
            {
                "label": "Cash",
                "value": _format_money(sales_summary.get("total_cash_paid")),
            },
            {
                "label": "Expense",
                "value": _format_money(sales_summary.get("total_expense")),
            },
        ]
        sections.extend(
            [
                make_section(
                    "Item-wise Sales",
                    ["Item", "Category", "Qty", "Sales"],
                    [
                        [
                            row["item_name"],
                            row["category_name"],
                            _format_quantity(row["total_qty"]),
                            _format_money(row["total_sales"]),
                        ]
                        for row in dashboard["daily_sales_full"]["item_wise_sales"]
                    ],
                    footer=[
                        "Total",
                        "",
                        _format_quantity(sales_summary.get("total_units")),
                        _format_money(sales_summary.get("total_sales")),
                    ],
                    column_widths=[3.1, 2.1, 1.0, 1.2],
                    alignments=["left", "left", "right", "right"],
                    empty_message="No item-wise sales rows for the selected period.",
                ),
                make_section(
                    "Category-wise Sales",
                    ["Category", "Qty", "Sales"],
                    [
                        [
                            row["category_name"],
                            _format_quantity(row["total_qty"]),
                            _format_money(row["total_sales"]),
                        ]
                        for row in dashboard["daily_sales_full"]["category_wise_sales"]
                    ],
                    footer=[
                        "Total",
                        _format_quantity(sales_summary.get("total_units")),
                        _format_money(sales_summary.get("total_sales")),
                    ],
                    column_widths=[3.6, 1.1, 1.3],
                    alignments=["left", "right", "right"],
                    empty_message="No category-wise sales rows for the selected period.",
                ),
                _build_bill_wise_section(
                    dashboard["daily_sales_full"]["bill_wise_sales"],
                    sales_summary,
                    show_filtered_bill_total,
                ),
                make_section(
                    "Daily Expenses",
                    ["Date and Time", "Details", "Amount", "Saved By"],
                    [
                        [
                            _format_display_datetime(row["expense_at"]),
                            row["details"],
                            _format_money(row["amount"]),
                            row["created_by_username"] or "-",
                        ]
                        for row in dashboard["daily_sales_full"]["daily_expenses"]
                    ],
                    footer=[
                        "",
                        "Total Expense",
                        _format_money(sales_summary.get("total_expense")),
                        f"Entries: {sales_summary.get('expense_count') or 0}",
                    ],
                    column_widths=[1.8, 3.8, 1.1, 1.4],
                    alignments=["left", "left", "right", "left"],
                    empty_message="No expense entries for the selected period.",
                ),
            ]
        )
    elif normalized_report_type == "ITEM_WISE_SALES":
        highlights = [
            {"label": "Unique Items", "value": str(len(dashboard["item_wise_sales"]))},
            {"label": "Units Sold", "value": _format_quantity(sales_summary.get("total_units"))},
            {"label": "Total Sales", "value": _format_money(sales_summary.get("total_sales"))},
            {
                "label": "Average Bill Value",
                "value": _format_money(sales_summary.get("average_bill_value")),
            },
        ]
        sections.append(
            make_section(
                "Item-wise Sales",
                ["Item", "Category", "Qty", "Sales"],
                [
                    [
                        row["item_name"],
                        row["category_name"],
                        _format_quantity(row["total_qty"]),
                        _format_money(row["total_sales"]),
                    ]
                    for row in dashboard["item_wise_sales"]
                ],
                footer=[
                    "Total",
                    "",
                    _format_quantity(sales_summary.get("total_units")),
                    _format_money(sales_summary.get("total_sales")),
                ],
                column_widths=[3.1, 2.1, 1.0, 1.2],
                alignments=["left", "left", "right", "right"],
                empty_message="No item-wise sales rows for the selected period.",
            )
        )
    elif normalized_report_type == "CATEGORY_WISE_SALES":
        highlights = [
            {"label": "Categories", "value": str(len(dashboard["category_wise_sales"]))},
            {"label": "Units Sold", "value": _format_quantity(sales_summary.get("total_units"))},
            {"label": "Total Sales", "value": _format_money(sales_summary.get("total_sales"))},
            {
                "label": "Average Bill Value",
                "value": _format_money(sales_summary.get("average_bill_value")),
            },
        ]
        sections.append(
            make_section(
                "Category-wise Sales",
                ["Category", "Qty", "Sales"],
                [
                    [
                        row["category_name"],
                        _format_quantity(row["total_qty"]),
                        _format_money(row["total_sales"]),
                    ]
                    for row in dashboard["category_wise_sales"]
                ],
                footer=[
                    "Total",
                    _format_quantity(sales_summary.get("total_units")),
                    _format_money(sales_summary.get("total_sales")),
                ],
                column_widths=[3.6, 1.1, 1.3],
                alignments=["left", "right", "right"],
                empty_message="No category-wise sales rows for the selected period.",
            )
        )
    elif normalized_report_type == "BILL_WISE":
        highlights = [
            {"label": "Total Bills", "value": str(sales_summary.get("total_bills") or 0)},
            {"label": "Units Sold", "value": _format_quantity(sales_summary.get("total_units"))},
            {"label": "Total Sales", "value": _format_money(sales_summary.get("total_sales"))},
            {
                "label": "Average Bill Value",
                "value": _format_money(sales_summary.get("average_bill_value")),
            },
        ]
        sections.append(
            _build_bill_wise_section(
                dashboard["bill_wise_sales"],
                sales_summary,
                show_filtered_bill_total,
            )
        )
    else:
        stock_rows = dashboard["current_stock_report"]
        total_stock_qty = sum(float(row.get("current_stock_qty") or 0) for row in stock_rows)
        total_stock_value = sum(float(row.get("stock_value") or 0) for row in stock_rows)
        negative_stock_count = sum(
            1 for row in stock_rows if float(row.get("current_stock_qty") or 0) < 0
        )
        highlights = [
            {"label": "Tracked Items", "value": str(len(stock_rows))},
            {"label": "Stock Qty", "value": _format_quantity(total_stock_qty)},
            {"label": "Stock Value", "value": _format_money(total_stock_value)},
            {"label": "Negative Items", "value": str(negative_stock_count)},
        ]
        sections.append(
            make_section(
                "Current Stock",
                ["Item", "Category", "Stock Qty", "Sale Price", "Stock Value", "Status"],
                [
                    [
                        row["item_name"],
                        row["category_name"],
                        _format_quantity(row["current_stock_qty"]),
                        _format_money(row["sale_price"]),
                        _format_money(row["stock_value"]),
                        (
                            "Negative"
                            if float(row.get("current_stock_qty") or 0) < 0
                            else "Out of Stock"
                            if float(row.get("current_stock_qty") or 0) == 0
                            else "Available"
                        ),
                    ]
                    for row in stock_rows
                ],
                footer=[
                    "Total",
                    "",
                    _format_quantity(total_stock_qty),
                    "",
                    _format_money(total_stock_value),
                    f"Negative: {negative_stock_count}",
                ],
                column_widths=[3.0, 2.0, 1.0, 1.1, 1.2, 1.2],
                alignments=["left", "left", "right", "right", "right", "left"],
                empty_message="No stock rows available for the selected filters.",
            )
        )

    return {
        "title": title,
        "report_type": normalized_report_type,
        "filters": filters,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "highlights": highlights,
        "sections": sections,
    }


def _build_bill_wise_section(rows, sales_summary, show_filtered_bill_total):
    headers = ["Bill", "Date and Time", "Table", "Payment", "Qty"]
    column_widths = [1.4, 1.8, 2.1, 1.1, 0.8]
    alignments = ["left", "left", "left", "left", "right"]

    if show_filtered_bill_total:
        headers.extend(["Filtered Total", "Bill Total"])
        column_widths.extend([1.1, 1.1])
        alignments.extend(["right", "right"])
    else:
        headers.append("Total")
        column_widths.append(1.2)
        alignments.append("right")

    return {
        "title": "Bill-wise Sales",
        "headers": headers,
        "rows": [
            [
                row["bill_number"],
                _format_display_datetime(row["created_at"]),
                " - ".join(
                    [value for value in [row["floor_name"], row["table_name"]] if value]
                )
                or "-",
                row["payment_method"],
                _format_quantity(row["total_qty"]),
                *(
                    [
                        _format_money(row["matched_total"]),
                        _format_money(row["bill_total"]),
                    ]
                    if show_filtered_bill_total
                    else [_format_money(row["bill_total"])]
                ),
            ]
            for row in rows
        ],
        "footer": [
            f"Total Bills: {sales_summary.get('total_bills') or 0}",
            "",
            "",
            "",
            _format_quantity(sales_summary.get("total_units")),
            *(
                [
                    _format_money(sum(float(row.get("matched_total") or 0) for row in rows)),
                    _format_money(sum(float(row.get("bill_total") or 0) for row in rows)),
                ]
                if show_filtered_bill_total
                else [_format_money(sales_summary.get("total_sales"))]
            ),
        ],
        "column_widths": column_widths,
        "alignments": alignments,
        "empty_message": "No bill-wise sales rows for the selected period.",
    }


def _safe_filename_part(value: str):
    normalized_value = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return normalized_value or "report"


def _build_filter_text(document):
    filters = document.get("filters") or {}
    return " | ".join(
        [
            (
                f"Date Range: {(filters.get('date_from') or 'Start of period')} "
                f"to {(filters.get('date_to') or 'Now')}"
            ),
            (
                f"Table: {'Table #' + str(filters['table_id']) if filters.get('table_id') else 'All Tables'}"
            ),
            (
                f"Category: {'Category #' + str(filters['category_id']) if filters.get('category_id') else 'All Categories'}"
            ),
            (
                f"Item: {'Item #' + str(filters['product_id']) if filters.get('product_id') else 'All Items'}"
            ),
        ]
    )


def _build_report_filename(document, report_format):
    extension = "csv" if report_format == "CSV" else "pdf"
    return (
        f"{_safe_filename_part(document['title'])}_"
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    )


def _build_csv_bytes(document):
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow([document["title"]])
    writer.writerow([])
    writer.writerow(["Report Details"])
    writer.writerow(["Generated At", document["generated_at"]])
    writer.writerow(["Filters", _build_filter_text(document)])

    if document.get("highlights"):
        writer.writerow([])
        writer.writerow(["Key Highlights"])
        writer.writerow(["Metric", "Value"])
        writer.writerows(
            [[highlight["label"], highlight["value"]] for highlight in document["highlights"]]
        )

    for section in document["sections"]:
        writer.writerow([])
        writer.writerow([section["title"]])

        if section["rows"]:
            writer.writerow([f"Rows: {len(section['rows'])}"])
            writer.writerow(section["headers"])
            writer.writerows(section["rows"])

            if section.get("footer"):
                writer.writerow(section["footer"])
        else:
            writer.writerow([section.get("empty_message") or "No data"])

    return ("\ufeff" + buffer.getvalue()).encode("utf-8")


def _wrap_pdf_text(value: str, width: float, font_size: float):
    estimated_char_width = max(font_size * 0.52, 1)
    max_chars = max(int(width / estimated_char_width), 1)
    wrapped_lines = textwrap.wrap(
        str(value or ""),
        width=max_chars,
        break_long_words=False,
        break_on_hyphens=False,
        replace_whitespace=False,
        drop_whitespace=False,
    )
    return wrapped_lines or [str(value or "")]


def _escape_pdf_text(value: str):
    return (
        str(value or "")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def _estimate_pdf_text_width(text: str, font_size: float):
    return len(str(text or "")) * font_size * 0.52


def _normalize_pdf_widths(widths, count):
    if not widths or len(widths) != count:
        return [1 / count] * count

    total = sum(float(width or 0) for width in widths) or count
    return [(float(width or 0) / total) for width in widths]


def _pdf_color_command(command, color):
    red, green, blue = color
    return f"{red:.3f} {green:.3f} {blue:.3f} {command}"


def _pdf_draw_rect(commands, x, y, width, height, fill_color=None, stroke_color=None, line_width=1):
    commands.append("q")
    commands.append(f"{line_width:.2f} w")

    if fill_color is not None:
        commands.append(_pdf_color_command("rg", fill_color))

    if stroke_color is not None:
        commands.append(_pdf_color_command("RG", stroke_color))

    commands.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re")

    if fill_color is not None and stroke_color is not None:
        commands.append("B")
    elif fill_color is not None:
        commands.append("f")
    else:
        commands.append("S")

    commands.append("Q")


def _pdf_draw_text(commands, x, y, text, font="F1", size=10, color=(0.1, 0.16, 0.25), align="left"):
    safe_text = _escape_pdf_text(text)
    text_width = _estimate_pdf_text_width(safe_text, size)
    draw_x = x - text_width if align == "right" else x

    commands.extend(
        [
            "BT",
            f"/{font} {size:.2f} Tf",
            _pdf_color_command("rg", color),
            f"1 0 0 1 {draw_x:.2f} {y:.2f} Tm",
            f"({safe_text}) Tj",
            "ET",
        ]
    )


def _build_simple_pdf(document):
    page_width = 842
    page_height = 595
    margin_x = 30
    top_margin = 28
    bottom_margin = 26
    usable_width = page_width - (margin_x * 2)
    row_padding = 5
    row_font_size = 9
    row_line_height = 11
    section_gap = 12
    pages = []
    commands = []
    current_y = page_height - top_margin
    page_number = 0

    def start_page(include_highlights=False):
        nonlocal commands, current_y, page_number

        if commands:
            pages.append(commands)

        commands = []
        page_number += 1
        current_y = page_height - top_margin

        _pdf_draw_rect(commands, 0, page_height - 8, page_width, 8, fill_color=(0.16, 0.47, 0.86))
        _pdf_draw_text(commands, margin_x, page_height - 34, document["title"], font="F2", size=18, color=(0.06, 0.1, 0.18))
        _pdf_draw_text(commands, page_width - margin_x, page_height - 32, f"Page {page_number}", font="F1", size=9, color=(0.38, 0.45, 0.57), align="right")
        _pdf_draw_text(commands, margin_x, page_height - 52, f"Generated At: {document['generated_at']}", font="F1", size=9, color=(0.38, 0.45, 0.57))
        _pdf_draw_text(commands, margin_x, page_height - 66, _build_filter_text(document), font="F1", size=9, color=(0.38, 0.45, 0.57))
        commands.append("q")
        commands.append(_pdf_color_command("RG", (0.87, 0.9, 0.95)))
        commands.append("1 w")
        commands.append(f"{margin_x:.2f} {page_height - 78:.2f} m {page_width - margin_x:.2f} {page_height - 78:.2f} l S")
        commands.append("Q")
        current_y = page_height - 96

        if include_highlights and document.get("highlights"):
            cards_per_row = min(3, max(len(document["highlights"]), 1))
            card_gap = 10
            card_width = (usable_width - (card_gap * (cards_per_row - 1))) / cards_per_row
            card_height = 44

            for index, highlight in enumerate(document["highlights"]):
                row_index = index // cards_per_row
                col_index = index % cards_per_row
                card_x = margin_x + ((card_width + card_gap) * col_index)
                card_y = current_y - (row_index * (card_height + 10)) - card_height

                _pdf_draw_rect(commands, card_x, card_y, card_width, card_height, fill_color=(0.96, 0.98, 1.0), stroke_color=(0.86, 0.9, 0.95))
                _pdf_draw_text(commands, card_x + 10, card_y + card_height - 15, highlight["label"], font="F1", size=8, color=(0.38, 0.45, 0.57))
                _pdf_draw_text(commands, card_x + 10, card_y + 12, highlight["value"], font="F2", size=13, color=(0.06, 0.1, 0.18))

            rows_used = ((len(document["highlights"]) - 1) // cards_per_row) + 1
            current_y -= rows_used * (card_height + 10)
            current_y -= 6

    def ensure_space(required_height):
        if current_y - required_height < bottom_margin:
            start_page()

    def draw_section_title(section_title, continued=False):
        nonlocal current_y
        ensure_space(28)
        _pdf_draw_rect(commands, margin_x, current_y - 22, usable_width, 20, fill_color=(0.93, 0.96, 0.99), stroke_color=(0.86, 0.9, 0.95))
        _pdf_draw_text(commands, margin_x + 10, current_y - 16, f"{section_title}{' (continued)' if continued else ''}", font="F2", size=10, color=(0.09, 0.24, 0.45))
        current_y -= 28

    def draw_table_header(section):
        nonlocal current_y
        normalized_widths = _normalize_pdf_widths(section.get("column_widths"), len(section["headers"]))
        column_widths = [usable_width * width for width in normalized_widths]
        header_height = 22
        ensure_space(header_height + 6)
        row_bottom = current_y - header_height
        cell_x = margin_x

        for header, cell_width in zip(section["headers"], column_widths, strict=False):
            _pdf_draw_rect(commands, cell_x, row_bottom, cell_width, header_height, fill_color=(0.16, 0.47, 0.86), stroke_color=(0.16, 0.47, 0.86))
            _pdf_draw_text(commands, cell_x + row_padding, row_bottom + 7, header, font="F2", size=9, color=(1, 1, 1))
            cell_x += cell_width

        current_y = row_bottom

    def draw_table_row(section, cells, row_index=0, footer=False):
        nonlocal current_y
        normalized_widths = _normalize_pdf_widths(section.get("column_widths"), len(section["headers"]))
        column_widths = [usable_width * width for width in normalized_widths]
        alignments = section.get("alignments") or ["left"] * len(section["headers"])
        wrapped_cells = [
            _wrap_pdf_text(cell, max(cell_width - (row_padding * 2), 12), row_font_size)
            for cell, cell_width in zip(cells, column_widths, strict=False)
        ]
        row_height = (max(len(lines) for lines in wrapped_cells) * row_line_height) + 10

        if current_y - row_height < bottom_margin:
            start_page()
            draw_section_title(section["title"], continued=True)
            draw_table_header(section)

        row_bottom = current_y - row_height
        background_color = (0.93, 0.96, 0.99) if footer else (0.985, 0.989, 0.995) if row_index % 2 == 0 else (1, 1, 1)
        cell_x = margin_x

        for cell_lines, cell_width, alignment in zip(wrapped_cells, column_widths, alignments, strict=False):
            _pdf_draw_rect(commands, cell_x, row_bottom, cell_width, row_height, fill_color=background_color, stroke_color=(0.88, 0.91, 0.95), line_width=0.8)

            for line_index, line in enumerate(cell_lines):
                text_y = row_bottom + row_height - 12 - (line_index * row_line_height)
                text_x = cell_x + cell_width - row_padding if alignment == "right" else cell_x + row_padding
                _pdf_draw_text(commands, text_x, text_y, line, font="F2" if footer else "F1", size=row_font_size, color=(0.08, 0.12, 0.2), align=alignment)

            cell_x += cell_width

        current_y = row_bottom

    start_page(include_highlights=True)

    for section in document["sections"]:
        draw_section_title(section["title"])
        draw_table_header(section)

        if section["rows"]:
            for row_index, row in enumerate(section["rows"]):
                if current_y - 30 < bottom_margin:
                    start_page()
                    draw_section_title(section["title"], continued=True)
                    draw_table_header(section)

                draw_table_row(section, row, row_index=row_index)

            if section.get("footer"):
                if current_y - 30 < bottom_margin:
                    start_page()
                    draw_section_title(section["title"], continued=True)
                    draw_table_header(section)

                draw_table_row(section, section["footer"], footer=True)
        else:
            draw_table_row(
                section,
                [section.get("empty_message") or "No data"] + [""] * (len(section["headers"]) - 1),
            )

        current_y -= section_gap

    if commands:
        pages.append(commands)

    objects = [b"", b"", b"", b""]
    page_ids = []

    for page_commands in pages or [[]]:
        stream = "\n".join(page_commands).encode("latin-1", "replace")
        content_id = len(objects) + 1
        objects.append(
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        page_id = len(objects) + 1
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_id} 0 R >>"
            ).encode("latin-1")
        )
        page_ids.append(page_id)

    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = (
        f"<< /Type /Pages /Count {len(page_ids)} /Kids "
        f"[{' '.join(f'{page_id} 0 R' for page_id in page_ids)}] >>"
    ).encode("latin-1")
    objects[2] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"

    pdf_buffer = io.BytesIO()
    pdf_buffer.write(b"%PDF-1.4\n")
    offsets = [0]

    for index, obj in enumerate(objects, start=1):
        offsets.append(pdf_buffer.tell())
        pdf_buffer.write(f"{index} 0 obj\n".encode("latin-1"))
        pdf_buffer.write(obj)
        pdf_buffer.write(b"\nendobj\n")

    xref_offset = pdf_buffer.tell()
    pdf_buffer.write(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf_buffer.write(b"0000000000 65535 f \n")

    for offset in offsets[1:]:
        pdf_buffer.write(f"{offset:010d} 00000 n \n".encode("latin-1"))

    pdf_buffer.write(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )

    return pdf_buffer.getvalue()


def export_report_file(
    report_type,
    report_format="CSV",
    date_from=None,
    date_to=None,
    table_id=None,
    category_id=None,
    product_id=None,
):
    normalized_format = _normalize_report_format(report_format)
    document = _build_report_document(
        report_type,
        date_from=date_from,
        date_to=date_to,
        table_id=table_id,
        category_id=category_id,
        product_id=product_id,
    )
    filename = _build_report_filename(document, normalized_format)

    if normalized_format == "PDF":
        return {
            "content": _build_simple_pdf(document),
            "filename": filename,
            "media_type": "application/pdf",
        }

    return {
        "content": _build_csv_bytes(document),
        "filename": filename,
        "media_type": "text/csv; charset=utf-8",
    }


def _validate_smtp_config(config):
    if not config.get("smtp_host"):
        return "Enter SMTP host in mail configuration"

    smtp_port = int(config.get("smtp_port") or 0)

    if smtp_port <= 0:
        return "Enter a valid SMTP port"

    if not config.get("smtp_from_email"):
        return "Enter sender email in mail configuration"

    if not _EMAIL_PATTERN.match(config.get("smtp_from_email") or ""):
        return "Enter valid sender email in mail configuration"

    if config.get("smtp_use_auth"):
        if not (config.get("smtp_username") or "").strip():
            return "Enter SMTP username in mail configuration"

        if not (config.get("smtp_password") or "").strip():
            return "Enter SMTP password in mail configuration"

    return None


def _deliver_email_message(config, message):
    from_email = config.get("smtp_from_email") or ""
    from_name = config.get("smtp_from_name") or ""
    message["From"] = formataddr((from_name, from_email)) if from_name else from_email

    smtp_host = config.get("smtp_host")
    smtp_port = int(config.get("smtp_port") or 587)
    smtp_username = config.get("smtp_username") or ""
    smtp_password = config.get("smtp_password") or ""
    smtp_use_auth = bool(config.get("smtp_use_auth", True))

    if config.get("smtp_use_ssl"):
        server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)

    try:
        server.ehlo()

        if config.get("smtp_use_tls") and not config.get("smtp_use_ssl"):
            server.starttls()
            server.ehlo()

        if smtp_use_auth and smtp_username:
            if not server.has_extn("auth"):
                raise smtplib.SMTPNotSupportedError(
                    "SMTP AUTH is not supported by this server. "
                    "Turn off SMTP Authentication in Mail Configuration."
                )
            server.login(smtp_username, smtp_password)

        server.send_message(message)
    finally:
        server.quit()


def _send_email_with_attachments(config, recipients, subject, body, attachments):
    message = EmailMessage()
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)

    for attachment in attachments:
        if attachment["format"] == "PDF":
            message.add_attachment(
                attachment["content"],
                maintype="application",
                subtype="pdf",
                filename=attachment["filename"],
            )
        else:
            message.add_attachment(
                attachment["content"],
                maintype="text",
                subtype="csv",
                filename=attachment["filename"],
            )

    _deliver_email_message(config, message)


def _send_email_with_attachment(
    config,
    recipients,
    subject,
    body,
    attachment_name,
    attachment_bytes,
    attachment_format,
):
    _send_email_with_attachments(
        config,
        recipients,
        subject,
        body,
        [
            {
                "filename": attachment_name,
                "content": attachment_bytes,
                "format": attachment_format,
            }
        ],
    )


def send_test_mail_config_email(payload):
    config = {
        "smtp_host": payload.smtp_host.strip(),
        "smtp_port": int(payload.smtp_port or 587),
        "smtp_username": payload.smtp_username.strip(),
        "smtp_password": payload.smtp_password,
        "smtp_from_email": payload.smtp_from_email.strip(),
        "smtp_from_name": payload.smtp_from_name.strip(),
        "smtp_use_auth": bool(payload.smtp_use_auth),
        "smtp_use_tls": bool(payload.smtp_use_tls) if not payload.smtp_use_ssl else False,
        "smtp_use_ssl": bool(payload.smtp_use_ssl),
    }
    validation_error = _validate_smtp_config(config)

    if validation_error:
        return {"error": validation_error}

    recipients = _normalize_email_list(
        [payload.test_recipient, payload.smtp_from_email, *payload.default_recipients],
    )

    if not recipients:
        return {"error": "Enter a test recipient email"}

    selected_recipient = recipients[0]
    message = EmailMessage()
    message["To"] = selected_recipient
    message["Subject"] = (
        f"Mail Configuration Test - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    message.set_content(
        "This is a test email from your POS Mail Configuration.\n\n"
        "If you received this email, your SMTP settings are working."
    )

    try:
        _deliver_email_message(config, message)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Failed to send test email: {exc}"}

    return {"message": f"Test email sent to {selected_recipient}"}


def send_report_email(payload):
    config = get_report_mail_config()
    validation_error = _validate_smtp_config(config)

    if validation_error:
        return {"error": validation_error}

    recipients = _normalize_email_list(payload.recipients) or config.get(
        "default_recipients",
        [],
    )

    if not recipients:
        return {"error": "Add at least one recipient email"}

    normalized_report_type = _normalize_report_type(payload.report_type)
    normalized_report_format = _normalize_report_format(payload.report_format)
    export_result = export_report_file(
        normalized_report_type,
        normalized_report_format,
        date_from=payload.date_from,
        date_to=payload.date_to,
        table_id=payload.table_id,
        category_id=payload.category_id,
        product_id=payload.product_id,
    )
    subject = (
        payload.subject.strip()
        if payload.subject and payload.subject.strip()
        else f"{REPORT_TYPE_DEFINITIONS[normalized_report_type]} - {datetime.now().strftime('%Y-%m-%d')}"
    )
    body = (
        f"Report: {REPORT_TYPE_DEFINITIONS[normalized_report_type]}\n"
        f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Range: {payload.date_from or '-'} to {payload.date_to or '-'}\n"
        f"Please find the attached report."
    )

    try:
        _send_email_with_attachment(
            config,
            recipients,
            subject,
            body,
            export_result["filename"],
            export_result["content"],
            normalized_report_format,
        )
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Failed to send email: {exc}"}

    return {"message": f"Report sent to {', '.join(recipients)}"}


def send_daily_sales_full_report_to_default_recipients(
    date_from: str,
    date_to: str,
):
    config = get_report_mail_config()
    validation_error = _validate_smtp_config(config)

    if validation_error:
        return {"error": validation_error}

    recipients = _normalize_email_list(config.get("default_recipients", []))

    if not recipients:
        return {"error": "Add default recipients in Mail Configuration"}

    report_type = "DAILY_SALES_FULL"
    report_format = "PDF"
    export_result = export_report_file(
        report_type,
        report_format,
        date_from=date_from,
        date_to=date_to,
    )
    subject = (
        f"{REPORT_TYPE_DEFINITIONS[report_type]} - "
        f"{datetime.now().strftime('%Y-%m-%d')}"
    )
    body = (
        f"Report: {REPORT_TYPE_DEFINITIONS[report_type]}\n"
        f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Range: {date_from} to {date_to}\n"
        "This report was sent automatically when cash was closed."
    )

    try:
        _send_email_with_attachment(
            config,
            recipients,
            subject,
            body,
            export_result["filename"],
            export_result["content"],
            report_format,
        )
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Failed to send email: {exc}"}

    return {
        "message": f"Report sent to {', '.join(recipients)}",
        "recipients": recipients,
        "report_format": report_format,
    }


def _get_due_auto_send_payload(config):
    if not config.get("auto_send_enabled"):
        return None

    recipients = config.get("auto_recipients") or config.get("default_recipients") or []

    if not recipients:
        return None

    auto_send_time = _normalize_auto_send_time(config.get("auto_send_time"))
    send_hour, send_minute = [int(part) for part in auto_send_time.split(":")]
    now = datetime.now()

    if (now.hour, now.minute) < (send_hour, send_minute):
        return None

    last_auto_sent_at = _parse_datetime_filter(config.get("last_auto_sent_at"))

    if last_auto_sent_at and last_auto_sent_at.date() == now.date():
        return None

    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "report_types": _normalize_report_type_list(config.get("auto_report_types"))
        or [_normalize_report_type(config.get("auto_report_type"))],
        "report_format": _normalize_report_format(config.get("auto_report_format")),
        "recipients": recipients,
        "date_from": start_of_day.strftime("%Y-%m-%d %H:%M:%S"),
        "date_to": now.strftime("%Y-%m-%d %H:%M:%S"),
    }


def run_due_scheduled_reports():
    config = get_report_mail_config()
    validation_error = _validate_smtp_config(config)

    if validation_error:
        return

    payload = _get_due_auto_send_payload(config)

    if not payload:
        return

    attachments = [
        {
            **export_report_file(
                report_type,
                payload["report_format"],
                date_from=payload["date_from"],
                date_to=payload["date_to"],
            ),
            "format": payload["report_format"],
        }
        for report_type in payload["report_types"]
    ]
    report_labels = [
        REPORT_TYPE_DEFINITIONS[report_type] for report_type in payload["report_types"]
    ]
    subject = (
        f"Automatic Daily Reports - {datetime.now().strftime('%Y-%m-%d')}"
        if len(report_labels) > 1
        else f"{report_labels[0]} - {datetime.now().strftime('%Y-%m-%d')}"
    )
    body = (
        f"Automatic daily report.\n"
        f"Reports: {', '.join(report_labels)}\n"
        f"Range: {payload['date_from']} to {payload['date_to']}\n"
        f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    try:
        _send_email_with_attachments(
            config,
            payload["recipients"],
            subject,
            body,
            attachments,
        )
    except Exception as exc:  # noqa: BLE001
        print("Automatic report email failed:", exc)
        return

    db = get_db()
    _ensure_report_tables(db)
    cursor = db.cursor()

    try:
        cursor.execute(
            "UPDATE report_mail_config SET last_auto_sent_at=CURRENT_TIMESTAMP WHERE id=1"
        )
        db.commit()
    finally:
        cursor.close()
        db.close()


def _scheduler_loop():
    try:
        run_due_scheduled_reports()
    except Exception as exc:  # noqa: BLE001
        print("Report scheduler startup check failed:", exc)

    while not _scheduler_stop_event.wait(60):
        try:
            run_due_scheduled_reports()
        except Exception as exc:  # noqa: BLE001
            print("Report scheduler error:", exc)


def start_report_scheduler():
    global _scheduler_thread

    if _scheduler_thread and _scheduler_thread.is_alive():
        return

    _scheduler_stop_event.clear()
    _scheduler_thread = threading.Thread(
        target=_scheduler_loop,
        name="report-scheduler",
        daemon=True,
    )
    _scheduler_thread.start()


def stop_report_scheduler():
    _scheduler_stop_event.set()


def send_auto_report_now(payload):
    config = get_report_mail_config()
    auto_report_type = _normalize_report_type(payload.auto_report_type)
    auto_report_types = _normalize_report_type_list(payload.auto_report_types)

    if not auto_report_types:
        return {"error": "Select at least one automatic report"}

    config = {
        **config,
        "auto_send_enabled": bool(payload.auto_send_enabled),
        "auto_send_time": _normalize_auto_send_time(payload.auto_send_time),
        "auto_report_type": auto_report_type,
        "auto_report_types": auto_report_types,
        "auto_report_format": _normalize_report_format(payload.auto_report_format),
        "auto_recipients": _normalize_email_list(payload.auto_recipients),
    }
    validation_error = _validate_smtp_config(config)

    if validation_error:
        return {"error": validation_error}

    recipients = config["auto_recipients"] or config["default_recipients"]

    if not recipients:
        return {"error": "Add at least one automatic report recipient"}

    now = datetime.now()
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    attachments = [
        {
            **export_report_file(
                report_type,
                config["auto_report_format"],
                date_from=start_of_day.strftime("%Y-%m-%d %H:%M:%S"),
                date_to=now.strftime("%Y-%m-%d %H:%M:%S"),
            ),
            "format": config["auto_report_format"],
        }
        for report_type in config["auto_report_types"]
    ]
    report_labels = [
        REPORT_TYPE_DEFINITIONS[report_type]
        for report_type in config["auto_report_types"]
    ]
    subject = (
        f"Automatic Daily Reports - {now.strftime('%Y-%m-%d')}"
        if len(report_labels) > 1
        else f"{report_labels[0]} - {now.strftime('%Y-%m-%d')}"
    )
    body = (
        "Automatic report send triggered manually.\n"
        f"Reports: {', '.join(report_labels)}\n"
        f"Range: {start_of_day.strftime('%Y-%m-%d %H:%M:%S')} "
        f"to {now.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Generated At: {now.strftime('%Y-%m-%d %H:%M:%S')}"
    )

    try:
        _send_email_with_attachments(
            config,
            recipients,
            subject,
            body,
            attachments,
        )
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Failed to send automatic daily report: {exc}"}

    return {"message": f"Automatic daily report sent to {', '.join(recipients)}"}
