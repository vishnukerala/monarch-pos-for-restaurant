import json

from app.db.mysql import get_db

ROLE_ADMIN = "ADMIN"
ROLE_CASHIER = "CASHIER"
ROLE_WAITER = "WAITER"
MANAGED_ROLES = (ROLE_CASHIER, ROLE_WAITER)
ACCESS_CONTROL_SCHEMA_VERSION = 5

PERMISSION_KEYS = (
    "viewDashboard",
    "accessAdministration",
    "manageUsers",
    "managePrinters",
    "manageFloors",
    "manageTables",
    "manageStock",
    "manageFloorLayout",
    "manageAccessControl",
    "viewOpenTables",
    "openBill",
    "addItems",
    "deleteOwnLineItems",
    "printKitchenTicket",
    "moveTable",
    "splitBill",
    "transferItems",
    "receivePayment",
    "printReceipt",
    "reprintBill",
    "editBilledSales",
    "clearOpenOrder",
    "toggleAutoKot",
    "manageExpenses",
)

DEFAULT_CASHIER_PERMISSIONS = {
    "viewDashboard": True,
    "viewOpenTables": True,
    "openBill": True,
    "addItems": True,
    "splitBill": True,
    "receivePayment": True,
    "printReceipt": True,
    "reprintBill": True,
    "editBilledSales": True,
    "manageExpenses": True,
}

DEFAULT_WAITER_PERMISSIONS = {
    "viewOpenTables": True,
    "openBill": True,
    "addItems": True,
    "deleteOwnLineItems": True,
    "printKitchenTicket": True,
    "moveTable": True,
    "toggleAutoKot": True,
}

_access_control_table_ready = False


def _normalize_role(value: str):
    normalized = (value or "").strip().upper()

    if normalized == "BILLING":
        return ROLE_CASHIER

    if normalized in {ROLE_ADMIN, ROLE_CASHIER, ROLE_WAITER}:
        return normalized

    return ""


def _sanitize_permissions(permissions):
    if not isinstance(permissions, dict):
        return {}

    return {
        permission_key: bool(permissions.get(permission_key))
        for permission_key in PERMISSION_KEYS
    }


def _sanitize_overrides(permission_overrides):
    if not isinstance(permission_overrides, dict):
        return {}

    return {
        role: _sanitize_permissions(permission_overrides.get(role))
        for role in MANAGED_ROLES
    }


def _with_cashier_defaults(permissions):
    normalized_permissions = _sanitize_permissions(permissions)
    return {
        **normalized_permissions,
        **{
            key: bool(normalized_permissions.get(key) or value)
            for key, value in DEFAULT_CASHIER_PERMISSIONS.items()
        },
    }


def _looks_like_broken_cashier_permissions(permissions):
    return permissions.get("manageExpenses") and not any(
        permissions.get(permission_key)
        for permission_key in (
            "viewOpenTables",
            "openBill",
            "receivePayment",
            "reprintBill",
        )
    )


def _with_waiter_defaults(permissions):
    normalized_permissions = _sanitize_permissions(permissions)
    return {
        **normalized_permissions,
        **{
            key: bool(normalized_permissions.get(key) or value)
            for key, value in DEFAULT_WAITER_PERMISSIONS.items()
        },
    }


def _looks_like_broken_waiter_permissions(permissions):
    return not any(
        permissions.get(permission_key)
        for permission_key in DEFAULT_WAITER_PERMISSIONS
    )


def _serialize_permissions_payload(permissions):
    return json.dumps(
        {
            "schema_version": ACCESS_CONTROL_SCHEMA_VERSION,
            "permissions": _sanitize_permissions(permissions),
        }
    )


def _deserialize_permissions_payload(raw_permissions):
    try:
        parsed_permissions = json.loads(raw_permissions or "{}")
    except json.JSONDecodeError:
        parsed_permissions = {}

    if isinstance(parsed_permissions, dict) and isinstance(
        parsed_permissions.get("permissions"), dict
    ):
        return (
            _sanitize_permissions(parsed_permissions["permissions"]),
            parsed_permissions.get("schema_version") == ACCESS_CONTROL_SCHEMA_VERSION,
        )

    return _sanitize_permissions(parsed_permissions), False


def _ensure_access_control_table(db):
    global _access_control_table_ready

    if _access_control_table_ready:
        return

    cursor = db.cursor()

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS role_permission_overrides (
                role VARCHAR(50) PRIMARY KEY,
                permissions_json LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )
        db.commit()
        _access_control_table_ready = True
    finally:
        cursor.close()


def get_role_permission_overrides():
    db = get_db()
    cursor = None

    try:
        _ensure_access_control_table(db)
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT role, permissions_json
            FROM role_permission_overrides
            """
        )

        permission_overrides = {}
        legacy_roles_to_upgrade = []

        for row in cursor.fetchall():
            normalized_role = _normalize_role(row["role"])

            if normalized_role not in MANAGED_ROLES:
                continue

            parsed_permissions, is_versioned = _deserialize_permissions_payload(
                row["permissions_json"]
            )

            if normalized_role == ROLE_CASHIER and not is_versioned:
                parsed_permissions = _with_cashier_defaults(parsed_permissions)

            if (
                normalized_role == ROLE_CASHIER
                and _looks_like_broken_cashier_permissions(parsed_permissions)
            ):
                parsed_permissions = _with_cashier_defaults(parsed_permissions)
                is_versioned = False

            if normalized_role == ROLE_WAITER and not is_versioned:
                parsed_permissions = _with_waiter_defaults(parsed_permissions)

            if (
                normalized_role == ROLE_WAITER
                and _looks_like_broken_waiter_permissions(parsed_permissions)
            ):
                parsed_permissions = _with_waiter_defaults(parsed_permissions)
                is_versioned = False

            permission_overrides[normalized_role] = parsed_permissions

            if not is_versioned:
                legacy_roles_to_upgrade.append((normalized_role, parsed_permissions))

        if legacy_roles_to_upgrade:
            cursor.close()
            cursor = db.cursor()

            for normalized_role, permissions in legacy_roles_to_upgrade:
                cursor.execute(
                    """
                    REPLACE INTO role_permission_overrides (role, permissions_json)
                    VALUES (%s, %s)
                    """,
                    (normalized_role, _serialize_permissions_payload(permissions)),
                )

            db.commit()

        return permission_overrides
    finally:
        if cursor is not None:
            cursor.close()
        db.close()


def save_role_permission_overrides(permission_overrides):
    db = get_db()
    cursor = None

    try:
        _ensure_access_control_table(db)
        sanitized_overrides = _sanitize_overrides(permission_overrides)
        cursor = db.cursor()

        for role in MANAGED_ROLES:
            cursor.execute(
                """
                REPLACE INTO role_permission_overrides (role, permissions_json)
                VALUES (%s, %s)
                """,
                (role, _serialize_permissions_payload(sanitized_overrides[role])),
            )

        db.commit()
        return {"permission_overrides": sanitized_overrides}
    finally:
        if cursor is not None:
            cursor.close()
        db.close()


def clear_role_permission_overrides():
    db = get_db()
    cursor = None

    try:
        _ensure_access_control_table(db)
        cursor = db.cursor()
        cursor.execute(
            """
            DELETE FROM role_permission_overrides
            WHERE role IN (%s, %s)
            """,
            MANAGED_ROLES,
        )
        db.commit()
        return {"permission_overrides": {}}
    finally:
        if cursor is not None:
            cursor.close()
        db.close()
