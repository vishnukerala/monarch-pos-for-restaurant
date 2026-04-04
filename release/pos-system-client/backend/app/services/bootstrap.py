from app.core.config import get_settings
from app.db.mysql import get_db
from app.services.users import ensure_users_schema

_bootstrap_ready = False


def ensure_core_bootstrap():
    global _bootstrap_ready

    if _bootstrap_ready:
        return

    db = get_db()
    cursor = db.cursor()
    settings = get_settings()

    try:
        ensure_users_schema(db)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS floors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS tables (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                floor_id INT NOT NULL
            )
            """
        )

        admin_username = (settings.default_admin_username or "admin").strip() or "admin"
        admin_password = settings.default_admin_password or "admin123"

        cursor.execute(
            "SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(%s)",
            (admin_username,),
        )
        admin_user = cursor.fetchone()

        if not admin_user:
            cursor.execute(
                """
                INSERT INTO users (username, password, role)
                VALUES (%s, %s, %s)
                """,
                (admin_username, admin_password, "ADMIN"),
            )

        db.commit()
        _bootstrap_ready = True
    finally:
        cursor.close()
        db.close()
