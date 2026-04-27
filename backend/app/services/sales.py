import base64
import ctypes
import io
import json
import os
import re
import subprocess
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from app.db.mysql import get_db
from app.schemas.sales import (
    SaleBillPaymentMethodUpdateRequest,
    SaleBillUpdateRequest,
    SaleCashClosingSaveRequest,
    SaleCheckoutRequest,
    SaleExpenseSaveRequest,
    SaleMoveRequest,
    SaleSaveRequest,
    SaleTransferItemRequest,
)
from app.services.sale_live_updates import (
    publish_table_sale_event,
    publish_table_sale_events,
)
from app.services.stock import _ensure_stock_tables as _ensure_stock_inventory_tables

VALID_TAX_MODES = {"GST_INCLUDED", "NO_TAX"}
VALID_PAYMENT_METHODS = {"CASH", "CARD", "UPI", "MIXED"}
VALID_BILL_CHANGE_FILTERS = {"ACTIVE", "EDITED", "DELETED", "ALL"}
TOKEN_LINE_WIDTH = 32
RECEIPT_LINE_WIDTH = 42
_RECEIPT_LOGO_DATA_PATTERN = re.compile(
    r"^data:(image/[\w.+-]+);base64,(.+)$",
    re.DOTALL,
)

_sales_tables_ready = False


def _index_exists(cursor, table_name: str, index_name: str) -> bool:
    cursor.execute(f"SHOW INDEX FROM {table_name} WHERE Key_name = %s", (index_name,))
    rows = cursor.fetchall()
    return bool(rows)


def _ensure_named_index(cursor, table_name: str, index_name: str, columns: str):
    if _index_exists(cursor, table_name, index_name):
        return

    cursor.execute(f"CREATE INDEX {index_name} ON {table_name} ({columns})")


