import base64
import re
import json
import os
import subprocess
from decimal import Decimal
from uuid import uuid4

from app.core.config import BASE_DIR
from app.db.mysql import get_db
from app.schemas.stock import (
    StockCategoryCreate,
    StockCategoryUpdate,
    StockLoginBrandingUpdate,
    StockMovementCreate,
    StockProductCostUpdate,
    StockPrinterCreate,
    StockReceiptSettingsUpdate,
    StockPrinterUpdate,
    StockProductCreate,
    StockProductUpdate,
)

UPLOADS_DIR = BASE_DIR / "uploads" / "products"
_IMAGE_PATTERN = re.compile(r"^data:(image/[\w.+-]+);base64,(.+)$", re.DOTALL)
_IMAGE_EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}
VALID_TAX_MODES = {"GST_INCLUDED", "NO_TAX"}
VALID_STOCK_MOVEMENT_TYPES = {"IN", "OUT", "OPENING"}
VALID_RECEIPT_ALIGNMENTS = {"LEFT", "CENTER", "RIGHT"}
VALID_RECEIPT_LOGO_SIZES = {"SMALL", "MEDIUM", "LARGE"}
VALID_RECEIPT_ITEM_LAYOUTS = {"COMPACT", "DETAILED"}
DEFAULT_PRODUCT_DISPLAY_POSITION = 9999
DEFAULT_CATEGORY_DISPLAY_POSITION = 9999
_stock_tables_ready = False


def _index_exists(cursor, table_name: str, index_name: str) -> bool:
    cursor.execute(f"SHOW INDEX FROM {table_name} WHERE Key_name = %s", (index_name,))
    rows = cursor.fetchall()
    return bool(rows)


def _ensure_named_index(cursor, table_name: str, index_name: str, columns: str):
    if _index_exists(cursor, table_name, index_name):
        return

    cursor.execute(f"CREATE INDEX {index_name} ON {table_name} ({columns})")


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


def _default_login_branding_settings():
    return {
        "logo_enabled": False,
        "logo_image": None,
        "updated_at": None,
    }


