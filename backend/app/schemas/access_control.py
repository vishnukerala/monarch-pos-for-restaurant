from pydantic import BaseModel, Field


class PermissionOverridesUpdate(BaseModel):
    permission_overrides: dict[str, dict[str, bool]] = Field(default_factory=dict)