def _ensure_sales_tables(db):
    global _sales_tables_ready

    if _sales_tables_ready:
        return

    cursor = db.cursor(buffered=True)

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                table_id INT NOT NULL,
                customer_paid DECIMAL(10, 2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_sale_table (table_id)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sale_id INT NOT NULL,
                product_id INT NULL,
                item_name VARCHAR(255) NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                qty INT NOT NULL DEFAULT 1,
                tax_mode VARCHAR(50) NOT NULL DEFAULT 'NO_TAX',
                printer_name VARCHAR(255) NULL,
                printer_target VARCHAR(255) NULL,
                created_by_user_id INT NULL,
                created_by_username VARCHAR(255) NULL,
                line_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
                kot_printed_qty INT NOT NULL DEFAULT 0
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bill_number VARCHAR(50) NULL UNIQUE,
                table_id INT NULL,
                table_name VARCHAR(255) NULL,
                floor_name VARCHAR(255) NULL,
                customer_paid DECIMAL(10, 2) NULL,
                cash_paid DECIMAL(10, 2) NULL,
                card_paid DECIMAL(10, 2) NULL,
                upi_paid DECIMAL(10, 2) NULL,
                subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
                total DECIMAL(10, 2) NOT NULL DEFAULT 0,
                balance DECIMAL(10, 2) NULL,
                payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
                print_enabled TINYINT(1) NOT NULL DEFAULT 1,
                stock_applied TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_bill_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bill_id INT NOT NULL,
                product_id INT NULL,
                item_name VARCHAR(255) NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                qty INT NOT NULL DEFAULT 1,
                tax_mode VARCHAR(50) NOT NULL DEFAULT 'NO_TAX',
                printer_name VARCHAR(255) NULL,
                printer_target VARCHAR(255) NULL,
                line_total DECIMAL(10, 2) NOT NULL DEFAULT 0
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_bill_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bill_id INT NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                snapshot_json LONGTEXT NOT NULL,
                changed_by_user_id INT NULL,
                changed_by_username VARCHAR(255) NULL,
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                expense_date DATE NOT NULL,
                expense_at DATETIME NOT NULL,
                amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
                details VARCHAR(255) NOT NULL,
                created_by_user_id INT NULL,
                created_by_username VARCHAR(255) NULL,
                edited_at TIMESTAMP NULL,
                edited_by_user_id INT NULL,
                edited_by_username VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_sale_expenses_date (expense_date),
                INDEX idx_sale_expenses_at (expense_at)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sale_cash_closing (
                id INT AUTO_INCREMENT PRIMARY KEY,
                business_date DATE NOT NULL,
                cash_in_hand DECIMAL(10, 2) NOT NULL DEFAULT 0,
                entered_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
                entered_upi DECIMAL(10, 2) NOT NULL DEFAULT 0,
                entered_card DECIMAL(10, 2) NOT NULL DEFAULT 0,
                is_closed TINYINT(1) NOT NULL DEFAULT 0,
                closed_at TIMESTAMP NULL DEFAULT NULL,
                closed_by_user_id INT NULL,
                closed_by_username VARCHAR(255) NULL,
                updated_by_user_id INT NULL,
                updated_by_username VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_sale_cash_closing_date (business_date)
            )
            """
        )
        cursor.execute("SHOW COLUMNS FROM sale_orders")
        existing_sale_columns = {row[0] for row in cursor.fetchall()}

        if "order_number" not in existing_sale_columns:
            cursor.execute(
                """
                ALTER TABLE sale_orders
                ADD COLUMN order_number VARCHAR(50) NULL
                """
            )

        if "customer_paid" not in existing_sale_columns:
            cursor.execute(
                """
                ALTER TABLE sale_orders
                ADD COLUMN customer_paid DECIMAL(10, 2) NULL
                """
            )

        if "created_at" not in existing_sale_columns:
            cursor.execute(
                """
                ALTER TABLE sale_orders
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                """
            )

        if "updated_at" not in existing_sale_columns:
            cursor.execute(
                """
                ALTER TABLE sale_orders
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
                """
            )

        cursor.execute("SHOW COLUMNS FROM sale_order_items")
        existing_columns = {row[0] for row in cursor.fetchall()}

        if "product_id" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN product_id INT NULL
                """
            )

        if "unit_price" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "qty" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN qty INT NOT NULL DEFAULT 1
                """
            )

        if "tax_mode" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN tax_mode VARCHAR(50) NOT NULL DEFAULT 'NO_TAX'
                """
            )

        if "printer_name" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN printer_name VARCHAR(255) NULL
                """
            )

        if "printer_target" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN printer_target VARCHAR(255) NULL
                """
            )

        if "line_total" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN line_total DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "kot_printed_qty" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN kot_printed_qty INT NOT NULL DEFAULT 0
                """
            )

        if "created_by_user_id" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN created_by_user_id INT NULL
                """
            )

        if "created_by_username" not in existing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_order_items
                ADD COLUMN created_by_username VARCHAR(255) NULL
                """
            )

        cursor.execute("SHOW COLUMNS FROM sale_bills")
        existing_bill_columns = {row[0] for row in cursor.fetchall()}

        if "cash_paid" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN cash_paid DECIMAL(10, 2) NULL
                """
            )

        if "card_paid" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN card_paid DECIMAL(10, 2) NULL
                """
            )

        if "upi_paid" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN upi_paid DECIMAL(10, 2) NULL
                """
            )

        if "is_deleted" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "deleted_at" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN deleted_at TIMESTAMP NULL
                """
            )

        if "deleted_by_user_id" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN deleted_by_user_id INT NULL
                """
            )

        if "deleted_by_username" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN deleted_by_username VARCHAR(255) NULL
                """
            )

        if "edited_at" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN edited_at TIMESTAMP NULL
                """
            )

        if "edited_by_user_id" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN edited_by_user_id INT NULL
                """
            )

        if "edited_by_username" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN edited_by_username VARCHAR(255) NULL
                """
            )

        if "stock_applied" not in existing_bill_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bills
                ADD COLUMN stock_applied TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        cursor.execute("SHOW COLUMNS FROM sale_bill_items")
        existing_bill_item_columns = {row[0] for row in cursor.fetchall()}

        if "cost_price" not in existing_bill_item_columns:
            cursor.execute(
                """
                ALTER TABLE sale_bill_items
                ADD COLUMN cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        cursor.execute("SHOW COLUMNS FROM sale_expenses")
        existing_expense_columns = {row[0] for row in cursor.fetchall()}

        if "expense_date" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN expense_date DATE NOT NULL
                """
            )

        if "expense_at" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN expense_at DATETIME NOT NULL
                """
            )

        if "amount" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN amount DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "details" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN details VARCHAR(255) NOT NULL DEFAULT ''
                """
            )

        if "created_by_user_id" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN created_by_user_id INT NULL
                """
            )

        if "created_by_username" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN created_by_username VARCHAR(255) NULL
                """
            )

        if "edited_at" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN edited_at TIMESTAMP NULL
                """
            )

        if "edited_by_user_id" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN edited_by_user_id INT NULL
                """
            )

        if "edited_by_username" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN edited_by_username VARCHAR(255) NULL
                """
            )

        if "created_at" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                """
            )

        if "updated_at" not in existing_expense_columns:
            cursor.execute(
                """
                ALTER TABLE sale_expenses
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
                """
            )

        cursor.execute("SHOW COLUMNS FROM sale_cash_closing")
        existing_cash_closing_columns = {row[0] for row in cursor.fetchall()}

        if "business_date" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN business_date DATE NOT NULL
                """
            )

        if "cash_in_hand" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN cash_in_hand DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "entered_cash" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN entered_cash DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "entered_upi" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN entered_upi DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "entered_card" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN entered_card DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if "is_closed" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN is_closed TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "closed_at" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN closed_at TIMESTAMP NULL DEFAULT NULL
                """
            )

        if "closed_by_user_id" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN closed_by_user_id INT NULL
                """
            )

        if "closed_by_username" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN closed_by_username VARCHAR(255) NULL
                """
            )

        if "updated_by_user_id" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN updated_by_user_id INT NULL
                """
            )

        if "updated_by_username" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN updated_by_username VARCHAR(255) NULL
                """
            )

        if "created_at" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                """
            )

        if "updated_at" not in existing_cash_closing_columns:
            cursor.execute(
                """
                ALTER TABLE sale_cash_closing
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
                """
            )

        _ensure_named_index(
            cursor,
            "sale_orders",
            "idx_sale_orders_updated_at",
            "updated_at",
        )
        _ensure_named_index(
            cursor,
            "sale_order_items",
            "idx_sale_order_items_sale_id",
            "sale_id",
        )
        _ensure_named_index(
            cursor,
            "sale_bills",
            "idx_sale_bills_created_at",
            "created_at",
        )
        _ensure_named_index(
            cursor,
            "sale_bills",
            "idx_sale_bills_table_deleted_created_at",
            "table_id, is_deleted, created_at",
        )
        _ensure_named_index(
            cursor,
            "sale_bill_items",
            "idx_sale_bill_items_bill_id",
            "bill_id",
        )
        _ensure_named_index(
            cursor,
            "sale_bill_history",
            "idx_sale_bill_history_bill_id_changed_at",
            "bill_id, changed_at",
        )
        db.commit()
        _sales_tables_ready = True
    finally:
        cursor.close()


def _decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _serialize_datetime(value):
    if value is None:
        return None
    return value.isoformat(sep=" ", timespec="seconds")


def _normalize_customer_paid(value):
    if value is None:
        return None

    try:
        normalized = round(float(value), 2)
    except (TypeError, ValueError):
        return None

    return max(normalized, 0)


def _normalize_user_id(value):
    if value is None:
        return None

    try:
        normalized = int(value)
    except (TypeError, ValueError):
        return None

    return normalized if normalized > 0 else None


def _normalize_actor_username(value):
    normalized = (value or "").strip()
    return normalized or None


def _normalize_payment_method(value):
    normalized = (value or "CASH").strip().upper()
    return normalized if normalized in VALID_PAYMENT_METHODS else "CASH"


def _normalize_payment_amount(value):
    normalized = _normalize_customer_paid(value)
    return 0 if normalized is None else normalized


def _normalize_payment_filter(value: str | None):
    normalized = (value or "").strip().upper()

    if not normalized or normalized == "ALL":
        return None

    return normalized if normalized in VALID_PAYMENT_METHODS else None


def _normalize_bill_change_filter(value: str | None):
    normalized = (value or "").strip().upper()

    if not normalized:
        return "ACTIVE"

    return normalized if normalized in VALID_BILL_CHANGE_FILTERS else "ACTIVE"


def _resolve_payment_values(payload, fallback_customer_paid: float | None, total: float):
    raw_cash_paid = getattr(payload, "cash_paid", None)
    raw_card_paid = getattr(payload, "card_paid", None)
    raw_upi_paid = getattr(payload, "upi_paid", None)
    has_explicit_split = any(
        value is not None for value in (raw_cash_paid, raw_card_paid, raw_upi_paid)
    )

    if has_explicit_split:
        cash_paid = _normalize_payment_amount(raw_cash_paid)
        card_paid = _normalize_payment_amount(raw_card_paid)
        upi_paid = _normalize_payment_amount(raw_upi_paid)
    else:
        payment_method = _normalize_payment_method(payload.payment_method)
        customer_paid = _normalize_customer_paid(payload.customer_paid)

        if customer_paid is None:
            customer_paid = _normalize_customer_paid(fallback_customer_paid)

        if customer_paid is None:
            customer_paid = total

        cash_paid = customer_paid if payment_method == "CASH" else 0
        card_paid = customer_paid if payment_method == "CARD" else 0
        upi_paid = customer_paid if payment_method == "UPI" else 0

    customer_paid = round(cash_paid + card_paid + upi_paid, 2)
    positive_methods = []

    if cash_paid > 0:
        positive_methods.append("CASH")
    if card_paid > 0:
        positive_methods.append("CARD")
    if upi_paid > 0:
        positive_methods.append("UPI")

    if len(positive_methods) > 1:
        payment_method = "MIXED"
    elif len(positive_methods) == 1:
        payment_method = positive_methods[0]
    else:
        payment_method = _normalize_payment_method(payload.payment_method)

    return {
        "customer_paid": customer_paid,
        "cash_paid": cash_paid,
        "card_paid": card_paid,
        "upi_paid": upi_paid,
        "payment_method": payment_method,
        "balance": round(customer_paid - total, 2),
    }


def _parse_history_date(value: str | None):
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def _parse_datetime_filter(value: str | None):
    normalized_value = (value or "").strip()

    if not normalized_value:
        return None

    try:
        return datetime.fromisoformat(normalized_value)
    except ValueError:
        pass

    fallback_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]

    for format_string in fallback_formats:
        try:
            return datetime.strptime(normalized_value, format_string)
        except ValueError:
            continue

    return None


def _parse_expense_date(value: str | None):
    normalized_value = (value or "").strip()

    if not normalized_value:
        return None

    try:
        return datetime.fromisoformat(normalized_value).date()
    except ValueError:
        pass

    for format_string in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(normalized_value, format_string).date()
        except ValueError:
            continue

    return None


def _parse_expense_time(value: str | None):
    normalized_value = (value or "").strip()

    if not normalized_value:
        return None

    for format_string in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(normalized_value, format_string).time()
        except ValueError:
            continue

    return None


def _serialize_date(value):
    if value is None:
        return None

    if isinstance(value, date):
        return value.isoformat()

    parsed_value = _parse_expense_date(str(value))
    return parsed_value.isoformat() if parsed_value else str(value)


def _normalize_expense_amount(value):
    try:
        normalized_value = round(float(value), 2)
    except (TypeError, ValueError):
        return None

    return normalized_value if normalized_value > 0 else None


def _normalize_expense_details(value):
    return " ".join(str(value or "").strip().split())


def _normalize_actor_role(value):
    return str(value or "").strip().upper()


def _is_admin_actor(role):
    return _normalize_actor_role(role) == "ADMIN"


def _resolve_expense_datetime(expense_date_value: str | None, expense_time_value: str | None):
    current_value = datetime.now()
    resolved_date = _parse_expense_date(expense_date_value) or current_value.date()
    resolved_time = _parse_expense_time(expense_time_value) or current_value.time().replace(
        second=0,
        microsecond=0,
    )
    return resolved_date, datetime.combine(resolved_date, resolved_time)


def _serialize_sale_expense_row(row):
    expense_at_value = _parse_datetime_filter(_serialize_datetime(row.get("expense_at")))

    return {
        "id": int(row.get("id") or 0),
        "expense_date": _serialize_date(row.get("expense_date")),
        "expense_at": _serialize_datetime(row.get("expense_at")),
        "expense_time": expense_at_value.strftime("%H:%M") if expense_at_value else "",
        "amount": round(_decimal_to_float(row.get("amount")) or 0, 2),
        "details": row.get("details") or "",
        "created_by_user_id": _normalize_user_id(row.get("created_by_user_id")),
        "created_by_username": row.get("created_by_username") or "",
        "edited_at": _serialize_datetime(row.get("edited_at")),
        "edited_by_user_id": _normalize_user_id(row.get("edited_by_user_id")),
        "edited_by_username": row.get("edited_by_username") or "",
        "updated_at": _serialize_datetime(row.get("updated_at")),
    }


def _serialize_sale_cash_closing_row(
    row,
    total_sales: float | None = None,
    total_expense: float | None = None,
):
    if not row:
        resolved_total_sales = round(float(total_sales or 0), 2)
        resolved_total_expense = round(float(total_expense or 0), 2)
        return {
            "business_date": None,
            "cash_in_hand": 0,
            "entered_cash": 0,
            "entered_upi": 0,
            "entered_card": 0,
            "entered_total": 0,
            "total_sales": resolved_total_sales,
            "total_expense": resolved_total_expense,
            "tally_difference": None,
            "tally_status": "PENDING",
            "is_closed": False,
            "closed_at": None,
            "closed_by_user_id": None,
            "closed_by_username": "",
            "updated_by_user_id": None,
            "updated_by_username": "",
            "updated_at": None,
        }

    entered_cash = round(_decimal_to_float(row.get("entered_cash")) or 0, 2)
    entered_upi = round(_decimal_to_float(row.get("entered_upi")) or 0, 2)
    entered_card = round(_decimal_to_float(row.get("entered_card")) or 0, 2)
    if (
        entered_cash <= 0
        and entered_upi <= 0
        and entered_card <= 0
        and cash_in_hand > 0
    ):
        entered_cash = cash_in_hand
    entered_total = round(entered_cash + entered_upi + entered_card, 2)
    resolved_total_sales = round(float(total_sales or 0), 2)
    resolved_total_expense = round(float(total_expense or 0), 2)
    tally_difference = round(
        resolved_total_sales - resolved_total_expense - entered_total,
        2,
    )

    if abs(tally_difference) < 0.01:
        tally_status = "TALLY"
    elif tally_difference > 0:
        tally_status = "MISSING"
    else:
        tally_status = "EXCESS"

    return {
        "business_date": _serialize_date(row.get("business_date")),
        "cash_in_hand": round(_decimal_to_float(row.get("cash_in_hand")) or 0, 2),
        "entered_cash": entered_cash,
        "entered_upi": entered_upi,
        "entered_card": entered_card,
        "entered_total": entered_total,
        "total_sales": resolved_total_sales,
        "total_expense": resolved_total_expense,
        "tally_difference": tally_difference,
        "tally_status": tally_status,
        "is_closed": bool(row.get("is_closed")),
        "closed_at": _serialize_datetime(row.get("closed_at")),
        "closed_by_user_id": _normalize_user_id(row.get("closed_by_user_id")),
        "closed_by_username": row.get("closed_by_username") or "",
        "updated_by_user_id": _normalize_user_id(row.get("updated_by_user_id")),
        "updated_by_username": row.get("updated_by_username") or "",
        "updated_at": _serialize_datetime(row.get("updated_at")),
    }


def _read_cash_closing_row_for_date(cursor, business_date_value: date):
    cursor.execute(
        """
        SELECT
            business_date,
            cash_in_hand,
            entered_cash,
            entered_upi,
            entered_card,
            is_closed,
            closed_at,
            closed_by_user_id,
            closed_by_username,
            updated_by_user_id,
            updated_by_username,
            updated_at
        FROM sale_cash_closing
        WHERE business_date=%s
        """,
        (business_date_value.isoformat(),),
    )
    return cursor.fetchone()


def _get_total_sales_for_business_date(cursor, business_date_value: date):
    cursor.execute(
        """
        SELECT COALESCE(SUM(total), 0) AS total_sales
        FROM sale_bills
        WHERE is_deleted = 0
          AND DATE(created_at) = %s
        """,
        (business_date_value.isoformat(),),
    )
    row = cursor.fetchone() or {}
    return round(_decimal_to_float(row.get("total_sales")) or 0, 2)


def _is_cash_closed_row(row):
    return bool(row and row.get("is_closed"))


def _build_cash_close_report_window(business_date_value: date):
    start_value = datetime.combine(business_date_value, time(0, 0, 0))
    now = datetime.now()
    end_value = (
        now
        if business_date_value == now.date()
        else datetime.combine(business_date_value, time(23, 59, 59))
    )

    return (
        start_value.strftime("%Y-%m-%d %H:%M:%S"),
        end_value.strftime("%Y-%m-%d %H:%M:%S"),
    )


def _build_expense_query_filters(
    parsed_date_from: datetime | None = None,
    parsed_date_to: datetime | None = None,
    expense_date_value: date | None = None,
):
    filters = ["1 = 1"]
    params = []

    if expense_date_value is not None:
        filters.append("se.expense_date = %s")
        params.append(expense_date_value.isoformat())
    else:
        if parsed_date_from is not None:
            filters.append("se.expense_at >= %s")
            params.append(parsed_date_from.strftime("%Y-%m-%d %H:%M:%S"))

        if parsed_date_to is not None:
            filters.append("se.expense_at <= %s")
            params.append(parsed_date_to.strftime("%Y-%m-%d %H:%M:%S"))

    return " AND ".join(filters), params


def _build_bill_number(bill_id: int):
    return f"BILL-{bill_id:06d}"


def _build_order_number(order_id: int):
    return f"{order_id:05d}"


def _item_requires_kot(item):
    return bool(_sanitize_thermal_text(item.get("printer_target")))


def _sanitize_thermal_text(value):
    return " ".join(str(value or "").strip().split())


def _format_print_datetime(value):
    if isinstance(value, datetime):
        date_value = value
    else:
        date_value = _parse_datetime_filter(str(value or "")) or datetime.now()

    return date_value.strftime("%d-%m-%Y %I:%M %p")


def _default_receipt_settings():
    return {
        "auto_kot_enabled": False,
        "title_enabled": False,
        "details_enabled": True,
        "title_font_size": 18,
        "logo_enabled": False,
        "logo_image": None,
        "logo_alignment": "CENTER",
        "logo_size": "SMALL",
        "logo_width": 200,
        "header_text": "",
        "header_alignment": "CENTER",
        "header_font_size": 18,
        "details_font_size": 12,
        "item_font_size": 13,
        "summary_font_size": 14,
        "footer_enabled": True,
        "footer_text": "THANK YOU VISIT AGAIN\nCONSUME WITHIN 1 HOUR",
        "footer_alignment": "CENTER",
        "footer_font_size": 12,
        "item_layout": "COMPACT",
    }


def _normalize_receipt_alignment(value):
    normalized_value = str(value or "CENTER").strip().upper()

    if normalized_value in {"LEFT", "CENTER", "RIGHT"}:
        return normalized_value

    return "CENTER"


def _normalize_receipt_logo_size(value):
    normalized_value = str(value or "SMALL").strip().upper()

    if normalized_value in {"SMALL", "MEDIUM", "LARGE"}:
        return normalized_value

    return "SMALL"


def _legacy_receipt_logo_width(value):
    normalized_value = _normalize_receipt_logo_size(value)

    if normalized_value == "LARGE":
        return 260

    if normalized_value == "MEDIUM":
        return 200

    return 140


def _normalize_receipt_logo_width(value, fallback_value=200):
    try:
        numeric_value = int(round(float(value)))
    except (TypeError, ValueError):
        return fallback_value

    return min(max(numeric_value, 80), 320)


def _get_receipt_alignment_mode(value):
    normalized_value = _normalize_receipt_alignment(value)

    if normalized_value == "LEFT":
        return 0

    if normalized_value == "RIGHT":
        return 2

    return 1


def _split_receipt_text_lines(value):
    lines = []

    for raw_line in str(value or "").splitlines():
        normalized_line = _sanitize_thermal_text(raw_line)

        if normalized_line:
            lines.append(normalized_line)

    return lines


def _normalize_receipt_font_size(value, fallback_value=13):
    if isinstance(value, str):
        normalized_value = value.strip().upper()

        if normalized_value == "SMALL":
            return 11

        if normalized_value == "MEDIUM":
            return 13

        if normalized_value == "LARGE":
            return 18

    try:
        numeric_value = int(round(float(value)))
    except (TypeError, ValueError):
        return fallback_value

    return min(max(numeric_value, 9), 56)


def _normalize_receipt_item_layout(value):
    normalized_value = str(value or "COMPACT").strip().upper()

    if normalized_value in {"COMPACT", "DETAILED"}:
        return normalized_value

    return "COMPACT"


def _get_escpos_font_size(value, fallback_value="MEDIUM"):
    normalized_value = _normalize_receipt_font_size(value, fallback_value)

    if normalized_value <= 11:
        return (1, 1)

    if normalized_value <= 14:
        return (1, 1)

    if normalized_value <= 18:
        return (2, 1)

    if normalized_value <= 24:
        return (2, 2)

    if normalized_value <= 30:
        return (3, 2)

    if normalized_value <= 40:
        return (3, 3)

    return (4, 4)


def _wrap_receipt_name_lines(item_name, width=24):
    item_value = _sanitize_thermal_text(item_name) or "-"
    available_width = max(int(width or 24), 8)
    words = item_value.split() or [item_value]
    lines = []
    current_line = ""

    for word in words:
        candidate = word if not current_line else f"{current_line} {word}"

        if len(candidate) <= available_width:
            current_line = candidate
            continue

        if current_line:
            lines.append(current_line)
            current_line = word[:available_width]
        else:
            lines.append(word[:available_width])
            current_line = ""

    if current_line:
        lines.append(current_line)

    return lines or ["-"]


def _format_receipt_item_heading(width=RECEIPT_LINE_WIDTH):
    item_width = max(width - 6 - 8, 8)
    return f"{'ITEM':<{item_width}}{'QTY':>6}{'PRICE':>8}"[:width]


def _format_receipt_item_rows(
    item_name,
    qty,
    price,
    width=RECEIPT_LINE_WIDTH,
    wrap_name=True,
):
    item_width = max(width - 6 - 8, 8)
    qty_text = str(int(qty or 0))
    price_text = f"{float(price or 0):.2f}"
    name_lines = _wrap_receipt_name_lines(item_name, item_width)

    if not wrap_name:
        name_lines = [name_lines[0][:item_width]]

    formatted_rows = [
        f"{name_lines[0]:<{item_width}}{qty_text:>6}{price_text:>8}"[:width]
    ]

    for line in name_lines[1:]:
        formatted_rows.append(f"{line:<{item_width}}"[:width])

    return formatted_rows


def _read_receipt_settings_from_cursor(cursor):
    defaults = _default_receipt_settings()
    cursor.execute(
        """
        SELECT
            auto_kot_enabled,
            title_enabled,
            details_enabled,
            title_font_size,
            logo_enabled,
            logo_image,
            logo_alignment,
            logo_size,
            logo_width,
            header_text,
            header_alignment,
            header_font_size,
            details_font_size,
            item_font_size,
            summary_font_size,
            footer_enabled,
            footer_text,
            footer_alignment,
            footer_font_size,
            item_layout
        FROM stock_receipt_settings
        WHERE id=1
        """
    )
    row = cursor.fetchone()

    if not row:
        return defaults

    return {
        "auto_kot_enabled": bool(row.get("auto_kot_enabled")),
        "title_enabled": bool(row.get("title_enabled")),
        "details_enabled": bool(row.get("details_enabled")),
        "title_font_size": _normalize_receipt_font_size(
            row.get("title_font_size"),
            defaults["title_font_size"],
        ),
        "logo_enabled": bool(row.get("logo_enabled")),
        "logo_image": row.get("logo_image") or defaults["logo_image"],
        "logo_alignment": _normalize_receipt_alignment(
            row.get("logo_alignment"),
        ),
        "logo_size": _normalize_receipt_logo_size(
            row.get("logo_size"),
        ),
        "logo_width": _normalize_receipt_logo_width(
            row.get("logo_width"),
            _legacy_receipt_logo_width(row.get("logo_size")),
        ),
        "header_text": row.get("header_text") or "",
        "header_alignment": _normalize_receipt_alignment(
            row.get("header_alignment"),
        ),
        "header_font_size": _normalize_receipt_font_size(
            row.get("header_font_size"),
            defaults["header_font_size"],
        ),
        "details_font_size": _normalize_receipt_font_size(
            row.get("details_font_size"),
            defaults["details_font_size"],
        ),
        "item_font_size": _normalize_receipt_font_size(
            row.get("item_font_size"),
            defaults["item_font_size"],
        ),
        "summary_font_size": _normalize_receipt_font_size(
            row.get("summary_font_size"),
            defaults["summary_font_size"],
        ),
        "footer_enabled": bool(row.get("footer_enabled")),
        "footer_text": row.get("footer_text") or defaults["footer_text"],
        "footer_alignment": _normalize_receipt_alignment(
            row.get("footer_alignment"),
        ),
        "footer_font_size": _normalize_receipt_font_size(
            row.get("footer_font_size"),
            defaults["footer_font_size"],
        ),
        "item_layout": _normalize_receipt_item_layout(row.get("item_layout")),
    }


def _is_auto_kot_enabled(cursor):
    return bool(_read_receipt_settings_from_cursor(cursor).get("auto_kot_enabled"))


def _align_thermal_line(left, right="", width=RECEIPT_LINE_WIDTH):
    left_value = _sanitize_thermal_text(left)
    right_value = _sanitize_thermal_text(right)

    if not right_value:
        return left_value[:width]

    available_width = max(width - len(right_value) - 1, 1)
    left_value = left_value[:available_width]
    spacing = max(width - len(left_value) - len(right_value), 1)
    return f"{left_value}{' ' * spacing}{right_value}"


def _decode_receipt_logo_bytes(image_data):
    if not image_data:
        return None

    match = _RECEIPT_LOGO_DATA_PATTERN.match(str(image_data).strip())

    if not match:
        return None

    try:
        return base64.b64decode(match.group(2), validate=False)
    except Exception:
        return None


def _get_receipt_logo_target_width(logo_width, logo_size):
    return _normalize_receipt_logo_width(
        logo_width,
        _legacy_receipt_logo_width(logo_size),
    )


def _build_escpos_logo_payload(image_data, logo_width, logo_size):
    image_bytes = _decode_receipt_logo_bytes(image_data)

    if not image_bytes:
        return b""

    try:
        from PIL import Image
    except Exception:
        return b""

    try:
        with Image.open(io.BytesIO(image_bytes)) as source_image:
            rgba_image = source_image.convert("RGBA")
    except Exception:
        return b""

    background_image = Image.new("RGBA", rgba_image.size, (255, 255, 255, 255))
    background_image.alpha_composite(rgba_image)
    grayscale_image = background_image.convert("L")
    target_width = _get_receipt_logo_target_width(logo_width, logo_size)

    if grayscale_image.width > target_width:
        resampling_mode = getattr(getattr(Image, "Resampling", Image), "LANCZOS")
        target_height = max(
            1,
            int(round(grayscale_image.height * (target_width / grayscale_image.width))),
        )
        grayscale_image = grayscale_image.resize(
            (target_width, target_height),
            resampling_mode,
        )

    threshold_image = grayscale_image.point(
        lambda pixel_value: 0 if pixel_value < 180 else 255,
        "1",
    )

    width, height = threshold_image.size
    padded_width = width if width % 8 == 0 else width + (8 - (width % 8))

    if padded_width != width:
        padded_image = Image.new("1", (padded_width, height), 1)
        padded_image.paste(threshold_image, (0, 0))
        threshold_image = padded_image
        width = padded_width

    bytes_per_row = width // 8
    raster_bytes = bytearray()

    for y_index in range(height):
        current_byte = 0
        current_bits = 0

        for x_index in range(width):
            pixel_value = threshold_image.getpixel((x_index, y_index))
            current_byte = (current_byte << 1) | (1 if pixel_value == 0 else 0)
            current_bits += 1

            if current_bits == 8:
                raster_bytes.append(current_byte)
                current_byte = 0
                current_bits = 0

    return (
        b"\x1dv0\x00"
        + bytes(
            [
                bytes_per_row % 256,
                bytes_per_row // 256,
                height % 256,
                height // 256,
            ]
        )
        + bytes(raster_bytes)
    )


def _center_thermal_line(value, width=RECEIPT_LINE_WIDTH):
    return _sanitize_thermal_text(value)[:width].center(width)


def _wrap_thermal_item_lines(prefix, item_name, width=RECEIPT_LINE_WIDTH):
    prefix_value = _sanitize_thermal_text(prefix)
    item_value = _sanitize_thermal_text(item_name).upper()
    available_width = max(width - len(prefix_value) - 1, 8)
    words = item_value.split() or [item_value]
    lines = []
    current_line = ""

    for word in words:
        candidate = word if not current_line else f"{current_line} {word}"

        if len(candidate) <= available_width:
            current_line = candidate
            continue

        if current_line:
            lines.append(current_line)
            current_line = word[:available_width]
        else:
            lines.append(word[:available_width])
            current_line = ""

    if current_line:
        lines.append(current_line)

    if not lines:
        lines = ["-"]

    formatted_lines = [
        _align_thermal_line(prefix_value, lines[0], width=width),
    ]
    padding = " " * min(len(prefix_value), width - 1)

    for line in lines[1:]:
        formatted_lines.append(_align_thermal_line(padding, line, width=width))

    return formatted_lines


def _build_main_bill_printer(cursor):
    cursor.execute(
        """
        SELECT id, name, target
        FROM stock_printers
        WHERE COALESCE(main_bill_enabled, 0) = 1
          AND target IS NOT NULL
          AND TRIM(target) <> ''
        ORDER BY id
        LIMIT 1
        """
    )
    return cursor.fetchone()


def _build_token_printer_catalog(cursor):
    cursor.execute(
        """
        SELECT id, name, target
        FROM stock_printers
        WHERE COALESCE(token_print_enabled, 0) = 1
          AND COALESCE(main_bill_enabled, 0) = 0
          AND target IS NOT NULL
          AND TRIM(target) <> ''
        ORDER BY id
        """
    )
    printers = cursor.fetchall()
    printers_by_target = {
        printer["target"]: printer
        for printer in printers
        if printer.get("target")
    }
    default_printer = printers[0] if printers else None
    return printers_by_target, default_printer


def _group_pending_kot_items(cursor, items: list[dict]):
    groups: dict[str, dict] = {}

    for item in items:
        printer_target = _sanitize_thermal_text(item.get("printer_target"))
        printer_name = _sanitize_thermal_text(item.get("printer_name"))
        if not printer_target:
            continue

        group_key = printer_target

        if group_key not in groups:
            groups[group_key] = {
                "printer_name": printer_name or printer_target,
                "printer_target": printer_target,
                "items": [],
            }

        groups[group_key]["items"].append(
            {
                "item_name": item["item_name"],
                "qty": max(
                    int(item.get("qty") or 0) - int(item.get("kot_printed_qty") or 0),
                    0,
                ),
                "printer_name": printer_name or printer_target,
                "printer_target": printer_target,
            }
        )

    return list(groups.values())


def _escpos_initialize():
    return b"\x1b@"


def _escpos_align(mode: int):
    return b"\x1ba" + bytes([mode])


def _escpos_bold(enabled: bool):
    return b"\x1bE" + bytes([1 if enabled else 0])


def _escpos_size(width_multiplier: int = 1, height_multiplier: int = 1):
    normalized_width = min(max(width_multiplier, 1), 8)
    normalized_height = min(max(height_multiplier, 1), 8)
    size_value = ((normalized_width - 1) << 4) | (normalized_height - 1)
    return b"\x1d!" + bytes([size_value])


def _escpos_line(text: str = ""):
    normalized_text = str(text or "").replace("\r", " ").replace("\n", " ")
    return normalized_text.encode("ascii", "replace") + b"\n"


def _escpos_feed(lines: int = 1):
    return b"\n" * max(lines, 0)


def _escpos_cut():
    return b"\x1dV\x00"


def _send_bytes_to_windows_printer(printer_target: str, payload: bytes):
    class DOCINFO1(ctypes.Structure):
        _fields_ = [
            ("pDocName", ctypes.c_wchar_p),
            ("pOutputFile", ctypes.c_wchar_p),
            ("pDatatype", ctypes.c_wchar_p),
        ]

    spooler = ctypes.WinDLL("winspool.drv", use_last_error=True)

    handle = ctypes.c_void_p()
    if not spooler.OpenPrinterW(printer_target, ctypes.byref(handle), None):
        return {"error": f"Failed to print to {printer_target}: {ctypes.WinError(ctypes.get_last_error())}"}

    doc_info = DOCINFO1("MONARCH POS", None, "RAW")
    written = ctypes.c_uint32(0)

    try:
        if not spooler.StartDocPrinterW(handle, 1, ctypes.byref(doc_info)):
            return {
                "error": f"Failed to print to {printer_target}: {ctypes.WinError(ctypes.get_last_error())}"
            }

        try:
            if not spooler.StartPagePrinter(handle):
                return {
                    "error": f"Failed to print to {printer_target}: {ctypes.WinError(ctypes.get_last_error())}"
                }

            try:
                if not spooler.WritePrinter(
                    handle,
                    payload,
                    len(payload),
                    ctypes.byref(written),
                ):
                    return {
                        "error": (
                            f"Failed to print to {printer_target}: "
                            f"{ctypes.WinError(ctypes.get_last_error())}"
                        )
                    }
            finally:
                spooler.EndPagePrinter(handle)
        finally:
            spooler.EndDocPrinter(handle)
    finally:
        spooler.ClosePrinter(handle)

    return {
        "printer_target": printer_target,
        "command": "winspool RAW",
    }


def _send_bytes_to_printer(printer_target: str, payload: bytes):
    if os.name == "nt":
        return _send_bytes_to_windows_printer(printer_target, payload)

    commands = [
        ["lp", "-d", printer_target, "-o", "raw"],
        ["lp", "-d", printer_target],
        ["lpr", "-P", printer_target, "-o", "raw"],
        ["lpr", "-P", printer_target],
    ]
    errors = []

    for command in commands:
        try:
            result = subprocess.run(
                command,
                input=payload,
                capture_output=True,
                check=False,
            )
        except FileNotFoundError:
            errors.append(f"{command[0]} not available")
            continue

        if result.returncode == 0:
            return {
                "printer_target": printer_target,
                "command": " ".join(command),
            }

        stderr = result.stderr.decode("utf-8", "ignore").strip()
        stdout = result.stdout.decode("utf-8", "ignore").strip()
        errors.append(stderr or stdout or f"{command[0]} failed")

    return {
        "error": f"Failed to print to {printer_target}: {' | '.join(error for error in errors if error)}"
    }


def _build_token_print_payload(
    table_name: str,
    order_number: str,
    updated_at,
    sender_name: str,
    items: list[dict],
):
    payload = bytearray()
    payload.extend(_escpos_initialize())
    payload.extend(_escpos_align(1))
    payload.extend(_escpos_bold(True))
    payload.extend(_escpos_size(2, 2))
    payload.extend(_escpos_line(table_name.upper()))
    payload.extend(_escpos_size(1, 1))
    payload.extend(_escpos_feed())
    payload.extend(_escpos_align(0))
    payload.extend(
        _escpos_line(_align_thermal_line("ORDER NO", order_number, TOKEN_LINE_WIDTH))
    )
    payload.extend(
        _escpos_line(
            _align_thermal_line(
                "DATE",
                _format_print_datetime(updated_at),
                TOKEN_LINE_WIDTH,
            )
        )
    )
    payload.extend(
        _escpos_line(_align_thermal_line("SENDER", sender_name.upper(), TOKEN_LINE_WIDTH))
    )
    payload.extend(_escpos_line("-" * TOKEN_LINE_WIDTH))
    payload.extend(_escpos_line(_align_thermal_line("QTY", "ITEM", TOKEN_LINE_WIDTH)))
    payload.extend(_escpos_line("-" * TOKEN_LINE_WIDTH))

    for item in items:
        for line in _wrap_thermal_item_lines(
            f"{int(item.get('qty') or 0)}X",
            item.get("item_name"),
            TOKEN_LINE_WIDTH,
        ):
            payload.extend(_escpos_line(line))
        payload.extend(_escpos_feed())

    payload.extend(_escpos_feed(3))
    payload.extend(_escpos_cut())
    return bytes(payload)


def _build_receipt_print_payload(cursor, bill: dict):
    items = bill.get("items") or []
    receipt_settings = _read_receipt_settings_from_cursor(cursor)
    header_lines = _split_receipt_text_lines(receipt_settings.get("header_text"))
    footer_lines = (
        _split_receipt_text_lines(receipt_settings.get("footer_text"))
        if receipt_settings.get("footer_enabled")
        else []
    )
    title_width, title_height = _get_escpos_font_size(
        receipt_settings.get("title_font_size"),
        18,
    )
    header_width, header_height = _get_escpos_font_size(
        receipt_settings.get("header_font_size"),
        18,
    )
    details_width, details_height = _get_escpos_font_size(
        receipt_settings.get("details_font_size"),
        12,
    )
    item_width, item_height = _get_escpos_font_size(
        receipt_settings.get("item_font_size"),
        13,
    )
    summary_width, summary_height = _get_escpos_font_size(
        receipt_settings.get("summary_font_size"),
        14,
    )
    footer_width, footer_height = _get_escpos_font_size(
        receipt_settings.get("footer_font_size"),
        12,
    )
    payload = bytearray()
    payload.extend(_escpos_initialize())
    payload.extend(_escpos_bold(True))

    if receipt_settings.get("logo_enabled") and receipt_settings.get("logo_image"):
        logo_payload = _build_escpos_logo_payload(
            receipt_settings.get("logo_image"),
            receipt_settings.get("logo_width"),
            receipt_settings.get("logo_size"),
        )

        if logo_payload:
            payload.extend(
                _escpos_align(
                    _get_receipt_alignment_mode(
                        receipt_settings.get("logo_alignment"),
                    )
                )
            )
            payload.extend(logo_payload)
            payload.extend(_escpos_feed())

    if header_lines:
        payload.extend(
            _escpos_align(
                _get_receipt_alignment_mode(receipt_settings.get("header_alignment")),
            )
        )
        payload.extend(_escpos_size(header_width, header_height))

        for line in header_lines:
            payload.extend(_escpos_line(line))

        payload.extend(_escpos_size(1, 1))
        payload.extend(_escpos_feed())

    if receipt_settings.get("title_enabled"):
        payload.extend(_escpos_align(1))
        payload.extend(_escpos_size(title_width, title_height))
        payload.extend(_escpos_line("FINAL BILL"))
        payload.extend(_escpos_size(1, 1))
        payload.extend(_escpos_feed())

    payload.extend(_escpos_align(0))
    payload.extend(_escpos_size(details_width, details_height))

    if receipt_settings.get("details_enabled"):
        payload.extend(
            _escpos_line(_align_thermal_line("RECEIPT", bill.get("bill_number") or "-"))
        )
        payload.extend(
            _escpos_line(_align_thermal_line("TABLE", bill.get("table_name") or "-"))
        )
        payload.extend(
            _escpos_line(
                _align_thermal_line(
                    "DATE",
                    _format_print_datetime(bill.get("created_at")),
                )
            )
        )

    payload.extend(_escpos_size(item_width, item_height))
    payload.extend(_escpos_line("-" * RECEIPT_LINE_WIDTH))
    payload.extend(_escpos_line(_format_receipt_item_heading()))
    payload.extend(_escpos_line("-" * RECEIPT_LINE_WIDTH))

    for item in items:
        for line in _format_receipt_item_rows(
            item.get("item_name"),
            item.get("qty"),
            (_decimal_to_float(item.get("line_total")) or 0)
            if item.get("line_total") is not None
            else (_decimal_to_float(item.get("unit_price")) or 0)
            * float(item.get("qty") or 0),
            wrap_name=receipt_settings.get("item_layout") == "DETAILED",
        ):
            payload.extend(_escpos_line(line))

    payload.extend(_escpos_size(summary_width, summary_height))
    payload.extend(_escpos_line("-" * RECEIPT_LINE_WIDTH))
    payload.extend(_escpos_line(_align_thermal_line("TOTAL", f"{bill.get('total') or 0:.2f}")))

    if footer_lines:
        payload.extend(_escpos_feed())
        payload.extend(
            _escpos_align(
                _get_receipt_alignment_mode(receipt_settings.get("footer_alignment")),
            )
        )
        payload.extend(_escpos_size(footer_width, footer_height))

        for line in footer_lines:
            payload.extend(_escpos_line(line))

        payload.extend(_escpos_size(1, 1))

    payload.extend(_escpos_feed(3))
    payload.extend(_escpos_cut())
    return bytes(payload)


def _serialize_bill_item_row(row):
    return {
        "id": row["id"],
        "product_id": row["product_id"],
        "item_name": row["item_name"],
        "unit_price": _decimal_to_float(row["unit_price"]) or 0,
        "cost_price": _decimal_to_float(row.get("cost_price")) or 0,
        "qty": int(row["qty"] or 0),
        "tax_mode": row["tax_mode"] or "NO_TAX",
        "printer_name": row["printer_name"],
        "printer_target": row["printer_target"],
        "line_total": _decimal_to_float(row["line_total"]) or 0,
    }


def _read_bill_row(cursor, bill_id: int):
    cursor.execute(
        """
        SELECT
            id,
            bill_number,
            table_id,
            table_name,
            floor_name,
            customer_paid,
            cash_paid,
            card_paid,
            upi_paid,
            subtotal,
            total,
            balance,
            payment_method,
            print_enabled,
            stock_applied,
            created_at,
            is_deleted,
            deleted_at,
            deleted_by_user_id,
            deleted_by_username,
            edited_at,
            edited_by_user_id,
            edited_by_username
        FROM sale_bills
        WHERE id=%s
        """,
        (bill_id,),
    )
    return cursor.fetchone()


def _read_bill_items(cursor, bill_id: int):
    cursor.execute(
        """
        SELECT
            id,
            product_id,
            item_name,
            unit_price,
            cost_price,
            qty,
            tax_mode,
            printer_name,
            printer_target,
            line_total
        FROM sale_bill_items
        WHERE bill_id=%s
        ORDER BY id
        """,
        (bill_id,),
    )
    return cursor.fetchall()


def _get_billed_sale_from_cursor(cursor, bill_id: int):
    bill_row = _read_bill_row(cursor, bill_id)

    if not bill_row:
        return None

    bill = _serialize_bill_row(bill_row)
    bill["items"] = [
        _serialize_bill_item_row(row) for row in _read_bill_items(cursor, bill_id)
    ]
    return bill


def _insert_bill_history(
    cursor,
    bill_id: int,
    action_type: str,
    snapshot: dict,
    actor_user_id=None,
    actor_username=None,
):
    cursor.execute(
        """
        INSERT INTO sale_bill_history (
            bill_id,
            action_type,
            snapshot_json,
            changed_by_user_id,
            changed_by_username
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            bill_id,
            action_type,
            json.dumps(snapshot),
            _normalize_user_id(actor_user_id),
            _normalize_actor_username(actor_username),
        ),
    )


