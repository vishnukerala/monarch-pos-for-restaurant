from fastapi import APIRouter

from app.schemas.tables import TableCreate, TableLayoutUpdate
from app.services.tables import (
    add_table,
    delete_table,
    get_tables,
    update_table,
    update_table_layout,
)

router = APIRouter(prefix="/tables")


@router.get("")
def read_tables():
    return get_tables()


@router.post("")
def create_table(table: TableCreate):
    return add_table(table)


@router.put("/{table_id}")
def edit_table(table_id: int, table: TableCreate):
    return update_table(table_id, table)


@router.put("/{table_id}/layout")
def edit_table_layout(table_id: int, layout: TableLayoutUpdate):
    return update_table_layout(table_id, layout)


@router.delete("/{table_id}")
def remove_table(table_id: int):
    return delete_table(table_id)