def _ensure_stock_tables(db):
    global _stock_tables_ready

    if _stock_tables_ready:
        return

    cursor = db.cursor(buffered=True)

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS stock_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                display_position INT NOT NULL DEFAULT 9999
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS stock_printers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                target VARCHAR(255) NULL,
                token_print_enabled TINYINT(1) NOT NULL DEFAULT 0,
                main_bill_enabled TINYINT(1) NOT NULL DEFAULT 0
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS stock_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category_id INT NOT NULL,
                display_position INT NOT NULL DEFAULT 9999,
                sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                current_stock_qty DECIMAL(12, 3) NOT NULL DEFAULT 0,
                tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
                tax_mode VARCHAR(50) NOT NULL DEFAULT 'NO_TAX',
                printer_id INT NULL,
                image_path VARCHAR(500) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS stock_movements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                movement_type VARCHAR(50) NOT NULL,
                quantity_change DECIMAL(12, 3) NOT NULL,
                balance_after DECIMAL(12, 3) NOT NULL,
                note VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS stock_receipt_settings (
                id INT PRIMARY KEY,
                auto_kot_enabled TINYINT(1) NOT NULL DEFAULT 0,
                title_enabled TINYINT(1) NOT NULL DEFAULT 0,
                details_enabled TINYINT(1) NOT NULL DEFAULT 1,
                title_font_size VARCHAR(20) NOT NULL DEFAULT '18',
                logo_enabled TINYINT(1) NOT NULL DEFAULT 0,
                logo_image LONGTEXT NULL,
                logo_alignment VARCHAR(20) NOT NULL DEFAULT 'CENTER',
                logo_size VARCHAR(20) NOT NULL DEFAULT 'SMALL',
                logo_width INT NOT NULL DEFAULT 200,
                header_text LONGTEXT NULL,
                header_alignment VARCHAR(20) NOT NULL DEFAULT 'CENTER',
                header_font_size VARCHAR(20) NOT NULL DEFAULT 'LARGE',
                details_font_size VARCHAR(20) NOT NULL DEFAULT 'SMALL',
                item_font_size VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                summary_font_size VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                footer_enabled TINYINT(1) NOT NULL DEFAULT 1,
                footer_text LONGTEXT NULL,
                footer_alignment VARCHAR(20) NOT NULL DEFAULT 'CENTER',
                footer_font_size VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                item_layout VARCHAR(20) NOT NULL DEFAULT 'COMPACT',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS app_login_branding_settings (
                id INT PRIMARY KEY,
                logo_enabled TINYINT(1) NOT NULL DEFAULT 0,
                logo_image LONGTEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute("SHOW COLUMNS FROM stock_products LIKE 'tax_mode'")
        has_tax_mode = cursor.fetchone() is not None
        cursor.execute("SHOW COLUMNS FROM stock_products LIKE 'cost_price'")
        has_cost_price = cursor.fetchone() is not None
        cursor.execute("SHOW COLUMNS FROM stock_products LIKE 'current_stock_qty'")
        has_current_stock_qty = cursor.fetchone() is not None
        cursor.execute("SHOW COLUMNS FROM stock_products LIKE 'display_position'")
        has_display_position = cursor.fetchone() is not None
        cursor.execute("SHOW COLUMNS FROM stock_categories LIKE 'display_position'")
        has_category_display_position = cursor.fetchone() is not None

        cursor.execute("SHOW COLUMNS FROM stock_printers")
        printer_columns = {row[0] for row in cursor.fetchall()}
        cursor.execute("SHOW COLUMNS FROM stock_receipt_settings")
        receipt_setting_columns = {row[0] for row in cursor.fetchall()}

        cursor.execute("SHOW COLUMNS FROM app_login_branding_settings")
        login_branding_columns = {row[0] for row in cursor.fetchall()}

        if "token_print_enabled" not in printer_columns:
            cursor.execute(
                """
                ALTER TABLE stock_printers
                ADD COLUMN token_print_enabled TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "main_bill_enabled" not in printer_columns:
            cursor.execute(
                """
                ALTER TABLE stock_printers
                ADD COLUMN main_bill_enabled TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "title_enabled" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN title_enabled TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "auto_kot_enabled" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN auto_kot_enabled TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "details_enabled" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN details_enabled TINYINT(1) NOT NULL DEFAULT 1
                """
            )

        if "title_font_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN title_font_size VARCHAR(20) NOT NULL DEFAULT '18'
                """
            )

        if "logo_enabled" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN logo_enabled TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "logo_image" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN logo_image LONGTEXT NULL
                """
            )

        if "logo_alignment" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN logo_alignment VARCHAR(20) NOT NULL DEFAULT 'CENTER'
                """
            )

        if "logo_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN logo_size VARCHAR(20) NOT NULL DEFAULT 'SMALL'
                """
            )

        if "logo_width" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN logo_width INT NOT NULL DEFAULT 200
                """
            )

        if "header_text" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN header_text LONGTEXT NULL
                """
            )

        if "header_alignment" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN header_alignment VARCHAR(20) NOT NULL DEFAULT 'CENTER'
                """
            )

        if "header_font_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN header_font_size VARCHAR(20) NOT NULL DEFAULT 'LARGE'
                """
            )

        if "details_font_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN details_font_size VARCHAR(20) NOT NULL DEFAULT 'SMALL'
                """
            )

        if "item_font_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN item_font_size VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                """
            )

        if "summary_font_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN summary_font_size VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                """
            )

        if "footer_enabled" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN footer_enabled TINYINT(1) NOT NULL DEFAULT 1
                """
            )

        if "footer_text" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN footer_text LONGTEXT NULL
                """
            )

        if "footer_alignment" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN footer_alignment VARCHAR(20) NOT NULL DEFAULT 'CENTER'
                """
            )

        if "footer_font_size" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN footer_font_size VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                """
            )

        if "item_layout" not in receipt_setting_columns:
            cursor.execute(
                """
                ALTER TABLE stock_receipt_settings
                ADD COLUMN item_layout VARCHAR(20) NOT NULL DEFAULT 'COMPACT'
                """
            )

        if "logo_enabled" not in login_branding_columns:
            cursor.execute(
                """
                ALTER TABLE app_login_branding_settings
                ADD COLUMN logo_enabled TINYINT(1) NOT NULL DEFAULT 0
                """
            )

        if "logo_image" not in login_branding_columns:
            cursor.execute(
                """
                ALTER TABLE app_login_branding_settings
                ADD COLUMN logo_image LONGTEXT NULL
                """
            )

        if "updated_at" not in login_branding_columns:
            cursor.execute(
                """
                ALTER TABLE app_login_branding_settings
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                """
            )

        if not has_tax_mode:
            cursor.execute(
                """
                ALTER TABLE stock_products
                ADD COLUMN tax_mode VARCHAR(50) NOT NULL DEFAULT 'NO_TAX'
                """
            )
            cursor.execute(
                """
                UPDATE stock_products
                SET tax_mode = CASE
                    WHEN tax_percent > 0 THEN 'GST_INCLUDED'
                    ELSE 'NO_TAX'
                END
                """
            )

        if not has_current_stock_qty:
            cursor.execute(
                """
                ALTER TABLE stock_products
                ADD COLUMN current_stock_qty DECIMAL(12, 3) NOT NULL DEFAULT 0
                """
            )

        if not has_cost_price:
            cursor.execute(
                """
                ALTER TABLE stock_products
                ADD COLUMN cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0
                """
            )

        if not has_display_position:
            cursor.execute(
                f"""
                ALTER TABLE stock_products
                ADD COLUMN display_position INT NOT NULL DEFAULT {DEFAULT_PRODUCT_DISPLAY_POSITION}
                """
            )

        if not has_category_display_position:
            cursor.execute(
                f"""
                ALTER TABLE stock_categories
                ADD COLUMN display_position INT NOT NULL DEFAULT {DEFAULT_CATEGORY_DISPLAY_POSITION}
                """
            )

        _ensure_named_index(
            cursor,
            "stock_categories",
            "idx_stock_categories_name",
            "name",
        )
        _ensure_named_index(
            cursor,
            "stock_categories",
            "idx_stock_categories_position_name",
            "display_position, name",
        )
        _ensure_named_index(
            cursor,
            "stock_products",
            "idx_stock_products_category_position_name",
            "category_id, display_position, name",
        )
        _ensure_named_index(
            cursor,
            "stock_products",
            "idx_stock_products_printer_id",
            "printer_id",
        )
        _ensure_named_index(
            cursor,
            "stock_movements",
            "idx_stock_movements_product_created_at",
            "product_id, created_at",
        )

        db.commit()
        _stock_tables_ready = True
    finally:
        cursor.close()


