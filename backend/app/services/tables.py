from app.db.mysql import get_db
from app.schemas.tables import TableCreate, TableLayoutUpdate

DEFAULT_TABLE_WIDTH = 140
DEFAULT_TABLE_HEIGHT = 90
DEFAULT_TABLE_START_X = 32
DEFAULT_TABLE_START_Y = 32
DEFAULT_TABLE_GAP_X = 180
DEFAULT_TABLE_GAP_Y = 130
DEFAULT_TABLES_PER_ROW = 4

_layout_columns_ready = False


def _ensure_layout_columns(db):
    global _layout_columns_ready

    if _layout_columns_ready:
        return

    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SHOW COLUMNS FROM `tables`")
        existing_columns = {row["Field"] for row in cursor.fetchall()}
        missing_parts = []

        if "pos_x" not in existing_columns:
            missing_parts.append("ADD COLUMN pos_x INT NULL")
        if "pos_y" not in existing_columns:
            missing_parts.append("ADD COLUMN pos_y INT NULL")
        if "table_width" not in existing_columns:
            missing_parts.append("ADD COLUMN table_width INT NULL")
        if "table_height" not in existing_columns:
            missing_parts.append("ADD COLUMN table_height INT NULL")

        if missing_parts:
            cursor.execute(f"ALTER TABLE `tables` {', '.join(missing_parts)}")
            db.commit()

        _layout_columns_ready = True
    finally:
        cursor.close()


def _get_default_layout(table_index: int):
    column_index = table_index % DEFAULT_TABLES_PER_ROW
    row_index = table_index // DEFAULT_TABLES_PER_ROW

    return {
        "pos_x": DEFAULT_TABLE_START_X + (column_index * DEFAULT_TABLE_GAP_X),
        "pos_y": DEFAULT_TABLE_START_Y + (row_index * DEFAULT_TABLE_GAP_Y),
        "table_width": DEFAULT_TABLE_WIDTH,
        "table_height": DEFAULT_TABLE_HEIGHT,
    }


def _table_exists(cursor, name: str, exclude_table_id: int | None = None):
    query = "SELECT id FROM tables WHERE LOWER(TRIM(name)) = LOWER(%s)"
    params = [name.strip()]

    if exclude_table_id is not None:
        query += " AND id != %s"
        params.append(exclude_table_id)

    cursor.execute(query, tuple(params))
    return cursor.fetchone() is not None


def get_tables():
    db = get_db()
    _ensure_layout_columns(db)
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                t.id,
                t.name,
                t.floor_id,
                f.name as floor,
                t.pos_x,
                t.pos_y,
                t.table_width,
                t.table_height
            FROM tables t
            LEFT JOIN floors f ON t.floor_id = f.id
            """
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


def add_table(table: TableCreate):
    db = get_db()
    _ensure_layout_columns(db)
    cursor = None

    try:
        cursor = db.cursor(dictionary=True)
        name = table.name.strip()

        if _table_exists(cursor, name):
            return {"error": "Table already exists"}

        cursor.execute(
            "SELECT COUNT(*) as total FROM tables WHERE floor_id=%s",
            (table.floor_id,),
        )
        layout = _get_default_layout(cursor.fetchone()["total"])

        cursor.close()
        cursor = db.cursor()

        query = """
            INSERT INTO tables
            (name, floor_id, pos_x, pos_y, table_width, table_height)
            VALUES (%s,%s,%s,%s,%s,%s)
        """
        cursor.execute(
            query,
            (
                name,
                table.floor_id,
                layout["pos_x"],
                layout["pos_y"],
                layout["table_width"],
                layout["table_height"],
            ),
        )
        db.commit()

        return {"message": "Table added"}
    finally:
        if cursor is not None:
            cursor.close()
        db.close()


def update_table(table_id: int, table: TableCreate):
    db = get_db()
    _ensure_layout_columns(db)
    cursor = db.cursor()

    try:
        name = table.name.strip()

        if _table_exists(cursor, name, table_id):
            return {"error": "Table already exists"}

        cursor.execute(
            "UPDATE tables SET name=%s, floor_id=%s WHERE id=%s",
            (name, table.floor_id, table_id),
        )
        db.commit()

        return {"message": "Table updated"}
    finally:
        cursor.close()
        db.close()


def update_table_layout(table_id: int, layout: TableLayoutUpdate):
    db = get_db()
    _ensure_layout_columns(db)
    cursor = db.cursor()

    try:
        cursor.execute(
            """
            UPDATE tables
            SET pos_x=%s, pos_y=%s, table_width=%s, table_height=%s
            WHERE id=%s
            """,
            (
                layout.pos_x,
                layout.pos_y,
                layout.table_width,
                layout.table_height,
                table_id,
            ),
        )
        db.commit()

        return {"message": "Table layout updated"}
    finally:
        cursor.close()
        db.close()


def delete_table(table_id: int):
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("DELETE FROM tables WHERE id=%s", (table_id,))
        db.commit()

        return {"message": "Table deleted"}
    finally:
        cursor.close()
        db.close()