def _serialize_bill_history_row(row):
    try:
        snapshot = json.loads(row["snapshot_json"] or "{}")
    except json.JSONDecodeError:
        snapshot = {}

    return {
        "id": row["id"],
        "bill_id": row["bill_id"],
        "action_type": row["action_type"] or "EDITED",
        "changed_at": _serialize_datetime(row["changed_at"]),
        "changed_by_user_id": row["changed_by_user_id"],
        "changed_by_username": row["changed_by_username"],
        "snapshot": snapshot if isinstance(snapshot, dict) else {},
    }


def _collect_product_qty_by_id(items):
    quantities = {}

    for item in items or []:
        product_id = _normalize_user_id(item.get("product_id"))

        if product_id is None:
            continue

        try:
            qty = round(float(item.get("qty") or 0), 3)
        except (TypeError, ValueError):
            qty = 0

        if qty <= 0:
            continue

        quantities[product_id] = round(quantities.get(product_id, 0) + qty, 3)

    return quantities


def _build_stock_quantity_deltas(previous_items, next_items):
    previous_quantities = _collect_product_qty_by_id(previous_items)
    next_quantities = _collect_product_qty_by_id(next_items)
    product_ids = set(previous_quantities) | set(next_quantities)
    quantity_deltas = {}

    for product_id in product_ids:
        quantity_delta = round(
            previous_quantities.get(product_id, 0) - next_quantities.get(product_id, 0),
            3,
        )

        if quantity_delta != 0:
            quantity_deltas[product_id] = quantity_delta

    return quantity_deltas


