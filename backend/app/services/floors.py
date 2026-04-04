from app.db.mysql import get_db
from app.schemas.floors import FloorCreate


def _floor_exists(cursor, name: str, exclude_floor_id: int | None = None):
    query = "SELECT id FROM floors WHERE LOWER(TRIM(name)) = LOWER(%s)"
    params = [name.strip()]

    if exclude_floor_id is not None:
        query += " AND id != %s"
        params.append(exclude_floor_id)

    cursor.execute(query, tuple(params))
    return cursor.fetchone() is not None


def get_floors():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute("SELECT * FROM floors")
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


def add_floor(floor: FloorCreate):
    db = get_db()
    cursor = db.cursor()

    try:
        name = floor.name.strip()

        if _floor_exists(cursor, name):
            return {"error": "Floor already exists"}

        cursor.execute("INSERT INTO floors (name) VALUES (%s)", (name,))
        db.commit()

        return {"message": "Floor added"}
    finally:
        cursor.close()
        db.close()


def update_floor(floor_id: int, floor: FloorCreate):
    db = get_db()
    cursor = db.cursor()

    try:
        name = floor.name.strip()

        if _floor_exists(cursor, name, floor_id):
            return {"error": "Floor already exists"}

        cursor.execute(
            "UPDATE floors SET name=%s WHERE id=%s",
            (name, floor_id),
        )
        db.commit()

        return {"message": "Floor updated"}
    finally:
        cursor.close()
        db.close()


def delete_floor(floor_id: int):
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("DELETE FROM floors WHERE id=%s", (floor_id,))
        db.commit()

        return {"message": "Floor deleted"}
    finally:
        cursor.close()
        db.close()
