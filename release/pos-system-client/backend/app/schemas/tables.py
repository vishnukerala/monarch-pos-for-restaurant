from pydantic import BaseModel


class TableCreate(BaseModel):
    name: str
    floor_id: int


class TableLayoutUpdate(BaseModel):
    pos_x: int
    pos_y: int
    table_width: int
    table_height: int