def _attach_cost_prices(cursor, items):
    normalized_items = [dict(item) for item in items or []]
    product_ids = {
        _normalize_user_id(item.get("product_id"))
        for item in normalized_items
        if _normalize_user_id(item.get("product_id")) is not None
    }

    if not product_ids:
        for item in normalized_items:
            item["cost_price"] = 0
        return normalized_items

    placeholders = ", ".join(["%s"] * len(product_ids))
    cursor.execute(
        f"""
        SELECT id, cost_price
        FROM stock_products
        WHERE id IN ({placeholders})
        """,
        tuple(product_ids),
    )
    cost_by_product_id = {
        row["id"]: round(_decimal_to_float(row["cost_price"]) or 0, 2)
        for row in cursor.fetchall()
    }

    for item in normalized_items:
        product_id = _normalize_user_id(item.get("product_id"))
        item["cost_price"] = round(cost_by_product_id.get(product_id, 0), 2)

    return normalized_items


def _build_bill_stock_note(action: str, bill_number: str | None = None, table_name: str | None = None):
    reference = (bill_number or table_name or "sale").strip()
    return f"{action} {reference}".strip()


def _apply_stock_quantity_deltas(
    cursor,
    quantity_deltas: dict[int, float],
    note: str,
    ignore_missing_for_positive: bool = False,
):
    normalized_deltas = {}

    for product_id, quantity_delta in (quantity_deltas or {}).items():
        normalized_product_id = _normalize_user_id(product_id)

        if normalized_product_id is None:
            continue

        try:
            normalized_delta = round(float(quantity_delta), 3)
        except (TypeError, ValueError):
            continue

        if normalized_delta == 0:
            continue

        normalized_deltas[normalized_product_id] = round(
            normalized_deltas.get(normalized_product_id, 0) + normalized_delta,
            3,
        )

    if not normalized_deltas:
        return None

    placeholders = ", ".join(["%s"] * len(normalized_deltas))
    cursor.execute(
        f"""
        SELECT id, name, current_stock_qty
        FROM stock_products
        WHERE id IN ({placeholders})
        FOR UPDATE
        """,
        tuple(normalized_deltas),
    )
    products = {row["id"]: row for row in cursor.fetchall()}
    blocking_missing_products = []

    for product_id, quantity_delta in normalized_deltas.items():
        if product_id in products:
            continue

        if ignore_missing_for_positive and quantity_delta > 0:
            continue

        blocking_missing_products.append(product_id)

    if blocking_missing_products:
        return {"error": "One or more products in this sale are no longer available in stock"}

    next_stock_quantities = {}

    for product_id, quantity_delta in normalized_deltas.items():
        product = products.get(product_id)

        if not product:
            continue

        current_stock_qty = _decimal_to_float(product["current_stock_qty"]) or 0
        next_stock_qty = round(current_stock_qty + quantity_delta, 3)

        next_stock_quantities[product_id] = next_stock_qty

    for product_id, quantity_delta in normalized_deltas.items():
        next_stock_qty = next_stock_quantities.get(product_id)

        if next_stock_qty is None:
            continue

        cursor.execute(
            "UPDATE stock_products SET current_stock_qty=%s WHERE id=%s",
            (next_stock_qty, product_id),
        )
        cursor.execute(
            """
            INSERT INTO stock_movements (
                product_id,
                movement_type,
                quantity_change,
                balance_after,
                note
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                product_id,
                "IN" if quantity_delta > 0 else "OUT",
                quantity_delta,
                next_stock_qty,
                note,
            ),
        )

    return None


def _normalize_items(items):
    normalized_items = []

    for item in items:
        item_name = item.item_name.strip()

        if not item_name:
            continue

        try:
            qty = int(item.qty)
        except (TypeError, ValueError):
            qty = 0

        if qty <= 0:
            continue

        try:
            unit_price = round(float(item.unit_price), 2)
        except (TypeError, ValueError):
            unit_price = 0

        tax_mode = item.tax_mode if item.tax_mode in VALID_TAX_MODES else "NO_TAX"
        printer_name = item.printer_name.strip() if item.printer_name else None
        printer_target = item.printer_target.strip() if item.printer_target else None
        created_by_user_id = _normalize_user_id(
            getattr(item, "created_by_user_id", None)
        )
        created_by_username = (
            item.created_by_username.strip()
            if getattr(item, "created_by_username", None)
            else None
        )
        sale_item_id = _normalize_user_id(getattr(item, "sale_item_id", None))

        normalized_items.append(
            {
                "sale_item_id": sale_item_id,
                "product_id": item.product_id,
                "item_name": item_name,
                "unit_price": unit_price,
                "qty": qty,
                "tax_mode": tax_mode,
                "printer_name": printer_name or None,
                "printer_target": printer_target or None,
                "created_by_user_id": created_by_user_id,
                "created_by_username": created_by_username or None,
                "line_total": round(unit_price * qty, 2),
            }
        )

    return normalized_items


def _sale_item_key(
    product_id,
    item_name: str,
    created_by_user_id=None,
    created_by_username: str | None = None,
):
    normalized_name = item_name.strip().lower()
    normalized_owner_name = (created_by_username or "").strip().lower()
    normalized_owner_id = _normalize_user_id(created_by_user_id) or 0
    return f"{product_id or 0}:{normalized_name}:{normalized_owner_id}:{normalized_owner_name}"


def _consume_existing_sale_item(
    existing_items_by_id: dict[int, dict],
    existing_items_by_key: dict[str, list[dict]],
    item: dict,
):
    sale_item_id = item.get("sale_item_id")

    if sale_item_id and sale_item_id in existing_items_by_id:
        existing_item = existing_items_by_id.pop(sale_item_id)
        item_key = _sale_item_key(
            existing_item["product_id"],
            existing_item["item_name"],
            existing_item.get("created_by_user_id"),
            existing_item.get("created_by_username"),
        )
        existing_items_by_key[item_key] = [
            row for row in existing_items_by_key.get(item_key, []) if row["id"] != sale_item_id
        ]
        return existing_item

    item_key = _sale_item_key(
        item["product_id"],
        item["item_name"],
        item.get("created_by_user_id"),
        item.get("created_by_username"),
    )
    matching_items = existing_items_by_key.get(item_key, [])

    if not matching_items:
        return None

    existing_item = matching_items.pop(0)
    existing_items_by_id.pop(existing_item["id"], None)
    return existing_item


def _validate_locked_kot_items(existing_items: list[dict], normalized_items: list[dict]):
    existing_totals_by_key: dict[str, dict] = {}
    requested_qty_by_key: dict[str, int] = {}

    for item in existing_items:
        item_key = _sale_item_key(
            item["product_id"],
            item["item_name"],
            item.get("created_by_user_id"),
            item.get("created_by_username"),
        )
        bucket = existing_totals_by_key.setdefault(
            item_key,
            {
                "item_name": item["item_name"],
                "printed_qty": 0,
            },
        )
        bucket["printed_qty"] += int(item.get("kot_printed_qty") or 0)

    for item in normalized_items:
        item_key = _sale_item_key(
            item["product_id"],
            item["item_name"],
            item.get("created_by_user_id"),
            item.get("created_by_username"),
        )
        requested_qty_by_key[item_key] = requested_qty_by_key.get(item_key, 0) + int(
            item.get("qty") or 0
        )

    for item_key, item_summary in existing_totals_by_key.items():
        printed_qty = int(item_summary["printed_qty"] or 0)

        if printed_qty <= 0:
            continue

        requested_qty = requested_qty_by_key.get(item_key, 0)

        if requested_qty <= 0:
            return {
                "error": (
                    f"{item_summary['item_name']} already sent to token. "
                    "Remove is not allowed; finalize bill instead."
                )
            }

        if requested_qty < printed_qty:
            return {
                "error": (
                    f"{item_summary['item_name']} already sent to token. "
                    f"Quantity cannot be less than {printed_qty}."
                )
            }

    return None


def _get_order_status(total_units: int, pending_units: int):
    if total_units <= 0:
        return "VACANT"

    return "OCCUPIED"


def _serialize_bill_row(row):
    total = _decimal_to_float(row["total"]) or 0
    customer_paid = _decimal_to_float(row["customer_paid"])
    balance = _decimal_to_float(row["balance"])
    cash_paid = _decimal_to_float(row.get("cash_paid")) or 0
    card_paid = _decimal_to_float(row.get("card_paid")) or 0
    upi_paid = _decimal_to_float(row.get("upi_paid")) or 0
    payment_method = row["payment_method"] or "CASH"
    is_deleted = bool(row.get("is_deleted"))
    deleted_at = _serialize_datetime(row.get("deleted_at"))
    edited_at = _serialize_datetime(row.get("edited_at"))

    if customer_paid and cash_paid == 0 and card_paid == 0 and upi_paid == 0:
        if payment_method == "CARD":
            card_paid = customer_paid
        elif payment_method == "UPI":
            upi_paid = customer_paid
        else:
            cash_paid = customer_paid

    return {
        "id": row["id"],
        "bill_number": row["bill_number"] or _build_bill_number(row["id"]),
        "table_id": row["table_id"],
        "table_name": row["table_name"],
        "floor_name": row["floor_name"],
        "customer_paid": customer_paid,
        "cash_paid": cash_paid,
        "card_paid": card_paid,
        "upi_paid": upi_paid,
        "subtotal": _decimal_to_float(row["subtotal"]) or total,
        "total": total,
        "balance": balance,
        "payment_method": payment_method,
        "print_enabled": bool(row["print_enabled"]),
        "created_at": _serialize_datetime(row["created_at"]),
        "is_deleted": is_deleted,
        "is_edited": bool(row.get("edited_at")),
        "change_state": "DELETED" if is_deleted else "EDITED" if row.get("edited_at") else "ACTIVE",
        "deleted_at": deleted_at,
        "deleted_by_user_id": row.get("deleted_by_user_id"),
        "deleted_by_username": row.get("deleted_by_username"),
        "edited_at": edited_at,
        "edited_by_user_id": row.get("edited_by_user_id"),
        "edited_by_username": row.get("edited_by_username"),
    }


def _get_sale_summary(cursor, table_id: int):
    cursor.execute(
        """
        SELECT
            s.id,
            s.table_id,
            s.order_number,
            s.customer_paid,
            s.created_at,
            s.updated_at,
            t.name AS table_name,
            f.name AS floor_name,
            COALESCE(SUM(i.qty), 0) AS units,
            COALESCE(COUNT(i.id), 0) AS line_count,
            COALESCE(SUM(i.line_total), 0) AS total,
            COALESCE(
                SUM(
                    CASE
                        WHEN COALESCE(NULLIF(TRIM(i.printer_target), ''), NULL) IS NOT NULL
                            THEN GREATEST(i.qty - COALESCE(i.kot_printed_qty, 0), 0)
                        ELSE 0
                    END
                ),
                0
            ) AS pending_units
        FROM sale_orders s
        LEFT JOIN sale_order_items i ON i.sale_id = s.id
        LEFT JOIN tables t ON t.id = s.table_id
        LEFT JOIN floors f ON f.id = t.floor_id
        WHERE s.table_id = %s
        GROUP BY
            s.id,
            s.table_id,
            s.order_number,
            s.customer_paid,
            s.created_at,
            s.updated_at,
            t.name,
            f.name
        """,
        (table_id,),
    )
    row = cursor.fetchone()

    if not row:
        return None

    total = _decimal_to_float(row["total"]) or 0
    customer_paid = _decimal_to_float(row["customer_paid"])
    units = int(row["units"] or 0)
    pending_units = int(row["pending_units"] or 0)

    return {
        "id": row["id"],
        "table_id": row["table_id"],
        "order_number": row["order_number"] or _build_order_number(row["id"]),
        "table_name": row["table_name"],
        "floor_name": row["floor_name"],
        "customer_paid": customer_paid,
        "lines": int(row["line_count"] or 0),
        "units": units,
        "pending_units": pending_units,
        "status": _get_order_status(units, pending_units),
        "subtotal": total,
        "total": total,
        "balance": None
        if customer_paid is None
        else round(customer_paid - total, 2),
        "created_at": _serialize_datetime(row["created_at"]),
        "updated_at": _serialize_datetime(row["updated_at"]),
    }


def _read_pending_kot_items(cursor, sale_id: int):
    cursor.execute(
        """
        SELECT
            id,
            item_name,
            qty,
            tax_mode,
            printer_name,
            printer_target,
            COALESCE(kot_printed_qty, 0) AS kot_printed_qty
        FROM sale_order_items
        WHERE sale_id=%s
          AND qty > COALESCE(kot_printed_qty, 0)
        ORDER BY id
        """,
        (sale_id,),
    )
    return cursor.fetchall()


def _prepare_pending_kot_print(
    cursor,
    summary: dict,
    pending_items: list[dict],
    sender_name: str | None = None,
):
    token_pending_items = [
        item for item in pending_items if _item_requires_kot(item)
    ]
    grouped_items = _group_pending_kot_items(cursor, token_pending_items)
    system_printed = False

    if token_pending_items and grouped_items:
        normalized_sender = _sanitize_thermal_text(sender_name) or "STAFF"

        for group in grouped_items:
            print_result = _send_bytes_to_printer(
                group["printer_target"],
                _build_token_print_payload(
                    summary["table_name"] or f"TABLE {summary['table_id']}",
                    summary.get("order_number") or _build_order_number(summary["id"]),
                    summary.get("updated_at") or datetime.now(),
                    normalized_sender,
                    group["items"],
                ),
            )

            if print_result.get("error"):
                return print_result

        system_printed = True
    elif not token_pending_items:
        system_printed = True

    return {
        "token_pending_items": token_pending_items,
        "printer_groups": grouped_items,
        "system_printed": system_printed,
    }


def get_open_sales():
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                s.id,
                s.table_id,
                s.order_number,
                s.customer_paid,
                s.created_at,
                s.updated_at,
                t.name AS table_name,
                f.name AS floor_name,
                COALESCE(SUM(i.qty), 0) AS units,
                COALESCE(COUNT(i.id), 0) AS line_count,
                COALESCE(SUM(i.line_total), 0) AS total,
                COALESCE(
                    SUM(
                        CASE
                            WHEN COALESCE(NULLIF(TRIM(i.printer_target), ''), NULL) IS NOT NULL
                                THEN GREATEST(i.qty - COALESCE(i.kot_printed_qty, 0), 0)
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_units
            FROM sale_orders s
            LEFT JOIN sale_order_items i ON i.sale_id = s.id
            LEFT JOIN tables t ON t.id = s.table_id
            LEFT JOIN floors f ON f.id = t.floor_id
            GROUP BY
                s.id,
                s.table_id,
                s.order_number,
                s.customer_paid,
                s.created_at,
                s.updated_at,
                t.name,
                f.name
            ORDER BY s.updated_at DESC, t.name ASC
            """
        )
        rows = cursor.fetchall()
        sales = []

        for row in rows:
            total = _decimal_to_float(row["total"]) or 0
            customer_paid = _decimal_to_float(row["customer_paid"])
            units = int(row["units"] or 0)
            pending_units = int(row["pending_units"] or 0)
            sales.append(
                {
                    "id": row["id"],
                    "table_id": row["table_id"],
                    "order_number": row["order_number"] or _build_order_number(row["id"]),
                    "table_name": row["table_name"],
                    "floor_name": row["floor_name"],
                    "customer_paid": customer_paid,
                    "lines": int(row["line_count"] or 0),
                    "units": units,
                    "pending_units": pending_units,
                    "status": _get_order_status(units, pending_units),
                    "subtotal": total,
                    "total": total,
                    "balance": None
                    if customer_paid is None
                    else round(customer_paid - total, 2),
                    "created_at": _serialize_datetime(row["created_at"]),
                    "updated_at": _serialize_datetime(row["updated_at"]),
                }
            )

        return sales
    finally:
        cursor.close()
        db.close()