def _name_exists(cursor, table_name: str, name: str, record_id: int | None = None):
    query = f"SELECT id FROM {table_name} WHERE LOWER(TRIM(name)) = LOWER(%s)"
    params = [name.strip()]

    if record_id is not None:
        query += " AND id != %s"
        params.append(record_id)

    cursor.execute(query, tuple(params))
    return cursor.fetchone() is not None


def _category_exists(cursor, category_id: int):
    cursor.execute("SELECT id FROM stock_categories WHERE id=%s", (category_id,))
    return cursor.fetchone() is not None


def _printer_exists(cursor, printer_id: int):
    cursor.execute("SELECT id FROM stock_printers WHERE id=%s", (printer_id,))
    return cursor.fetchone() is not None


def _save_product_image(image_data: str | None):
    if not image_data:
        return None

    match = _IMAGE_PATTERN.match(image_data.strip())

    if not match:
        raise ValueError("Invalid image data")

    mime_type, encoded_data = match.groups()
    extension = _IMAGE_EXTENSIONS.get(mime_type.lower())

    if not extension:
        raise ValueError("Unsupported image format")

    try:
        image_bytes = base64.b64decode(encoded_data, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid image data") from exc

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}.{extension}"
    file_path = UPLOADS_DIR / filename
    file_path.write_bytes(image_bytes)

    return f"/uploads/products/{filename}"


def _delete_product_image(image_path: str | None):
    if not image_path:
        return

    normalized_path = image_path.lstrip("/")
    file_path = BASE_DIR / normalized_path

    if file_path.exists() and file_path.is_file():
        file_path.unlink()


def _decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _serialize_datetime(value):
    if value is None:
        return None

    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    return value


def _normalize_stock_quantity(value):
    try:
        quantity = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Enter valid stock quantity") from exc

    if quantity < 0:
        raise ValueError("Stock quantity cannot be negative")

    return round(quantity, 3)


def _normalize_stock_movement_type(value: str | None):
    normalized_value = str(value or "").strip().upper()

    if normalized_value in {"IN", "INCREASE", "ADD"}:
        return "IN"

    if normalized_value in {"OUT", "DECREASE", "REMOVE"}:
        return "OUT"

    if normalized_value in VALID_STOCK_MOVEMENT_TYPES:
        return normalized_value

    return None


def _normalize_product_display_position(value):
    if value in {None, ""}:
        return DEFAULT_PRODUCT_DISPLAY_POSITION

    try:
        position = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Enter valid item position") from exc

    if position < 1:
        raise ValueError("Item position must be 1 or more")

    return position


def _normalize_category_display_position(value):
    if value in {None, ""}:
        return DEFAULT_CATEGORY_DISPLAY_POSITION

    try:
        position = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Enter valid category position") from exc

    if position < 1:
        raise ValueError("Category position must be 1 or more") from None

    return position


def _serialize_category_row(category: dict):
    category["display_position"] = int(
        category.get("display_position") or DEFAULT_CATEGORY_DISPLAY_POSITION
    )
    return category


def _serialize_product_row(product: dict):
    product["sale_price"] = _decimal_to_float(product["sale_price"])
    product["cost_price"] = _decimal_to_float(product.get("cost_price")) or 0
    product["final_price"] = _decimal_to_float(product["final_price"])
    product["current_stock_qty"] = _decimal_to_float(product["current_stock_qty"]) or 0
    product["display_position"] = int(
        product.get("display_position") or DEFAULT_PRODUCT_DISPLAY_POSITION
    )
    product["category_display_position"] = int(
        product.get("category_display_position") or DEFAULT_CATEGORY_DISPLAY_POSITION
    )
    return product


def _serialize_stock_movement_row(row: dict):
    return {
        "id": row["id"],
        "product_id": row["product_id"],
        "product_name": row["product_name"],
        "movement_type": row["movement_type"],
        "quantity_change": _decimal_to_float(row["quantity_change"]) or 0,
        "balance_after": _decimal_to_float(row["balance_after"]) or 0,
        "note": row["note"],
        "created_at": _serialize_datetime(row["created_at"]),
    }


