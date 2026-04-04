from fastapi import APIRouter

from app.schemas.users import ResetPassword, UserCreate, UserRoleUpdate
from app.services.users import (
    add_user,
    delete_user,
    get_users,
    reset_user_password,
    update_user_role,
)

router = APIRouter(prefix="/users")


@router.get("")
def read_users():
    return get_users()


@router.post("")
def create_user(user: UserCreate):
    return add_user(user)


@router.put("/{user_id}")
def update_user_password(user_id: int, data: ResetPassword):
    return reset_user_password(user_id, data)


@router.put("/{user_id}/role")
def change_user_role(user_id: int, data: UserRoleUpdate):
    return update_user_role(user_id, data)


@router.delete("/{user_id}")
def remove_user(user_id: int):
    return delete_user(user_id)