def get_billed_sales(
    date_from: str | None = None,
    date_to: str | None = None,
    bill_number: str | None = None,
    payment_method: str | None = None,
    bill_number_exact: bool = False,
    change_filter: str | None = None,
    limit: int | None = None,
):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        query = """
            SELECT
                id,
                bill_number,
                table_id,
                table_name,
                floor_name,
                customer_paid,
                cash_paid,
                card_paid,
                upi_paid,
                subtotal,
                total,
                balance,
                payment_method,
                print_enabled,
                created_at,
                is_deleted,
                deleted_at,
                deleted_by_user_id,
                deleted_by_username,
                edited_at,
                edited_by_user_id,
                edited_by_username
            FROM sale_bills
            WHERE 1 = 1
        """
        params = []
        normalized_change_filter = _normalize_bill_change_filter(change_filter)

        if normalized_change_filter == "DELETED":
            query += " AND is_deleted = 1"
        elif normalized_change_filter == "EDITED":
            query += " AND is_deleted = 0 AND edited_at IS NOT NULL"
        elif normalized_change_filter != "ALL":
            query += " AND is_deleted = 0"

        normalized_bill_number = (bill_number or "").strip()
        if normalized_bill_number:
            if bill_number_exact:
                query += " AND bill_number = %s"
                params.append(normalized_bill_number)
            else:
                query += " AND bill_number LIKE %s"
                params.append(f"%{normalized_bill_number}%")
        else:
            parsed_from = _parse_history_date(date_from)
            if parsed_from is not None:
                query += " AND created_at >= %s"
                params.append(parsed_from.strftime("%Y-%m-%d 00:00:00"))

            parsed_to = _parse_history_date(date_to)
            if parsed_to is not None:
                next_day = parsed_to + timedelta(days=1)
                query += " AND created_at < %s"
                params.append(next_day.strftime("%Y-%m-%d 00:00:00"))

            normalized_payment_method = _normalize_payment_filter(payment_method)
            if normalized_payment_method:
                query += " AND payment_method = %s"
                params.append(normalized_payment_method)

        query += " ORDER BY created_at DESC, id DESC"
        normalized_limit = None

        if limit is not None:
            try:
                normalized_limit = max(int(limit), 0)
            except (TypeError, ValueError):
                normalized_limit = None

        if normalized_limit:
            query += " LIMIT %s"
            params.append(normalized_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        return [_serialize_bill_row(row) for row in rows]
    finally:
        cursor.close()
        db.close()


def get_sales_reports(
    date_from: str | None = None,
    date_to: str | None = None,
    table_id: int | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_inventory_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        parsed_date_from = _parse_datetime_filter(date_from)
        parsed_date_to = _parse_datetime_filter(date_to)
        normalized_table_id = _normalize_user_id(table_id)
        normalized_category_id = _normalize_user_id(category_id)
        normalized_product_id = _normalize_user_id(product_id)
        sales_filters = ["b.is_deleted = 0"]
        sales_params = []

        if parsed_date_from is not None:
            sales_filters.append("b.created_at >= %s")
            sales_params.append(parsed_date_from.strftime("%Y-%m-%d %H:%M:%S"))

        if parsed_date_to is not None:
            sales_filters.append("b.created_at <= %s")
            sales_params.append(parsed_date_to.strftime("%Y-%m-%d %H:%M:%S"))

        if normalized_table_id is not None:
            sales_filters.append("b.table_id = %s")
            sales_params.append(normalized_table_id)

        if normalized_category_id is not None:
            sales_filters.append("c.id = %s")
            sales_params.append(normalized_category_id)

        if normalized_product_id is not None:
            sales_filters.append("bi.product_id = %s")
            sales_params.append(normalized_product_id)

        sales_where_clause = " AND ".join(sales_filters)
        sales_base_query = f"""
            FROM sale_bill_items bi
            JOIN sale_bills b ON b.id = bi.bill_id
            LEFT JOIN stock_products p ON p.id = bi.product_id
            LEFT JOIN stock_categories c ON c.id = p.category_id
            WHERE {sales_where_clause}
        """

        cursor.execute(
            f"""
            SELECT
                COUNT(DISTINCT bi.bill_id) AS total_bills,
                COALESCE(SUM(bi.qty), 0) AS total_units,
                COALESCE(SUM(bi.line_total), 0) AS total_sales
            {sales_base_query}
            """,
            tuple(sales_params),
        )
        summary_row = cursor.fetchone() or {}
        total_bills = int(summary_row.get("total_bills") or 0)
        total_units = int(summary_row.get("total_units") or 0)
        total_sales = round(_decimal_to_float(summary_row.get("total_sales")) or 0, 2)

        cursor.execute(
            f"""
            SELECT
                bi.product_id,
                COALESCE(p.name, bi.item_name) AS item_name,
                c.id AS category_id,
                COALESCE(c.name, 'Uncategorized') AS category_name,
                COALESCE(SUM(bi.qty), 0) AS total_qty,
                COALESCE(SUM(bi.line_total), 0) AS total_sales
            {sales_base_query}
            GROUP BY bi.product_id, p.name, bi.item_name, c.id, c.name
            ORDER BY total_sales DESC, item_name ASC
            """,
            tuple(sales_params),
        )
        item_wise_rows = cursor.fetchall()

        cursor.execute(
            f"""
            SELECT
                c.id AS category_id,
                COALESCE(c.name, 'Uncategorized') AS category_name,
                COALESCE(SUM(bi.qty), 0) AS total_qty,
                COALESCE(SUM(bi.line_total), 0) AS total_sales
            {sales_base_query}
            GROUP BY c.id, c.name
            ORDER BY total_sales DESC, category_name ASC
            """,
            tuple(sales_params),
        )
        category_wise_rows = cursor.fetchall()

        cursor.execute(
            f"""
            SELECT
                b.id,
                b.bill_number,
                b.created_at,
                b.table_name,
                b.floor_name,
                b.payment_method,
                COALESCE(SUM(bi.qty), 0) AS total_qty,
                COALESCE(SUM(bi.line_total), 0) AS matched_total,
                MAX(b.total) AS bill_total,
                MAX(COALESCE(b.cash_paid, 0)) AS cash_paid,
                MAX(COALESCE(b.card_paid, 0)) AS card_paid,
                MAX(COALESCE(b.upi_paid, 0)) AS upi_paid
            {sales_base_query}
            GROUP BY
                b.id,
                b.bill_number,
                b.created_at,
                b.table_name,
                b.floor_name,
                b.payment_method
            ORDER BY b.created_at DESC, b.id DESC
            """,
            tuple(sales_params),
        )
        bill_wise_rows = cursor.fetchall()

        has_item_filter = (
            normalized_category_id is not None or normalized_product_id is not None
        )
        total_cash_paid = 0.0
        total_card_paid = 0.0
        total_upi_paid = 0.0
        total_cash_method_sales = 0.0
        total_card_method_sales = 0.0
        total_upi_method_sales = 0.0
        total_mixed_sales = 0.0

        for row in bill_wise_rows:
            bill_total = round(_decimal_to_float(row.get("bill_total")) or 0, 2)
            matched_total = round(_decimal_to_float(row.get("matched_total")) or 0, 2)

            if not has_item_filter:
                factor = 1
            elif bill_total > 0:
                factor = min(max(matched_total / bill_total, 0), 1)
            else:
                factor = 0

            total_cash_paid += (round(_decimal_to_float(row.get("cash_paid")) or 0, 2)) * factor
            total_card_paid += (round(_decimal_to_float(row.get("card_paid")) or 0, 2)) * factor
            total_upi_paid += (round(_decimal_to_float(row.get("upi_paid")) or 0, 2)) * factor

            payment_method = (row.get("payment_method") or "CASH").upper()
            weighted_bill_total = bill_total * factor

            if payment_method == "CARD":
                total_card_method_sales += weighted_bill_total
            elif payment_method == "UPI":
                total_upi_method_sales += weighted_bill_total
            elif payment_method == "MIXED":
                total_mixed_sales += weighted_bill_total
            else:
                total_cash_method_sales += weighted_bill_total

        total_cash_paid = round(total_sales - round(total_upi_paid, 2) - round(total_card_paid, 2), 2)

        expense_where_clause, expense_params = _build_expense_query_filters(
            parsed_date_from=parsed_date_from,
            parsed_date_to=parsed_date_to,
        )
        cursor.execute(
            f"""
            SELECT
                COUNT(*) AS total_expenses,
                COALESCE(SUM(se.amount), 0) AS total_expense
            FROM sale_expenses se
            WHERE {expense_where_clause}
            """,
            tuple(expense_params),
        )
        expense_summary_row = cursor.fetchone() or {}
        total_expense = round(
            _decimal_to_float(expense_summary_row.get("total_expense")) or 0,
            2,
        )

        cursor.execute(
            f"""
            SELECT
                se.id,
                se.expense_date,
                se.expense_at,
                se.amount,
                se.details,
                se.created_by_user_id,
                se.created_by_username,
                se.edited_at,
                se.edited_by_user_id,
                se.edited_by_username,
                se.updated_at
            FROM sale_expenses se
            WHERE {expense_where_clause}
            ORDER BY se.expense_at DESC, se.id DESC
            """,
            tuple(expense_params),
        )
        expense_rows = cursor.fetchall()

        cash_closing_filters = ["1 = 1"]
        cash_closing_params = []

        if parsed_date_from is not None:
            cash_closing_filters.append("scc.business_date >= %s")
            cash_closing_params.append(parsed_date_from.date().isoformat())

        if parsed_date_to is not None:
            cash_closing_filters.append("scc.business_date <= %s")
            cash_closing_params.append(parsed_date_to.date().isoformat())

        cash_closing_where_clause = " AND ".join(cash_closing_filters)
        cursor.execute(
            f"""
            SELECT
                COUNT(*) AS cash_entry_count,
                COALESCE(SUM(scc.cash_in_hand), 0) AS total_cash_in_hand,
                COALESCE(SUM(scc.entered_cash), 0) AS total_entered_cash,
                COALESCE(SUM(scc.entered_upi), 0) AS total_entered_upi,
                COALESCE(SUM(scc.entered_card), 0) AS total_entered_card
            FROM sale_cash_closing scc
            WHERE {cash_closing_where_clause}
            """,
            tuple(cash_closing_params),
        )
        cash_closing_summary_row = cursor.fetchone() or {}
        cash_entry_count = int(cash_closing_summary_row.get("cash_entry_count") or 0)
        total_cash_in_hand = round(
            _decimal_to_float(cash_closing_summary_row.get("total_cash_in_hand")) or 0,
            2,
        )
        total_entered_cash = round(
            _decimal_to_float(cash_closing_summary_row.get("total_entered_cash")) or 0,
            2,
        )
        total_entered_upi = round(
            _decimal_to_float(cash_closing_summary_row.get("total_entered_upi")) or 0,
            2,
        )
        total_entered_card = round(
            _decimal_to_float(cash_closing_summary_row.get("total_entered_card")) or 0,
            2,
        )
        total_entered_amount = round(
            total_entered_cash + total_entered_upi + total_entered_card,
            2,
        )
        if total_entered_amount <= 0 and total_cash_in_hand > 0:
            total_entered_cash = total_cash_in_hand
            total_entered_amount = total_cash_in_hand

        close_cash_sales_filters = ["sb.is_deleted = 0"]
        close_cash_sales_params = []

        if parsed_date_from is not None:
            close_cash_sales_filters.append("sb.created_at >= %s")
            close_cash_sales_params.append(
                parsed_date_from.strftime("%Y-%m-%d %H:%M:%S")
            )

        if parsed_date_to is not None:
            close_cash_sales_filters.append("sb.created_at <= %s")
            close_cash_sales_params.append(parsed_date_to.strftime("%Y-%m-%d %H:%M:%S"))

        close_cash_sales_where_clause = " AND ".join(close_cash_sales_filters)
        cursor.execute(
            f"""
            SELECT COALESCE(SUM(sb.total), 0) AS total_sales
            FROM sale_bills sb
            WHERE {close_cash_sales_where_clause}
            """,
            tuple(close_cash_sales_params),
        )
        close_cash_sales_row = cursor.fetchone() or {}
        close_cash_total_sales = round(
            _decimal_to_float(close_cash_sales_row.get("total_sales")) or 0,
            2,
        )
        expected_cash_after_expense = round(
            close_cash_total_sales - total_expense,
            2,
        )
        cash_tally_difference = (
            round(
                close_cash_total_sales
                - total_expense
                - total_entered_amount,
                2,
            )
            if cash_entry_count > 0
            else None
        )

        if cash_entry_count <= 0:
            cash_tally_status = "PENDING"
        elif abs(cash_tally_difference or 0) < 0.01:
            cash_tally_status = "TALLY"
        elif (cash_tally_difference or 0) > 0:
            cash_tally_status = "MISSING"
        else:
            cash_tally_status = "EXCESS"

        stock_filters = ["1 = 1"]
        stock_params = []

        if normalized_category_id is not None:
            stock_filters.append("c.id = %s")
            stock_params.append(normalized_category_id)

        if normalized_product_id is not None:
            stock_filters.append("p.id = %s")
            stock_params.append(normalized_product_id)

        stock_where_clause = " AND ".join(stock_filters)
        cursor.execute(
            f"""
            SELECT
                p.id AS product_id,
                p.name AS item_name,
                p.category_id,
                c.name AS category_name,
                p.current_stock_qty,
                p.sale_price
            FROM stock_products p
            JOIN stock_categories c ON c.id = p.category_id
            WHERE {stock_where_clause}
            ORDER BY c.name ASC, p.name ASC
            """,
            tuple(stock_params),
        )
        stock_rows = cursor.fetchall()

        return {
            "filters": {
                "date_from": parsed_date_from.strftime("%Y-%m-%d %H:%M:%S")
                if parsed_date_from
                else None,
                "date_to": parsed_date_to.strftime("%Y-%m-%d %H:%M:%S")
                if parsed_date_to
                else None,
                "table_id": normalized_table_id,
                "category_id": normalized_category_id,
                "product_id": normalized_product_id,
            },
            "summary": {
                "total_bills": total_bills,
                "total_units": total_units,
                "total_sales": total_sales,
                "total_cash_paid": round(total_cash_paid, 2),
                "total_card_paid": round(total_card_paid, 2),
                "total_upi_paid": round(total_upi_paid, 2),
                "total_cash_method_sales": round(total_cash_method_sales, 2),
                "total_card_method_sales": round(total_card_method_sales, 2),
                "total_upi_method_sales": round(total_upi_method_sales, 2),
                "total_mixed_sales": round(total_mixed_sales, 2),
                "total_expense": total_expense,
                "expense_count": int(expense_summary_row.get("total_expenses") or 0),
                "total_cash_in_hand": total_cash_in_hand,
                "total_entered_cash": total_entered_cash,
                "total_entered_upi": total_entered_upi,
                "total_entered_card": total_entered_card,
                "total_entered_amount": total_entered_amount,
                "cash_closing_count": cash_entry_count,
                "close_cash_total_sales": close_cash_total_sales,
                "close_cash_difference": cash_tally_difference,
                "close_cash_status": cash_tally_status,
                "cash_tally_difference": cash_tally_difference,
                "cash_tally_status": cash_tally_status,
                "expected_cash_after_expense": expected_cash_after_expense,
                "average_bill_value": round(total_sales / total_bills, 2)
                if total_bills
                else 0,
            },
            "item_wise_sales": [
                {
                    "product_id": row["product_id"],
                    "item_name": row["item_name"],
                    "category_id": row["category_id"],
                    "category_name": row["category_name"],
                    "total_qty": int(row["total_qty"] or 0),
                    "total_sales": round(_decimal_to_float(row["total_sales"]) or 0, 2),
                }
                for row in item_wise_rows
            ],
            "category_wise_sales": [
                {
                    "category_id": row["category_id"],
                    "category_name": row["category_name"],
                    "total_qty": int(row["total_qty"] or 0),
                    "total_sales": round(_decimal_to_float(row["total_sales"]) or 0, 2),
                }
                for row in category_wise_rows
            ],
            "bill_wise_sales": [
                {
                    "bill_id": row["id"],
                    "bill_number": row["bill_number"] or _build_bill_number(row["id"]),
                    "created_at": _serialize_datetime(row["created_at"]),
                    "table_name": row["table_name"],
                    "floor_name": row["floor_name"],
                    "payment_method": row["payment_method"] or "CASH",
                    "total_qty": int(row["total_qty"] or 0),
                    "matched_total": round(_decimal_to_float(row["matched_total"]) or 0, 2),
                    "bill_total": round(_decimal_to_float(row["bill_total"]) or 0, 2),
                    "cash_paid": round(_decimal_to_float(row["cash_paid"]) or 0, 2),
                    "card_paid": round(_decimal_to_float(row["card_paid"]) or 0, 2),
                    "upi_paid": round(_decimal_to_float(row["upi_paid"]) or 0, 2),
                }
                for row in bill_wise_rows
            ],
            "daily_expenses": [
                _serialize_sale_expense_row(row) for row in expense_rows
            ],
            "current_stock_report": [
                {
                    "product_id": row["product_id"],
                    "item_name": row["item_name"],
                    "category_id": row["category_id"],
                    "category_name": row["category_name"],
                    "current_stock_qty": round(
                        _decimal_to_float(row["current_stock_qty"]) or 0,
                        3,
                    ),
                    "sale_price": round(_decimal_to_float(row["sale_price"]) or 0, 2),
                    "stock_value": round(
                        (float(_decimal_to_float(row["current_stock_qty"]) or 0))
                        * (float(_decimal_to_float(row["sale_price"]) or 0)),
                        2,
                    ),
                }
                for row in stock_rows
            ],
        }
    finally:
        cursor.close()
        db.close()


def get_billed_sale(bill_id: int):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        bill = _get_billed_sale_from_cursor(cursor, bill_id)

        if not bill:
            return {"error": "Bill not found"}

        return bill
    finally:
        cursor.close()
        db.close()


def get_sale_expenses(expense_date: str | None = None):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        selected_date = _parse_expense_date(expense_date) or datetime.now().date()
        expense_where_clause, expense_params = _build_expense_query_filters(
            expense_date_value=selected_date,
        )

        cursor.execute(
            f"""
            SELECT
                COUNT(*) AS total_expenses,
                COALESCE(SUM(se.amount), 0) AS total_amount
            FROM sale_expenses se
            WHERE {expense_where_clause}
            """,
            tuple(expense_params),
        )
        summary_row = cursor.fetchone() or {}
        total_sales_for_date = _get_total_sales_for_business_date(cursor, selected_date)

        cursor.execute(
            f"""
            SELECT
                se.id,
                se.expense_date,
                se.expense_at,
                se.amount,
                se.details,
                se.created_by_user_id,
                se.created_by_username,
                se.edited_at,
                se.edited_by_user_id,
                se.edited_by_username,
                se.updated_at
            FROM sale_expenses se
            WHERE {expense_where_clause}
            ORDER BY se.expense_at DESC, se.id DESC
            """,
            tuple(expense_params),
        )
        rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                se.details,
                COUNT(*) AS usage_count,
                MAX(se.updated_at) AS last_used_at
            FROM sale_expenses se
            WHERE TRIM(COALESCE(se.details, '')) <> ''
            GROUP BY se.details
            ORDER BY usage_count DESC, last_used_at DESC, se.details ASC
            LIMIT 100
            """
        )
        detail_rows = cursor.fetchall()

        cash_closing_row = _read_cash_closing_row_for_date(cursor, selected_date)

        return {
            "expense_date": selected_date.isoformat(),
            "summary": {
                "entry_count": int(summary_row.get("total_expenses") or 0),
                "total_amount": round(
                    _decimal_to_float(summary_row.get("total_amount")) or 0,
                    2,
                ),
                "total_sales": total_sales_for_date,
            },
            "detail_options": [
                row.get("details")
                for row in detail_rows
                if (row.get("details") or "").strip()
            ],
            "cash_closing": _serialize_sale_cash_closing_row(
                cash_closing_row,
                total_sales=total_sales_for_date,
                total_expense=round(
                    _decimal_to_float(summary_row.get("total_amount")) or 0,
                    2,
                ),
            ),
            "rows": [_serialize_sale_expense_row(row) for row in rows],
        }
    finally:
        cursor.close()
        db.close()


def save_sale_expense(payload: SaleExpenseSaveRequest):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        amount = _normalize_expense_amount(payload.amount)
        details = _normalize_expense_details(payload.details)
        actor_user_id = _normalize_user_id(getattr(payload, "actor_user_id", None))
        actor_username = _normalize_actor_username(
            getattr(payload, "actor_username", None)
        )
        actor_role = _normalize_actor_role(getattr(payload, "actor_role", None))

        if amount is None:
            return {"error": "Enter a valid expense amount"}

        if not details:
            return {"error": "Enter expense details"}

        expense_date_value, expense_at_value = _resolve_expense_datetime(
            getattr(payload, "expense_date", None),
            getattr(payload, "expense_time", None),
        )

        if (
            not _is_admin_actor(actor_role)
            and _is_cash_closed_row(
                _read_cash_closing_row_for_date(cursor, expense_date_value),
            )
        ):
            return {
                "error": (
                    "Cash already closed for this date. Only admin can add or edit expenses now."
                )
            }

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO sale_expenses (
                expense_date,
                expense_at,
                amount,
                details,
                created_by_user_id,
                created_by_username
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                expense_date_value.isoformat(),
                expense_at_value.strftime("%Y-%m-%d %H:%M:%S"),
                amount,
                details,
                actor_user_id,
                actor_username,
            ),
        )
        expense_id = cursor.lastrowid
        db.commit()

        cursor.close()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                id,
                expense_date,
                expense_at,
                amount,
                details,
                created_by_user_id,
                created_by_username,
                edited_at,
                edited_by_user_id,
                edited_by_username,
                updated_at
            FROM sale_expenses
            WHERE id=%s
            """,
            (expense_id,),
        )
        expense_row = cursor.fetchone()
        return _serialize_sale_expense_row(expense_row or {})
    finally:
        cursor.close()
        db.close()


def save_sale_cash_closing(payload: SaleCashClosingSaveRequest):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        business_date = _parse_expense_date(getattr(payload, "business_date", None))
        actor_user_id = _normalize_user_id(getattr(payload, "actor_user_id", None))
        actor_username = _normalize_actor_username(
            getattr(payload, "actor_username", None)
        )
        actor_role = _normalize_actor_role(getattr(payload, "actor_role", None))
        entered_cash = _normalize_customer_paid(getattr(payload, "entered_cash", 0) or 0)
        entered_upi = _normalize_customer_paid(getattr(payload, "entered_upi", 0) or 0)
        entered_card = _normalize_customer_paid(getattr(payload, "entered_card", 0) or 0)
        legacy_cash_in_hand = _normalize_customer_paid(getattr(payload, "cash_in_hand", None))

        if business_date is None:
            return {"error": "Enter a valid business date"}

        if entered_cash is None:
            return {"error": "Enter a valid cash amount"}

        if entered_upi is None:
            return {"error": "Enter a valid UPI amount"}

        if entered_card is None:
            return {"error": "Enter a valid card amount"}

        if (
            getattr(payload, "entered_cash", None) is None
            and getattr(payload, "entered_upi", None) is None
            and getattr(payload, "entered_card", None) is None
        ):
            if legacy_cash_in_hand is None:
                return {"error": "Enter valid close-cash amounts"}

            entered_cash = legacy_cash_in_hand
            entered_upi = 0
            entered_card = 0

        cash_in_hand = round(entered_cash + entered_upi + entered_card, 2)

        existing_closing_row = _read_cash_closing_row_for_date(cursor, business_date)

        if _is_cash_closed_row(existing_closing_row) and not _is_admin_actor(actor_role):
            return {"error": "Cash already closed for this date"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO sale_cash_closing (
                business_date,
                cash_in_hand,
                entered_cash,
                entered_upi,
                entered_card,
                is_closed,
                closed_at,
                closed_by_user_id,
                closed_by_username,
                updated_by_user_id,
                updated_by_username
            )
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                cash_in_hand=VALUES(cash_in_hand),
                entered_cash=VALUES(entered_cash),
                entered_upi=VALUES(entered_upi),
                entered_card=VALUES(entered_card),
                is_closed=VALUES(is_closed),
                closed_at=COALESCE(sale_cash_closing.closed_at, CURRENT_TIMESTAMP),
                closed_by_user_id=VALUES(closed_by_user_id),
                closed_by_username=VALUES(closed_by_username),
                updated_by_user_id=VALUES(updated_by_user_id),
                updated_by_username=VALUES(updated_by_username)
            """,
            (
                business_date.isoformat(),
                cash_in_hand,
                entered_cash,
                entered_upi,
                entered_card,
                1,
                actor_user_id,
                actor_username,
                actor_user_id,
                actor_username,
            ),
        )
        db.commit()

        cursor.close()
        cursor = db.cursor(dictionary=True)
        closing_row = _read_cash_closing_row_for_date(cursor, business_date)
        total_sales_for_date = _get_total_sales_for_business_date(cursor, business_date)
        cursor.execute(
            """
            SELECT COALESCE(SUM(amount), 0) AS total_amount
            FROM sale_expenses
            WHERE expense_date=%s
            """,
            (business_date.isoformat(),),
        )
        expense_summary_row = cursor.fetchone() or {}
        response_payload = _serialize_sale_cash_closing_row(
            closing_row,
            total_sales=total_sales_for_date,
            total_expense=round(
                _decimal_to_float(expense_summary_row.get("total_amount")) or 0,
                2,
            ),
        )
        response_payload["message"] = "Cash closed successfully"

        date_from, date_to = _build_cash_close_report_window(business_date)
        from app.services.reports import (
            send_daily_sales_full_report_to_default_recipients,
        )

        email_result = send_daily_sales_full_report_to_default_recipients(
            date_from,
            date_to,
        )

        if email_result.get("error"):
            response_payload["report_email_warning"] = email_result["error"]
        else:
            response_payload["report_email_message"] = email_result.get("message")

        return response_payload
    finally:
        cursor.close()
        db.close()


def update_sale_expense(expense_id: int, payload: SaleExpenseSaveRequest):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM sale_expenses WHERE id=%s", (expense_id,))
        expense_row = cursor.fetchone()

        if not expense_row:
            return {"error": "Expense entry not found"}

        amount = _normalize_expense_amount(payload.amount)
        details = _normalize_expense_details(payload.details)
        actor_user_id = _normalize_user_id(getattr(payload, "actor_user_id", None))
        actor_username = _normalize_actor_username(
            getattr(payload, "actor_username", None)
        )
        actor_role = _normalize_actor_role(getattr(payload, "actor_role", None))

        if amount is None:
            return {"error": "Enter a valid expense amount"}

        if not details:
            return {"error": "Enter expense details"}

        expense_date_value, expense_at_value = _resolve_expense_datetime(
            getattr(payload, "expense_date", None),
            getattr(payload, "expense_time", None),
        )

        if (
            not _is_admin_actor(actor_role)
            and _is_cash_closed_row(
                _read_cash_closing_row_for_date(cursor, expense_date_value),
            )
        ):
            return {
                "error": (
                    "Cash already closed for this date. Only admin can add or edit expenses now."
                )
            }

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE sale_expenses
            SET
                expense_date=%s,
                expense_at=%s,
                amount=%s,
                details=%s,
                edited_at=CURRENT_TIMESTAMP,
                edited_by_user_id=%s,
                edited_by_username=%s
            WHERE id=%s
            """,
            (
                expense_date_value.isoformat(),
                expense_at_value.strftime("%Y-%m-%d %H:%M:%S"),
                amount,
                details,
                actor_user_id,
                actor_username,
                expense_id,
            ),
        )
        db.commit()

        cursor.close()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                id,
                expense_date,
                expense_at,
                amount,
                details,
                created_by_user_id,
                created_by_username,
                edited_at,
                edited_by_user_id,
                edited_by_username,
                updated_at
            FROM sale_expenses
            WHERE id=%s
            """,
            (expense_id,),
        )
        updated_row = cursor.fetchone()
        return _serialize_sale_expense_row(updated_row or {})
    finally:
        cursor.close()
        db.close()


def print_main_bill(bill_id: int):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_inventory_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        bill = _get_billed_sale_from_cursor(cursor, bill_id)

        if not bill:
            return {"error": "Bill not found"}

        main_printer = _build_main_bill_printer(cursor)

        if not main_printer:
            return {"error": "No main bill printer configured"}

        print_result = _send_bytes_to_printer(
            main_printer["target"],
            _build_receipt_print_payload(cursor, bill),
        )

        if print_result.get("error"):
            return print_result

        return {
            "message": "Bill sent to main printer",
            "system_printed": True,
            "printer_name": main_printer["name"],
            "printer_target": main_printer["target"],
            "bill_id": bill["id"],
            "bill_number": bill["bill_number"],
        }
    finally:
        cursor.close()
        db.close()


def get_billed_sale_history(bill_id: int):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM sale_bills WHERE id=%s", (bill_id,))

        if not cursor.fetchone():
            return {"error": "Bill not found"}

        cursor.execute(
            """
            SELECT
                id,
                bill_id,
                action_type,
                snapshot_json,
                changed_by_user_id,
                changed_by_username,
                changed_at
            FROM sale_bill_history
            WHERE bill_id=%s
            ORDER BY changed_at DESC, id DESC
            """,
            (bill_id,),
        )
        return [_serialize_bill_history_row(row) for row in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()


def get_sale_for_table(table_id: int):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        summary = _get_sale_summary(cursor, table_id)

        if not summary:
            cursor.execute(
                """
                SELECT
                    created_at,
                    table_name,
                    floor_name
                FROM sale_bills
                WHERE table_id=%s
                  AND (is_deleted = 0 OR is_deleted IS NULL)
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """,
                (table_id,),
            )
            latest_bill = cursor.fetchone()
            latest_bill_timestamp = (
                _serialize_datetime(latest_bill["created_at"])
                if latest_bill and latest_bill.get("created_at")
                else None
            )
            return {
                "id": None,
                "table_id": table_id,
                "order_number": None,
                "table_name": latest_bill["table_name"] if latest_bill else None,
                "floor_name": latest_bill["floor_name"] if latest_bill else None,
                "customer_paid": None,
                "lines": 0,
                "units": 0,
                "pending_units": 0,
                "status": "VACANT",
                "subtotal": 0,
                "total": 0,
                "balance": None,
                "items": [],
                "created_at": latest_bill_timestamp,
                "updated_at": latest_bill_timestamp,
            }

        cursor.execute(
            """
            SELECT
                id,
                product_id,
                item_name,
                unit_price,
                qty,
                tax_mode,
                printer_name,
                printer_target,
                line_total,
                COALESCE(kot_printed_qty, 0) AS kot_printed_qty,
                created_by_user_id,
                created_by_username
            FROM sale_order_items
            WHERE sale_id = %s
            ORDER BY id
            """,
            (summary["id"],),
        )
        rows = cursor.fetchall()
        summary["items"] = [
            {
                "id": row["id"],
                "product_id": row["product_id"],
                "item_name": row["item_name"],
                "unit_price": _decimal_to_float(row["unit_price"]) or 0,
                "qty": int(row["qty"] or 0),
                "tax_mode": row["tax_mode"] or "NO_TAX",
                "printer_name": row["printer_name"],
                "printer_target": row["printer_target"],
                "line_total": _decimal_to_float(row["line_total"]) or 0,
                "kot_printed_qty": int(row["kot_printed_qty"] or 0),
                "created_by_user_id": row["created_by_user_id"],
                "created_by_username": row["created_by_username"],
                "pending_qty": max(
                    int(row["qty"] or 0) - int(row["kot_printed_qty"] or 0),
                    0,
                )
                if _item_requires_kot(row)
                else 0,
            }
            for row in rows
        ]

        return summary
    finally:
        cursor.close()
        db.close()


def save_sale_for_table(table_id: int, payload: SaleSaveRequest):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM tables WHERE id=%s", (table_id,))
        table_row = cursor.fetchone()

        if not table_row:
            return {"error": "Table not found"}

        normalized_items = _normalize_items(payload.items)
        customer_paid = _normalize_customer_paid(payload.customer_paid)

        cursor.execute(
            "SELECT id, order_number FROM sale_orders WHERE table_id=%s",
            (table_id,),
        )
        existing_sale = cursor.fetchone()

        if not normalized_items:
            if existing_sale:
                sale_id = existing_sale["id"]
                cursor.execute(
                    """
                    SELECT
                        id,
                        product_id,
                        item_name,
                        qty,
                        COALESCE(kot_printed_qty, 0) AS kot_printed_qty,
                        created_by_user_id,
                        created_by_username
                    FROM sale_order_items
                    WHERE sale_id=%s
                    """,
                    (sale_id,),
                )
                existing_items = cursor.fetchall()
                locked_item_error = _validate_locked_kot_items(existing_items, [])

                if locked_item_error:
                    return locked_item_error

                cursor.execute("DELETE FROM sale_order_items WHERE sale_id=%s", (sale_id,))
                cursor.execute("DELETE FROM sale_orders WHERE id=%s", (sale_id,))
                db.commit()
                publish_table_sale_event(table_id, "cleared")

            return {"message": "Sale cleared"}

        if existing_sale:
            sale_id = existing_sale["id"]
            order_number = existing_sale.get("order_number") or _build_order_number(
                sale_id,
            )
            if existing_sale.get("order_number") != order_number:
                cursor.execute(
                    "UPDATE sale_orders SET order_number=%s, customer_paid=%s WHERE id=%s",
                    (order_number, customer_paid, sale_id),
                )
            else:
                cursor.execute(
                    "UPDATE sale_orders SET customer_paid=%s WHERE id=%s",
                    (customer_paid, sale_id),
                )
            cursor.execute(
                """
                SELECT
                    id,
                    product_id,
                    item_name,
                    qty,
                    COALESCE(kot_printed_qty, 0) AS kot_printed_qty,
                    created_by_user_id,
                    created_by_username
                FROM sale_order_items
                WHERE sale_id=%s
                """,
                (sale_id,),
            )
            existing_items = cursor.fetchall()
            existing_items_by_id = {item["id"]: item for item in existing_items}
            existing_items_by_key = {}
            for item in existing_items:
                item_key = _sale_item_key(
                    item["product_id"],
                    item["item_name"],
                    item.get("created_by_user_id"),
                    item.get("created_by_username"),
                )
                existing_items_by_key.setdefault(item_key, []).append(item)
            locked_item_error = _validate_locked_kot_items(
                existing_items,
                normalized_items,
            )

            if locked_item_error:
                return locked_item_error

            cursor.execute("DELETE FROM sale_order_items WHERE sale_id=%s", (sale_id,))
        else:
            cursor.execute(
                "INSERT INTO sale_orders (table_id, customer_paid) VALUES (%s, %s)",
                (table_id, customer_paid),
            )
            sale_id = cursor.lastrowid
            order_number = _build_order_number(sale_id)
            cursor.execute(
                "UPDATE sale_orders SET order_number=%s WHERE id=%s",
                (order_number, sale_id),
            )
            existing_items_by_id = {}
            existing_items_by_key = {}

        cursor.executemany(
            """
            INSERT INTO sale_order_items (
                sale_id,
                product_id,
                item_name,
                unit_price,
                qty,
                tax_mode,
                printer_name,
                printer_target,
                created_by_user_id,
                created_by_username,
                line_total,
                kot_printed_qty
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    sale_id,
                    item["product_id"],
                    item["item_name"],
                    item["unit_price"],
                    item["qty"],
                    item["tax_mode"],
                    item["printer_name"],
                    item["printer_target"],
                    item["created_by_user_id"],
                    item["created_by_username"],
                    item["line_total"],
                    min(
                        (
                            _consume_existing_sale_item(
                                existing_items_by_id,
                                existing_items_by_key,
                                item,
                            )
                            or {}
                        ).get("kot_printed_qty", 0),
                        item["qty"],
                    ),
                )
                for item in normalized_items
            ],
        )
        db.commit()

        updated_sale = get_sale_for_table(table_id)
        publish_table_sale_event(table_id, "updated")
        return updated_sale
    finally:
        cursor.close()
        db.close()