def get_categories():
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT id, name, display_position
            FROM stock_categories
            ORDER BY display_position, name
            """
        )
        return [_serialize_category_row(category) for category in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()


def add_category(data: StockCategoryCreate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor()

    try:
        name = data.name.strip()
        display_position = _normalize_category_display_position(data.display_position)

        if not name:
            return {"error": "Enter category name"}

        if _name_exists(cursor, "stock_categories", name):
            return {"error": "Category already exists"}

        cursor.execute(
            "INSERT INTO stock_categories (name, display_position) VALUES (%s, %s)",
            (name, display_position),
        )
        db.commit()

        return {"message": "Category added"}
    except ValueError as exc:
        return {"error": str(exc)}
    finally:
        cursor.close()
        db.close()


def update_category(category_id: int, data: StockCategoryUpdate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM stock_categories WHERE id=%s", (category_id,))
        category = cursor.fetchone()

        if not category:
            return {"error": "Category not found"}

        name = data.name.strip()
        display_position = _normalize_category_display_position(data.display_position)

        if not name:
            return {"error": "Enter category name"}

        cursor.close()
        cursor = db.cursor()

        if _name_exists(cursor, "stock_categories", name, category_id):
            return {"error": "Category already exists"}

        cursor.execute(
            """
            UPDATE stock_categories
            SET name=%s, display_position=%s
            WHERE id=%s
            """,
            (name, display_position, category_id),
        )
        db.commit()

        return {"message": "Category updated"}
    except ValueError as exc:
        return {"error": str(exc)}
    finally:
        cursor.close()
        db.close()


def delete_category(category_id: int):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM stock_categories WHERE id=%s", (category_id,))
        category = cursor.fetchone()

        if not category:
            return {"error": "Category not found"}

        cursor.execute(
            "SELECT id FROM stock_products WHERE category_id=%s LIMIT 1",
            (category_id,),
        )
        if cursor.fetchone():
            return {"error": "Category is used by products"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute("DELETE FROM stock_categories WHERE id=%s", (category_id,))
        db.commit()

        return {"message": "Category deleted"}
    finally:
        cursor.close()
        db.close()


def get_printers():
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                id,
                name,
                target,
                COALESCE(token_print_enabled, 0) AS token_print_enabled,
                COALESCE(main_bill_enabled, 0) AS main_bill_enabled
            FROM stock_printers
            ORDER BY name
            """
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


def get_receipt_settings():
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
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
        defaults = _default_receipt_settings()

        if not row:
            return defaults

        return {
            "auto_kot_enabled": bool(row.get("auto_kot_enabled")),
            "title_enabled": bool(row["title_enabled"]),
            "details_enabled": bool(row["details_enabled"]),
            "title_font_size": _normalize_receipt_font_size(
                row["title_font_size"],
                defaults["title_font_size"],
            ),
            "logo_enabled": bool(row["logo_enabled"]),
            "logo_image": row["logo_image"] or defaults["logo_image"],
            "logo_alignment": _normalize_receipt_alignment(row["logo_alignment"]),
            "logo_size": _normalize_receipt_logo_size(row["logo_size"]),
            "logo_width": _normalize_receipt_logo_width(
                row.get("logo_width"),
                _legacy_receipt_logo_width(row.get("logo_size")),
            ),
            "header_text": row["header_text"] or "",
            "header_alignment": _normalize_receipt_alignment(row["header_alignment"]),
            "header_font_size": _normalize_receipt_font_size(
                row["header_font_size"],
                defaults["header_font_size"],
            ),
            "details_font_size": _normalize_receipt_font_size(
                row["details_font_size"],
                defaults["details_font_size"],
            ),
            "item_font_size": _normalize_receipt_font_size(
                row["item_font_size"],
                defaults["item_font_size"],
            ),
            "summary_font_size": _normalize_receipt_font_size(
                row["summary_font_size"],
                defaults["summary_font_size"],
            ),
            "footer_enabled": bool(row["footer_enabled"]),
            "footer_text": row["footer_text"] or defaults["footer_text"],
            "footer_alignment": _normalize_receipt_alignment(row["footer_alignment"]),
            "footer_font_size": _normalize_receipt_font_size(
                row["footer_font_size"],
                defaults["footer_font_size"],
            ),
            "item_layout": _normalize_receipt_item_layout(row["item_layout"]),
        }
    finally:
        cursor.close()
        db.close()


