import mysql.connector

from app.db.mysql import get_db
from app.schemas.users import ResetPassword, UserCreate, UserRoleUpdate


def _normalize_role(value: str):
    normalized = (value or "").strip().upper()

    if normalized == "BILLING":
        return "CASHIER"

    if normalized in {"ADMIN", "CASHIER", "WAITER"}:
        return normalized

    return "WAITER"


def _user_exists(cursor, username: str, exclude_user_id: int | None = None):
    query = "SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(%s)"
    params = [username.strip()]

    if exclude_user_id is not None:
        query += " AND id != %s"
        params.append(exclude_user_id)

    cursor.execute(query, tuple(params))
    return cursor.fetchone() is not None


def ensure_users_schema(db):
    cursor = db.cursor()

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL
            )
            """
        )

        cursor.execute("SHOW COLUMNS FROM users")
        columns = {row[0]: row for row in cursor.fetchall()}

        if "username" not in columns:
            cursor.execute(
                """
                ALTER TABLE users
                ADD COLUMN username VARCHAR(255) NOT NULL
                """
            )

        if "password" not in columns:
            cursor.execute(
                """
                ALTER TABLE users
                ADD COLUMN password VARCHAR(255) NOT NULL
                """
            )

        if "role" not in columns:
            cursor.execute(
                """
                ALTER TABLE users
                ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'WAITER'
                """
            )
        else:
            role_type = str(columns["role"][1] or "").strip().lower()

            if "varchar" not in role_type:
                cursor.execute(
                    """
                    ALTER TABLE users
                    MODIFY COLUMN role VARCHAR(50) NOT NULL
                    """
                )

        cursor.execute(
            """
            UPDATE users
            SET role = 'CASHIER'
            WHERE UPPER(TRIM(role)) = 'BILLING'
            """
        )

        db.commit()
    finally:
        cursor.close()


def get_users():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        ensure_users_schema(db)
        cursor.execute("SELECT id, username, role FROM users ORDER BY username")
        users = cursor.fetchall()

        return [
            {
                **user,
                "role": _normalize_role(user["role"]),
            }
            for user in users
        ]
    finally:
        cursor.close()
        db.close()


def add_user(user: UserCreate):
    db = None
    cursor = None

    try:
        db = get_db()
        ensure_users_schema(db)
        cursor = db.cursor()
        username = user.username.strip()

        if _user_exists(cursor, username):
            return {"error": "User already exists"}

        query = "INSERT INTO users (username, password, role) VALUES (%s,%s,%s)"
        cursor.execute(query, (username, user.password, _normalize_role(user.role)))
        db.commit()

        return {"message": "User added"}

    except mysql.connector.Error as exc:
        print("ERROR:", exc)
        return {"error": f"Database error: {exc.msg or str(exc)}"}

    except Exception as exc:
        print("ERROR:", exc)
        return {"error": f"Failed to add user: {exc}"}

    finally:
        if cursor is not None:
            cursor.close()
        if db is not None:
            db.close()


def reset_user_password(user_id: int, data: ResetPassword):
    db = get_db()
    cursor = db.cursor()

    try:
        ensure_users_schema(db)
        cursor.execute(
            "UPDATE users SET password=%s WHERE id=%s",
            (data.password, user_id),
        )
        db.commit()

        return {"message": "Password updated"}
    finally:
        cursor.close()
        db.close()


def update_user_role(user_id: int, data: UserRoleUpdate):
    db = get_db()
    cursor = None

    try:
        ensure_users_schema(db)
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT username, role FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()

        if not user:
            return {"error": "User not found"}

        normalized_role = _normalize_role(data.role)

        if user["username"].strip().lower() == "admin" and normalized_role != "ADMIN":
            return {"error": "Default admin user must remain admin"}

        cursor.close()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE users SET role=%s WHERE id=%s",
            (normalized_role, user_id),
        )
        db.commit()

        return {
            "message": "Role updated",
            "role": normalized_role,
        }
    finally:
        if cursor is not None:
            cursor.close()
        db.close()


def delete_user(user_id: int):
    db = get_db()
    cursor = None

    try:
        ensure_users_schema(db)
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT username, role FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()

        if not user:
            return {"error": "User not found"}

        if user["username"].strip().lower() == "admin":
            return {"error": "Default admin user cannot be deleted"}

        cursor.close()
        cursor = None
        cursor = db.cursor()
        cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
        db.commit()

        return {"message": "User deleted"}
    finally:
        if cursor is not None:
            cursor.close()
        db.close()
