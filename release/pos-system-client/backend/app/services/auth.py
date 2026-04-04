from app.db.mysql import get_db
from app.schemas.auth import LoginRequest
from app.services.access_control import get_role_permission_overrides


def _normalize_role(value):
    normalized = (value or "").strip().upper()

    if normalized == "BILLING":
        return "CASHIER"

    if normalized in {"ADMIN", "CASHIER", "WAITER"}:
        return normalized

    return normalized


def login_user(data: LoginRequest):
    db = None
    cursor = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        query = "SELECT * FROM users WHERE username=%s AND password=%s"
        cursor.execute(query, (data.username.strip(), data.password.strip()))
        user = cursor.fetchone()

        if user:
            return {
                "token": "testtoken",
                "id": user["id"],
                "username": user["username"],
                "role": _normalize_role(user["role"]),
                "permission_overrides": get_role_permission_overrides(),
            }

        return {"error": "Invalid login"}

    except Exception as exc:
        print("ERROR:", exc)
        return {"error": "Server error"}

    finally:
        if cursor is not None:
            cursor.close()
        if db is not None:
            db.close()