def checkout_sale_for_table(table_id: int, payload: SaleCheckoutRequest):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_inventory_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                t.id AS table_id,
                t.name AS table_name,
                f.name AS floor_name
            FROM tables t
            LEFT JOIN floors f ON f.id = t.floor_id
            WHERE t.id=%s
            """,
            (table_id,),
        )
        table_row = cursor.fetchone()

        if not table_row:
            return {"error": "Table not found"}

        cursor.execute(
            """
            SELECT
                s.id,
                s.order_number,
                s.customer_paid,
                %s AS table_id,
                %s AS table_name,
                %s AS floor_name
            FROM sale_orders s
            WHERE s.table_id=%s
            """,
            (
                table_row["table_id"],
                table_row["table_name"],
                table_row["floor_name"],
                table_id,
            ),
        )
        sale_row = cursor.fetchone()

        normalized_payload_items = _normalize_items(payload.items)

        if normalized_payload_items:
            items = normalized_payload_items
        elif sale_row:
            cursor.execute(
                """
                SELECT
                    product_id,
                    item_name,
                    unit_price,
                    qty,
                    tax_mode,
                    printer_name,
                    printer_target,
                    line_total
                FROM sale_order_items
                WHERE sale_id=%s
                ORDER BY id
                """,
                (sale_row["id"],),
            )
            items = cursor.fetchall()
        else:
            items = []

        if not items:
            return {"error": "No bill items found"}

        total = round(
            sum(_decimal_to_float(item["line_total"]) or 0 for item in items),
            2,
        )
        payment_values = _resolve_payment_values(
            payload,
            _decimal_to_float(sale_row["customer_paid"]) if sale_row else None,
            total,
        )

        if payment_values["customer_paid"] <= 0 and total > 0:
            return {"error": "Enter payment amount before saving bill"}

        if payment_values["customer_paid"] < total:
            return {"error": "Payment is less than bill total"}

        order_number = None
        if sale_row:
            order_number = sale_row.get("order_number") or _build_order_number(
                sale_row["id"],
            )

        if sale_row and _is_auto_kot_enabled(cursor):
            summary = _get_sale_summary(cursor, table_id)
            pending_items = _read_pending_kot_items(cursor, sale_row["id"])
            auto_kot_result = _prepare_pending_kot_print(
                cursor,
                summary,
                pending_items,
                sender_name=getattr(payload, "actor_username", None)
                or getattr(payload, "actor_role", None)
                or "BILLING",
            )

            if auto_kot_result.get("error"):
                return auto_kot_result

            token_pending_items = auto_kot_result["token_pending_items"]

            if token_pending_items:
                cursor.close()
                cursor = db.cursor()
                cursor.executemany(
                    "UPDATE sale_order_items SET kot_printed_qty = qty WHERE id=%s",
                    [(item["id"],) for item in token_pending_items],
                )
                db.commit()
                publish_table_sale_event(table_id, "kot")
                cursor.close()
                cursor = db.cursor(dictionary=True)

        stock_deltas = _build_stock_quantity_deltas([], items)

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO sale_bills (
                bill_number,
                table_id,
                table_name,
                floor_name,
                customer_paid,
                cash_paid,
                card_paid,
                upi_paid,
                subtotal,
                total,
                balance,
                payment_method,
                print_enabled,
                stock_applied
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                order_number,
                table_row["table_id"],
                table_row["table_name"],
                table_row["floor_name"],
                payment_values["customer_paid"],
                payment_values["cash_paid"],
                payment_values["card_paid"],
                payment_values["upi_paid"],
                total,
                total,
                payment_values["balance"],
                payment_values["payment_method"],
                1 if payload.print_enabled else 0,
                0,
            ),
        )
        bill_id = cursor.lastrowid
        bill_number = order_number or _build_order_number(bill_id)
        if not order_number:
            cursor.execute(
                "UPDATE sale_bills SET bill_number=%s WHERE id=%s",
                (bill_number, bill_id),
            )

        cursor.close()
        cursor = db.cursor(dictionary=True)
        stock_error = _apply_stock_quantity_deltas(
            cursor,
            stock_deltas,
            _build_bill_stock_note(
                "Sale checkout",
                bill_number=bill_number,
                table_name=table_row["table_name"],
            ),
        )

        if stock_error:
            db.rollback()
            return stock_error

        cursor.close()
        cursor = db.cursor(dictionary=True)
        items_with_cost = _attach_cost_prices(cursor, items)

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE sale_bills SET stock_applied=1 WHERE id=%s",
            (bill_id,),
        )

        cursor.executemany(
            """
            INSERT INTO sale_bill_items (
                bill_id,
                product_id,
                item_name,
                unit_price,
                cost_price,
                qty,
                tax_mode,
                printer_name,
                printer_target,
                line_total
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    bill_id,
                    item["product_id"],
                    item["item_name"],
                    _decimal_to_float(item["unit_price"]) or 0,
                    _decimal_to_float(item.get("cost_price")) or 0,
                    int(item["qty"] or 0),
                    item["tax_mode"] or "NO_TAX",
                    item["printer_name"],
                    item["printer_target"],
                    _decimal_to_float(item["line_total"]) or 0,
                )
                for item in items_with_cost
            ],
        )
        if sale_row:
            cursor.execute(
                "DELETE FROM sale_order_items WHERE sale_id=%s",
                (sale_row["id"],),
            )
            cursor.execute(
                "DELETE FROM sale_orders WHERE id=%s",
                (sale_row["id"],),
            )
        db.commit()

        cursor.close()
        cursor = db.cursor(dictionary=True)
        bill_snapshot = _get_billed_sale_from_cursor(cursor, bill_id)

        cursor.close()
        cursor = db.cursor()
        _insert_bill_history(cursor, bill_id, "CREATED", bill_snapshot)
        db.commit()
        publish_table_sale_event(table_id, "checked_out")

        return bill_snapshot
    finally:
        cursor.close()
        db.close()


