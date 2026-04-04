from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    role: str


class ResetPassword(BaseModel):
    password: str


class UserRoleUpdate(BaseModel):
    role: str