def get_login_branding_settings():
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                logo_enabled,
                logo_image,
                updated_at
            FROM app_login_branding_settings
            WHERE id=1
            """
        )
        row = cursor.fetchone()
        defaults = _default_login_branding_settings()

        if not row:
            return defaults

        return {
            "logo_enabled": bool(row["logo_enabled"]),
            "logo_image": row["logo_image"] or defaults["logo_image"],
            "updated_at": row["updated_at"],
        }
    finally:
        cursor.close()
        db.close()


def _add_printer_name(
    printers: list[dict],
    seen: set[str],
    raw_name: str,
    *,
    is_default: bool = False,
):
    name = raw_name.strip()

    if not name:
        return

    lowered_name = name.lower()

    if lowered_name in seen:
        if is_default:
            for printer in printers:
                if printer["name"].strip().lower() == lowered_name:
                    printer["is_default"] = True
                    break
        return

    seen.add(lowered_name)
    printers.append({"name": name, "is_default": bool(is_default)})


def _get_windows_system_printers(printers: list[dict], seen: set[str]):
    commands = [
        [
            "powershell",
            "-NoProfile",
            "-Command",
            (
                "Get-CimInstance Win32_Printer | "
                "Select-Object Name,Default | ConvertTo-Json -Compress"
            ),
        ],
        [
            "wmic",
            "printer",
            "get",
            "Name,Default",
            "/format:csv",
        ],
    ]

    for command in commands:
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            continue

        output = (result.stdout or "").strip()

        if not output:
            continue

        if command[0].lower() == "powershell":
            try:
                payload = json.loads(output)
            except json.JSONDecodeError:
                continue

            rows = payload if isinstance(payload, list) else [payload]

            for row in rows:
                if not isinstance(row, dict):
                    continue

                _add_printer_name(
                    printers,
                    seen,
                    str(row.get("Name") or ""),
                    is_default=bool(row.get("Default")),
                )

            if printers:
                return
            continue

        lines = [line.strip() for line in output.splitlines() if line.strip()]

        if len(lines) <= 1:
            continue

        for line in lines[1:]:
            parts = [part.strip() for part in line.split(",")]

            if len(parts) < 3:
                continue

            _add_printer_name(
                printers,
                seen,
                parts[2],
                is_default=parts[1].upper() == "TRUE",
            )

        if printers:
            return


def get_system_printers():
    printers: list[dict] = []
    seen: set[str] = set()

    if os.name == "nt":
        _get_windows_system_printers(printers, seen)
        printers.sort(
            key=lambda printer: (
                not printer.get("is_default", False),
                printer["name"].lower(),
            )
        )
        return printers

    commands = [
        ["lpstat", "-e"],
        ["lpstat", "-p"],
        ["lpstat", "-a"],
    ]

    for command in commands:
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            continue

        output = result.stdout.strip()

        if not output:
            continue

        for line in output.splitlines():
            cleaned_line = line.strip()

            if not cleaned_line:
                continue

            if command[1] == "-e":
                _add_printer_name(printers, seen, cleaned_line)
                continue

            if cleaned_line.startswith("printer "):
                parts = cleaned_line.split()
                if len(parts) >= 2:
                    _add_printer_name(printers, seen, parts[1])
                continue

            if cleaned_line.startswith("lpstat:"):
                continue

            _add_printer_name(printers, seen, cleaned_line.split()[0])

    printers.sort(
        key=lambda printer: (
            not printer.get("is_default", False),
            printer["name"].lower(),
        )
    )
    return printers


def _normalize_printer_modes(token_print_enabled: bool, main_bill_enabled: bool):
    main_bill_enabled = bool(main_bill_enabled)
    token_print_enabled = bool(token_print_enabled) and not main_bill_enabled
    return token_print_enabled, main_bill_enabled


def _normalize_receipt_alignment(value: str | None):
    normalized_value = str(value or "CENTER").strip().upper()

    if normalized_value not in VALID_RECEIPT_ALIGNMENTS:
        return "CENTER"

    return normalized_value


def _normalize_receipt_logo_size(value: str | None):
    normalized_value = str(value or "SMALL").strip().upper()

    if normalized_value not in VALID_RECEIPT_LOGO_SIZES:
        return "SMALL"

    return normalized_value


def _legacy_receipt_logo_width(value: str | None):
    normalized_value = _normalize_receipt_logo_size(value)

    if normalized_value == "LARGE":
        return 260

    if normalized_value == "MEDIUM":
        return 200

    return 140


def _normalize_receipt_logo_width(value, fallback_value: int = 200):
    try:
        numeric_value = int(round(float(value)))
    except (TypeError, ValueError):
        return fallback_value

    return min(max(numeric_value, 80), 300)


def _normalize_receipt_font_size(
    value,
    fallback_value: int = 13,
):
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


def _normalize_receipt_item_layout(value: str | None):
    normalized_value = str(value or "COMPACT").strip().upper()

    if normalized_value not in VALID_RECEIPT_ITEM_LAYOUTS:
        return "COMPACT"

    return normalized_value


def _validate_receipt_logo_data(image_data: str | None):
    if not image_data:
        return None

    match = _IMAGE_PATTERN.match(image_data.strip())

    if not match:
        raise ValueError("Invalid receipt logo image")

    mime_type, encoded_data = match.groups()
    normalized_mime = mime_type.lower()

    if normalized_mime not in {"image/png", "image/jpeg", "image/jpg"}:
        raise ValueError("Receipt logo supports PNG or JPG only")

    try:
        base64.b64decode(encoded_data, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid receipt logo image") from exc

    return image_data.strip()


def add_printer(data: StockPrinterCreate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor()

    try:
        name = data.name.strip()
        target = data.target.strip() if data.target else None
        token_print_enabled, main_bill_enabled = _normalize_printer_modes(
            data.token_print_enabled,
            data.main_bill_enabled,
        )

        if not name:
            return {"error": "Enter printer name"}

        if _name_exists(cursor, "stock_printers", name):
            return {"error": "Printer already exists"}

        if not target:
            return {"error": "Select system printer"}

        if main_bill_enabled:
            cursor.execute("UPDATE stock_printers SET main_bill_enabled=0")

        cursor.execute(
            """
            INSERT INTO stock_printers (
                name,
                target,
                token_print_enabled,
                main_bill_enabled
            )
            VALUES (%s, %s, %s, %s)
            """,
            (
                name,
                target,
                1 if token_print_enabled else 0,
                1 if main_bill_enabled else 0,
            ),
        )
        db.commit()

        return {"message": "Printer added"}
    finally:
        cursor.close()
        db.close()


def update_printer_options(printer_id: int, data: StockPrinterUpdate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        token_print_enabled, main_bill_enabled = _normalize_printer_modes(
            data.token_print_enabled,
            data.main_bill_enabled,
        )
        cursor.execute("SELECT id FROM stock_printers WHERE id=%s", (printer_id,))
        printer = cursor.fetchone()

        if not printer:
            return {"error": "Printer not found"}

        cursor.close()
        cursor = db.cursor()
        if main_bill_enabled:
            cursor.execute(
                "UPDATE stock_printers SET main_bill_enabled=0 WHERE id<>%s",
                (printer_id,),
            )
        cursor.execute(
            """
            UPDATE stock_printers
            SET token_print_enabled=%s, main_bill_enabled=%s
            WHERE id=%s
            """,
            (
                1 if token_print_enabled else 0,
                1 if main_bill_enabled else 0,
                printer_id,
            ),
        )
        db.commit()

        return {"message": "Printer updated"}
    finally:
        cursor.close()
        db.close()


def update_receipt_settings(data: StockReceiptSettingsUpdate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        defaults = _default_receipt_settings()
        try:
            logo_image = _validate_receipt_logo_data(data.logo_image)
        except ValueError as exc:
            return {"error": str(exc)}

        header_text = str(data.header_text or "").strip()
        footer_text = str(data.footer_text or "").strip() or defaults["footer_text"]
        logo_width = _normalize_receipt_logo_width(
            getattr(data, "logo_width", None),
            _legacy_receipt_logo_width(getattr(data, "logo_size", None)),
        )

        if len(header_text) > 2000:
            return {"error": "Header text is too long"}

        if len(footer_text) > 2000:
            return {"error": "Footer text is too long"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO stock_receipt_settings (
                id,
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
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s
            )
            ON DUPLICATE KEY UPDATE
                auto_kot_enabled=VALUES(auto_kot_enabled),
                title_enabled=VALUES(title_enabled),
                details_enabled=VALUES(details_enabled),
                title_font_size=VALUES(title_font_size),
                logo_enabled=VALUES(logo_enabled),
                logo_image=VALUES(logo_image),
                logo_alignment=VALUES(logo_alignment),
                logo_size=VALUES(logo_size),
                logo_width=VALUES(logo_width),
                header_text=VALUES(header_text),
                header_alignment=VALUES(header_alignment),
                header_font_size=VALUES(header_font_size),
                details_font_size=VALUES(details_font_size),
                item_font_size=VALUES(item_font_size),
                summary_font_size=VALUES(summary_font_size),
                footer_enabled=VALUES(footer_enabled),
                footer_text=VALUES(footer_text),
                footer_alignment=VALUES(footer_alignment),
                footer_font_size=VALUES(footer_font_size),
                item_layout=VALUES(item_layout)
            """,
            (
                1,
                1 if data.auto_kot_enabled else 0,
                1 if data.title_enabled else 0,
                1 if data.details_enabled else 0,
                _normalize_receipt_font_size(
                    data.title_font_size,
                    defaults["title_font_size"],
                ),
                1 if data.logo_enabled else 0,
                logo_image,
                _normalize_receipt_alignment(data.logo_alignment),
                _normalize_receipt_logo_size(data.logo_size),
                logo_width,
                header_text,
                _normalize_receipt_alignment(data.header_alignment),
                _normalize_receipt_font_size(
                    data.header_font_size,
                    defaults["header_font_size"],
                ),
                _normalize_receipt_font_size(
                    data.details_font_size,
                    defaults["details_font_size"],
                ),
                _normalize_receipt_font_size(
                    data.item_font_size,
                    defaults["item_font_size"],
                ),
                _normalize_receipt_font_size(
                    data.summary_font_size,
                    defaults["summary_font_size"],
                ),
                1 if data.footer_enabled else 0,
                footer_text,
                _normalize_receipt_alignment(data.footer_alignment),
                _normalize_receipt_font_size(
                    data.footer_font_size,
                    defaults["footer_font_size"],
                ),
                _normalize_receipt_item_layout(data.item_layout),
            ),
        )
        db.commit()

        return {
            "message": "Receipt settings saved",
            "settings": get_receipt_settings(),
        }
    finally:
        cursor.close()
        db.close()