def update_billed_sale(bill_id: int, payload: SaleBillUpdateRequest):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_inventory_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                bill_number,
                created_at,
                customer_paid,
                print_enabled,
                is_deleted,
                stock_applied
            FROM sale_bills
            WHERE id=%s
            """,
            (bill_id,),
        )
        bill_row = cursor.fetchone()

        if not bill_row:
            return {"error": "Bill not found"}

        if bill_row["is_deleted"]:
            return {"error": "Deleted bill cannot be edited"}

        normalized_items = _normalize_items(payload.items)

        if not normalized_items:
            return {"error": "No bill items found"}

        existing_bill_items = _read_bill_items(cursor, bill_id)
        total = round(sum(item["line_total"] for item in normalized_items), 2)
        payment_values = _resolve_payment_values(
            payload,
            _decimal_to_float(bill_row["customer_paid"]),
            total,
        )

        if payment_values["customer_paid"] <= 0 and total > 0:
            return {"error": "Enter payment amount before saving bill"}

        if payment_values["customer_paid"] < total:
            return {"error": "Payment is less than bill total"}

        actor_user_id = _normalize_user_id(getattr(payload, "actor_user_id", None))
        actor_username = _normalize_actor_username(
            getattr(payload, "actor_username", None)
        )
        actor_role = _normalize_actor_role(getattr(payload, "actor_role", None))

        bill_created_at = _parse_datetime_filter(_serialize_datetime(bill_row.get("created_at")))

        if (
            bill_created_at
            and not _is_admin_actor(actor_role)
            and _is_cash_closed_row(
                _read_cash_closing_row_for_date(cursor, bill_created_at.date()),
            )
        ):
            return {
                "error": (
                    "Cash already closed for this bill date. Only admin can edit this bill now."
                )
            }

        stock_applied = bool(bill_row.get("stock_applied"))
        stock_deltas = (
            _build_stock_quantity_deltas(existing_bill_items, normalized_items)
            if stock_applied
            else {}
        )

        cursor.close()
        cursor = db.cursor(dictionary=True)
        stock_error = _apply_stock_quantity_deltas(
            cursor,
            stock_deltas,
            _build_bill_stock_note(
                "Bill edited",
                bill_number=bill_row["bill_number"] or _build_bill_number(bill_id),
            ),
            ignore_missing_for_positive=True,
        )

        if stock_error:
            return stock_error

        cursor.close()
        cursor = db.cursor(dictionary=True)
        normalized_items_with_cost = _attach_cost_prices(cursor, normalized_items)

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE sale_bills
            SET
                customer_paid=%s,
                cash_paid=%s,
                card_paid=%s,
                upi_paid=%s,
                subtotal=%s,
                total=%s,
                balance=%s,
                payment_method=%s,
                print_enabled=%s,
                edited_at=CURRENT_TIMESTAMP,
                edited_by_user_id=%s,
                edited_by_username=%s
            WHERE id=%s
            """,
            (
                payment_values["customer_paid"],
                payment_values["cash_paid"],
                payment_values["card_paid"],
                payment_values["upi_paid"],
                total,
                total,
                payment_values["balance"],
                payment_values["payment_method"],
                1 if payload.print_enabled else 0,
                actor_user_id,
                actor_username,
                bill_id,
            ),
        )
        cursor.execute("DELETE FROM sale_bill_items WHERE bill_id=%s", (bill_id,))
        cursor.executemany(
            """
            INSERT INTO sale_bill_items (
                bill_id,
                product_id,
                item_name,
                unit_price,
                cost_price,
                qty,
                tax_mode,
                printer_name,
                printer_target,
                line_total
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    bill_id,
                    item["product_id"],
                    item["item_name"],
                    item["unit_price"],
                    item.get("cost_price") or 0,
                    item["qty"],
                    item["tax_mode"],
                    item["printer_name"],
                    item["printer_target"],
                    item["line_total"],
                )
                for item in normalized_items_with_cost
            ],
        )
        cursor.close()
        cursor = db.cursor(dictionary=True)
        bill_snapshot = _get_billed_sale_from_cursor(cursor, bill_id)

        cursor.close()
        cursor = db.cursor()
        _insert_bill_history(
            cursor,
            bill_id,
            "EDITED",
            bill_snapshot,
            actor_user_id=actor_user_id,
            actor_username=actor_username,
        )
        db.commit()

        return bill_snapshot
    finally:
        cursor.close()
        db.close()


def update_billed_sale_payment_method(
    bill_id: int,
    payload: SaleBillPaymentMethodUpdateRequest,
):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        bill_row = _read_bill_row(cursor, bill_id)

        if not bill_row:
            return {"error": "Bill not found"}

        if bill_row["is_deleted"]:
            return {"error": "Deleted bill cannot be edited"}

        actor_role = _normalize_actor_role(getattr(payload, "actor_role", None))

        bill_created_at = _parse_datetime_filter(
            _serialize_datetime(bill_row.get("created_at"))
        )

        if (
            bill_created_at
            and not _is_admin_actor(actor_role)
            and _is_cash_closed_row(
                _read_cash_closing_row_for_date(cursor, bill_created_at.date()),
            )
        ):
            return {
                "error": (
                    "Cash already closed for this bill date. Only admin can edit this bill now."
                )
            }

        payment_method = _normalize_payment_method(
            getattr(payload, "payment_method", None)
        )

        if payment_method == "MIXED":
            return {"error": "Select Cash, Card, or UPI here"}

        customer_paid = round(
            _decimal_to_float(bill_row.get("customer_paid"))
            or _decimal_to_float(bill_row.get("total"))
            or 0,
            2,
        )
        total = round(_decimal_to_float(bill_row.get("total")) or 0, 2)
        cash_paid = customer_paid if payment_method == "CASH" else 0
        card_paid = customer_paid if payment_method == "CARD" else 0
        upi_paid = customer_paid if payment_method == "UPI" else 0
        balance = round(customer_paid - total, 2)

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE sale_bills
            SET
                customer_paid=%s,
                cash_paid=%s,
                card_paid=%s,
                upi_paid=%s,
                balance=%s,
                payment_method=%s,
                edited_at=NULL,
                edited_by_user_id=NULL,
                edited_by_username=NULL
            WHERE id=%s
            """,
            (
                customer_paid,
                cash_paid,
                card_paid,
                upi_paid,
                balance,
                payment_method,
                bill_id,
            ),
        )

        cursor.close()
        cursor = db.cursor(dictionary=True)
        bill_snapshot = _get_billed_sale_from_cursor(cursor, bill_id)
        db.commit()

        return bill_snapshot
    finally:
        cursor.close()
        db.close()


