import mysql.connector

from app.core.config import get_settings


def get_db():
    settings = get_settings()
    return mysql.connector.connect(
        host=settings.db_host,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
    )