def update_login_branding_settings(data: StockLoginBrandingUpdate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor()

    try:
        try:
            logo_image = _validate_receipt_logo_data(data.logo_image)
        except ValueError as exc:
            return {"error": str(exc)}

        cursor.execute(
            """
            INSERT INTO app_login_branding_settings (
                id,
                logo_enabled,
                logo_image
            )
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                logo_enabled=VALUES(logo_enabled),
                logo_image=VALUES(logo_image)
            """,
            (
                1,
                1 if data.logo_enabled else 0,
                logo_image,
            ),
        )
        db.commit()

        return {
            "message": "Login branding saved",
            "settings": get_login_branding_settings(),
        }
    finally:
        cursor.close()
        db.close()


def delete_printer(printer_id: int):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM stock_printers WHERE id=%s", (printer_id,))
        printer = cursor.fetchone()

        if not printer:
            return {"error": "Printer not found"}

        cursor.execute(
            "SELECT id FROM stock_products WHERE printer_id=%s LIMIT 1",
            (printer_id,),
        )
        if cursor.fetchone():
            return {"error": "Printer is assigned to products"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute("DELETE FROM stock_printers WHERE id=%s", (printer_id,))
        db.commit()

        return {"message": "Printer deleted"}
    finally:
        cursor.close()
        db.close()


def get_products():
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                p.id,
                p.name,
                p.category_id,
                p.display_position,
                c.name AS category_name,
                c.display_position AS category_display_position,
                p.sale_price,
                p.cost_price,
                p.current_stock_qty,
                p.tax_mode,
                p.sale_price AS final_price,
                p.printer_id,
                pr.name AS printer_name,
                pr.target AS printer_target,
                p.image_path AS image_url
            FROM stock_products p
            JOIN stock_categories c ON c.id = p.category_id
            LEFT JOIN stock_printers pr ON pr.id = p.printer_id
            ORDER BY c.display_position, c.name, p.display_position, p.name
            """
        )
        return [_serialize_product_row(product) for product in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()


def add_product(data: StockProductCreate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor()
    image_path = None

    try:
        name = data.name.strip()
        sale_price = float(data.sale_price)
        cost_price = float(data.cost_price or 0)
        initial_stock_qty = _normalize_stock_quantity(data.initial_stock_qty)
        display_position = _normalize_product_display_position(
            data.display_position,
        )
        tax_mode = data.tax_mode.strip().upper()

        if not name:
            return {"error": "Enter product name"}

        if sale_price < 0:
            return {"error": "Sale price cannot be negative"}

        if cost_price < 0:
            return {"error": "Cost price cannot be negative"}

        if tax_mode not in VALID_TAX_MODES:
            return {"error": "Select valid tax type"}

        if _name_exists(cursor, "stock_products", name):
            return {"error": "Product already exists"}

        if not _category_exists(cursor, data.category_id):
            return {"error": "Category not found"}

        if data.printer_id is not None and not _printer_exists(cursor, data.printer_id):
            return {"error": "Printer not found"}

        image_path = _save_product_image(data.image_data)

        cursor.execute(
            """
            INSERT INTO stock_products
            (
                name,
                category_id,
                display_position,
                sale_price,
                cost_price,
                current_stock_qty,
                tax_percent,
                tax_mode,
                printer_id,
                image_path
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                name,
                data.category_id,
                display_position,
                sale_price,
                cost_price,
                initial_stock_qty,
                0,
                tax_mode,
                data.printer_id,
                image_path,
            ),
        )
        product_id = cursor.lastrowid

        if initial_stock_qty > 0:
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
                    "OPENING",
                    initial_stock_qty,
                    initial_stock_qty,
                    "Opening stock",
                ),
            )
        db.commit()

        return {"message": "Product added"}
    except ValueError as exc:
        if image_path:
            _delete_product_image(image_path)
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        if image_path:
            _delete_product_image(image_path)
        print("ERROR:", exc)
        return {"error": "Failed to add product"}
    finally:
        cursor.close()
        db.close()