def delete_billed_sale(bill_id: int, payload):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_inventory_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        bill_row = _read_bill_row(cursor, bill_id)

        if not bill_row:
            return {"error": "Bill not found"}

        if bill_row["is_deleted"]:
            return {"error": "Bill already deleted"}

        bill = _serialize_bill_row(bill_row)
        bill["items"] = [
            _serialize_bill_item_row(row) for row in _read_bill_items(cursor, bill_id)
        ]

        actor_user_id = _normalize_user_id(getattr(payload, "actor_user_id", None))
        actor_username = _normalize_actor_username(
            getattr(payload, "actor_username", None)
        )
        actor_role = _normalize_actor_role(getattr(payload, "actor_role", None))

        if not _is_admin_actor(actor_role):
            return {"error": "Only admin can delete bills"}

        bill_created_at = _parse_datetime_filter(_serialize_datetime(bill_row.get("created_at")))

        if (
            bill_created_at
            and not _is_admin_actor(actor_role)
            and _is_cash_closed_row(
                _read_cash_closing_row_for_date(cursor, bill_created_at.date()),
            )
        ):
            return {
                "error": (
                    "Cash already closed for this bill date. Only admin can delete this bill now."
                )
            }

        stock_applied = bool(bill_row.get("stock_applied"))
        stock_deltas = (
            _build_stock_quantity_deltas(bill["items"], []) if stock_applied else {}
        )

        cursor.close()
        cursor = db.cursor(dictionary=True)
        stock_error = _apply_stock_quantity_deltas(
            cursor,
            stock_deltas,
            _build_bill_stock_note(
                "Bill deleted",
                bill_number=bill_row["bill_number"] or _build_bill_number(bill_id),
            ),
            ignore_missing_for_positive=True,
        )

        if stock_error:
            return stock_error

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            UPDATE sale_bills
            SET
                is_deleted=1,
                deleted_at=CURRENT_TIMESTAMP,
                deleted_by_user_id=%s,
                deleted_by_username=%s
            WHERE id=%s
            """,
            (actor_user_id, actor_username, bill_id),
        )

        cursor.close()
        cursor = db.cursor(dictionary=True)
        bill_snapshot = _get_billed_sale_from_cursor(cursor, bill_id)

        cursor.close()
        cursor = db.cursor()
        _insert_bill_history(
            cursor,
            bill_id,
            "DELETED",
            bill_snapshot,
            actor_user_id=actor_user_id,
            actor_username=actor_username,
        )
        db.commit()

        return bill_snapshot
    finally:
        cursor.close()
        db.close()


def move_sale_to_table(table_id: int, payload: SaleMoveRequest):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        target_table_id = payload.target_table_id

        if target_table_id == table_id:
            return {"error": "Select another table"}

        cursor.execute("SELECT id FROM tables WHERE id=%s", (table_id,))
        source_table = cursor.fetchone()

        if not source_table:
            return {"error": "Current table not found"}

        cursor.execute("SELECT id FROM tables WHERE id=%s", (target_table_id,))
        target_table = cursor.fetchone()

        if not target_table:
            return {"error": "Target table not found"}

        cursor.execute("SELECT id FROM sale_orders WHERE table_id=%s", (table_id,))
        current_sale = cursor.fetchone()

        if not current_sale:
            return {"error": "No order found on this table"}

        cursor.execute(
            "SELECT id FROM sale_orders WHERE table_id=%s",
            (target_table_id,),
        )
        target_sale = cursor.fetchone()

        if target_sale:
            return {"error": "Selected table already has an order"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE sale_orders SET table_id=%s WHERE id=%s",
            (target_table_id, current_sale["id"]),
        )
        db.commit()
        publish_table_sale_events([table_id, target_table_id], "moved")
        return get_sale_for_table(target_table_id)
    finally:
        cursor.close()
        db.close()


def transfer_sale_item_to_table(table_id: int, payload: SaleTransferItemRequest):
    db = get_db()
    _ensure_sales_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        target_table_id = payload.target_table_id

        if target_table_id == table_id:
            return {"error": "Select another table"}

        cursor.execute("SELECT id FROM tables WHERE id=%s", (table_id,))
        if not cursor.fetchone():
            return {"error": "Current table not found"}

        cursor.execute("SELECT id FROM tables WHERE id=%s", (target_table_id,))
        if not cursor.fetchone():
            return {"error": "Target table not found"}

        cursor.execute("SELECT id FROM sale_orders WHERE table_id=%s", (table_id,))
        source_sale = cursor.fetchone()

        if not source_sale:
            return {"error": "No order found on this table"}

        cursor.execute(
            """
            SELECT
                id,
                product_id,
                item_name,
                unit_price,
                qty,
                tax_mode,
                printer_name,
                printer_target,
                line_total,
                COALESCE(kot_printed_qty, 0) AS kot_printed_qty,
                created_by_user_id,
                created_by_username
            FROM sale_order_items
            WHERE sale_id=%s
            ORDER BY id
            """,
            (source_sale["id"],),
        )
        source_items = cursor.fetchall()
        matching_item = next(
            (
                item
                for item in source_items
                if (
                    (
                        payload.product_id is not None
                        and item["product_id"] == payload.product_id
                    )
                    or (
                        payload.product_id is None
                        and item["item_name"].strip().lower()
                        == payload.item_name.strip().lower()
                    )
                )
                and (
                    payload.created_by_user_id is None
                    or _normalize_user_id(item.get("created_by_user_id"))
                    == _normalize_user_id(payload.created_by_user_id)
                )
                and (
                    not payload.created_by_username
                    or (item.get("created_by_username") or "").strip().lower()
                    == payload.created_by_username.strip().lower()
                )
            ),
            None,
        )

        if not matching_item:
            return {"error": "Selected item not found"}

        transfer_qty = min(max(payload.qty, 1), int(matching_item["qty"]))

        cursor.execute(
            "SELECT id FROM sale_orders WHERE table_id=%s",
            (target_table_id,),
        )
        target_sale = cursor.fetchone()

        if target_sale:
            target_sale_id = target_sale["id"]
        else:
            cursor.execute(
                "INSERT INTO sale_orders (table_id, customer_paid) VALUES (%s, NULL)",
                (target_table_id,),
            )
            target_sale_id = cursor.lastrowid

        cursor.execute(
            """
            SELECT
                id,
                qty,
                COALESCE(kot_printed_qty, 0) AS kot_printed_qty,
                created_by_user_id,
                created_by_username
            FROM sale_order_items
            WHERE sale_id=%s
              AND (
                (product_id IS NOT NULL AND product_id = %s)
                OR (product_id IS NULL AND %s IS NULL AND LOWER(TRIM(item_name)) = LOWER(%s))
              )
            """,
            (
                target_sale_id,
                matching_item["product_id"],
                matching_item["product_id"],
                matching_item["item_name"].strip(),
            ),
        )
        target_item = next(
            (
                item
                for item in cursor.fetchall()
                if _normalize_user_id(item.get("created_by_user_id"))
                == _normalize_user_id(matching_item.get("created_by_user_id"))
                and (item.get("created_by_username") or "").strip().lower()
                == (matching_item.get("created_by_username") or "").strip().lower()
            ),
            None,
        )

        printed_qty_to_move = min(
            int(matching_item["kot_printed_qty"] or 0),
            transfer_qty,
        )

        if target_item:
            new_target_qty = int(target_item["qty"]) + transfer_qty
            new_target_printed_qty = int(target_item["kot_printed_qty"]) + printed_qty_to_move
            cursor.execute(
                """
                UPDATE sale_order_items
                SET qty=%s, line_total=%s, kot_printed_qty=%s
                WHERE id=%s
                """,
                (
                    new_target_qty,
                    round(float(matching_item["unit_price"]) * new_target_qty, 2),
                    min(new_target_printed_qty, new_target_qty),
                    target_item["id"],
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO sale_order_items (
                    sale_id,
                    product_id,
                    item_name,
                    unit_price,
                    qty,
                    tax_mode,
                    printer_name,
                    printer_target,
                    created_by_user_id,
                    created_by_username,
                    line_total,
                    kot_printed_qty
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    target_sale_id,
                    matching_item["product_id"],
                    matching_item["item_name"],
                    matching_item["unit_price"],
                    transfer_qty,
                    matching_item["tax_mode"],
                    matching_item["printer_name"],
                    matching_item["printer_target"],
                    matching_item.get("created_by_user_id"),
                    matching_item.get("created_by_username"),
                    round(float(matching_item["unit_price"]) * transfer_qty, 2),
                    printed_qty_to_move,
                ),
            )

        remaining_qty = int(matching_item["qty"]) - transfer_qty
        remaining_printed_qty = max(
            int(matching_item["kot_printed_qty"] or 0) - printed_qty_to_move,
            0,
        )

        if remaining_qty > 0:
            cursor.execute(
                """
                UPDATE sale_order_items
                SET qty=%s, line_total=%s, kot_printed_qty=%s
                WHERE id=%s
                """,
                (
                    remaining_qty,
                    round(float(matching_item["unit_price"]) * remaining_qty, 2),
                    min(remaining_printed_qty, remaining_qty),
                    matching_item["id"],
                ),
            )
        else:
            cursor.execute(
                "DELETE FROM sale_order_items WHERE id=%s",
                (matching_item["id"],),
            )

        cursor.execute(
            "SELECT id FROM sale_order_items WHERE sale_id=%s LIMIT 1",
            (source_sale["id"],),
        )
        if not cursor.fetchone():
            cursor.execute("DELETE FROM sale_orders WHERE id=%s", (source_sale["id"],))

        db.commit()
        source_sale_data = get_sale_for_table(table_id)
        target_sale_data = get_sale_for_table(target_table_id)
        publish_table_sale_events([table_id, target_table_id], "transferred")

        return {
            "message": "Items transferred",
            "source_sale": source_sale_data,
            "target_sale": target_sale_data,
        }
    finally:
        cursor.close()
        db.close()


def print_pending_kot_for_table(table_id: int, sender_name: str | None = None):
    db = get_db()
    _ensure_sales_tables(db)
    _ensure_stock_inventory_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        summary = _get_sale_summary(cursor, table_id)

        if not summary:
            return {"error": "No order found on this table"}

        pending_items = _read_pending_kot_items(cursor, summary["id"])

        if not pending_items:
            return {"error": "No new items for KOT"}

        prepared_kot = _prepare_pending_kot_print(
            cursor,
            summary,
            pending_items,
            sender_name=sender_name,
        )

        if prepared_kot.get("error"):
            return prepared_kot

        token_pending_items = prepared_kot["token_pending_items"]
        grouped_items = prepared_kot["printer_groups"]
        system_printed = prepared_kot["system_printed"]

        cursor.executemany(
            "UPDATE sale_order_items SET kot_printed_qty = qty WHERE id=%s",
            [(item["id"],) for item in token_pending_items],
        )
        if token_pending_items:
            db.commit()

        updated_sale = get_sale_for_table(table_id)
        publish_table_sale_event(table_id, "kot")

        return {
            "table_id": table_id,
            "order_number": updated_sale.get("order_number"),
            "table_name": updated_sale["table_name"],
            "floor_name": updated_sale["floor_name"],
            "status": updated_sale["status"],
            "updated_at": updated_sale["updated_at"],
            "system_printed": system_printed,
            "printer_groups": grouped_items,
            "items": [
                {
                    "item_name": item["item_name"],
                    "qty": max(
                        int(item["qty"] or 0) - int(item["kot_printed_qty"] or 0),
                        0,
                    ),
                    "tax_mode": item["tax_mode"] or "NO_TAX",
                    "printer_name": item["printer_name"],
                    "printer_target": item["printer_target"],
                }
                for item in token_pending_items
            ],
        }
    finally:
        cursor.close()
        db.close()
