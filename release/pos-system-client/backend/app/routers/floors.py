from fastapi import APIRouter

from app.schemas.floors import FloorCreate
from app.services.floors import add_floor, delete_floor, get_floors, update_floor

router = APIRouter(prefix="/floors")


@router.get("")
def read_floors():
    return get_floors()


@router.post("")
def create_floor(floor: FloorCreate):
    return add_floor(floor)


@router.put("/{floor_id}")
def edit_floor(floor_id: int, floor: FloorCreate):
    return update_floor(floor_id, floor)


@router.delete("/{floor_id}")
def remove_floor(floor_id: int):
    return delete_floor(floor_id)