def update_product(product_id: int, data: StockProductUpdate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)
    new_image_path = None

    try:
        cursor.execute(
            "SELECT id, image_path FROM stock_products WHERE id=%s",
            (product_id,),
        )
        existing_product = cursor.fetchone()

        if not existing_product:
            return {"error": "Product not found"}

        name = data.name.strip()
        sale_price = float(data.sale_price)
        cost_price = float(data.cost_price or 0)
        display_position = _normalize_product_display_position(
            data.display_position,
        )
        tax_mode = data.tax_mode.strip().upper()

        if not name:
            return {"error": "Enter product name"}

        if sale_price < 0:
            return {"error": "Sale price cannot be negative"}

        if cost_price < 0:
            return {"error": "Cost price cannot be negative"}

        if tax_mode not in VALID_TAX_MODES:
            return {"error": "Select valid tax type"}

        cursor.close()
        cursor = db.cursor()

        if _name_exists(cursor, "stock_products", name, product_id):
            return {"error": "Product already exists"}

        if not _category_exists(cursor, data.category_id):
            return {"error": "Category not found"}

        if data.printer_id is not None and not _printer_exists(cursor, data.printer_id):
            return {"error": "Printer not found"}

        next_image_path = existing_product["image_path"]

        if data.image_data:
            new_image_path = _save_product_image(data.image_data)
            next_image_path = new_image_path

        cursor.execute(
            """
            UPDATE stock_products
            SET
                name=%s,
                category_id=%s,
                display_position=%s,
                sale_price=%s,
                cost_price=%s,
                tax_mode=%s,
                printer_id=%s,
                image_path=%s
            WHERE id=%s
            """,
            (
                name,
                data.category_id,
                display_position,
                sale_price,
                cost_price,
                tax_mode,
                data.printer_id,
                next_image_path,
                product_id,
            ),
        )
        db.commit()

        if new_image_path and existing_product["image_path"] != new_image_path:
            _delete_product_image(existing_product["image_path"])

        return {"message": "Product updated"}
    except ValueError as exc:
        if new_image_path:
            _delete_product_image(new_image_path)
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        if new_image_path:
            _delete_product_image(new_image_path)
        print("ERROR:", exc)
        return {"error": "Failed to update product"}
    finally:
        cursor.close()
        db.close()


