from fastapi import APIRouter

from app.schemas.access_control import PermissionOverridesUpdate
from app.services.access_control import (
    clear_role_permission_overrides,
    get_role_permission_overrides,
    save_role_permission_overrides,
)

router = APIRouter(prefix="/access-control")


@router.get("")
def read_role_permissions():
    return {"permission_overrides": get_role_permission_overrides()}


@router.put("")
def update_role_permissions(data: PermissionOverridesUpdate):
    return save_role_permission_overrides(data.permission_overrides)


@router.delete("")
def reset_role_permissions():
    return clear_role_permission_overrides()