def delete_product(product_id: int):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT id, image_path FROM stock_products WHERE id=%s",
            (product_id,),
        )
        product = cursor.fetchone()

        if not product:
            return {"error": "Product not found"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute("DELETE FROM stock_movements WHERE product_id=%s", (product_id,))
        cursor.execute("DELETE FROM stock_products WHERE id=%s", (product_id,))
        db.commit()

        _delete_product_image(product["image_path"])

        return {"message": "Product deleted"}
    finally:
        cursor.close()
        db.close()


def update_product_cost_price(product_id: int, data: StockProductCostUpdate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        try:
            cost_price = round(float(data.cost_price), 2)
        except (TypeError, ValueError):
            return {"error": "Enter valid cost price"}

        if cost_price < 0:
            return {"error": "Cost price cannot be negative"}

        cursor.execute("SELECT id FROM stock_products WHERE id=%s", (product_id,))
        product = cursor.fetchone()

        if not product:
            return {"error": "Product not found"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE stock_products SET cost_price=%s WHERE id=%s",
            (cost_price, product_id),
        )
        db.commit()
        return {"message": "Cost price updated"}
    finally:
        cursor.close()
        db.close()


def get_stock_movements(limit: int | None = None):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        normalized_limit = 50

        if limit is not None:
            try:
                normalized_limit = max(min(int(limit), 200), 1)
            except (TypeError, ValueError):
                normalized_limit = 50

        cursor.execute(
            """
            SELECT
                m.id,
                m.product_id,
                p.name AS product_name,
                m.movement_type,
                m.quantity_change,
                m.balance_after,
                m.note,
                m.created_at
            FROM stock_movements m
            JOIN stock_products p ON p.id = m.product_id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT %s
            """,
            (normalized_limit,),
        )
        return [_serialize_stock_movement_row(row) for row in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()


def add_stock_movement(data: StockMovementCreate):
    db = get_db()
    _ensure_stock_tables(db)
    cursor = db.cursor(dictionary=True)

    try:
        movement_type = _normalize_stock_movement_type(data.movement_type)

        if movement_type not in {"IN", "OUT"}:
            return {"error": "Select valid movement type"}

        quantity = _normalize_stock_quantity(data.quantity)

        if quantity <= 0:
            return {"error": "Enter stock quantity greater than zero"}

        note = data.note.strip() if data.note else None

        cursor.execute(
            "SELECT id, name, current_stock_qty FROM stock_products WHERE id=%s",
            (data.product_id,),
        )
        product = cursor.fetchone()

        if not product:
            return {"error": "Product not found"}

        current_stock_qty = _decimal_to_float(product["current_stock_qty"]) or 0
        quantity_change = quantity if movement_type == "IN" else -quantity
        next_stock_qty = round(current_stock_qty + quantity_change, 3)

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE stock_products SET current_stock_qty=%s WHERE id=%s",
            (next_stock_qty, data.product_id),
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
                data.product_id,
                movement_type,
                quantity_change,
                next_stock_qty,
                note,
            ),
        )
        db.commit()

        return {
            "message": "Stock movement saved",
            "product_id": data.product_id,
            "product_name": product["name"],
            "current_stock_qty": next_stock_qty,
        }
    except ValueError as exc:
        return {"error": str(exc)}
    finally:
        cursor.close()
        db.close()
