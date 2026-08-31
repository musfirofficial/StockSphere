from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re


# ------------------------------ Unit Base Model ----------------------------- #
class UnitBase(BaseModel):
    unit_name: str = Field(min_length=2, max_length=50)
    unit_symbol: str = Field(min_length=1, max_length=20)
    description: Optional[str] = Field(default=None, max_length=255)

    @field_validator("unit_name", "unit_symbol")
    @classmethod
    def clean_strings(cls, v: str, info) -> str:
        v = v.strip()
        if info.field_name == "unit_name":
            if not re.match(r"^[a-zA-Z0-9\s\-]+$", v):
                raise ValueError("Unit name can only contain letters, numbers, hyphens, and spaces")
        elif info.field_name == "unit_symbol":
            v = v.lower()
            if not re.match(r"^[a-zA-Z0-9\s\/\.\%]+$", v):
                raise ValueError("Unit symbol can only contain letters, numbers, slashes, and periods")
        return v


# ----------------------------- Unit Create Schema --------------------------- #
class UnitCreate(UnitBase):
    pass


# ----------------------------- Unit Update Schema --------------------------- #
class UnitUpdate(BaseModel):
    unit_name: Optional[str] = None
    unit_symbol: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("unit_name", "unit_symbol")
    @classmethod
    def clean_update_strings(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if info.field_name == "unit_name":
            if not re.match(r"^[a-zA-Z0-9\s\-]+$", v):
                raise ValueError("Unit name can only contain letters, numbers, hyphens, and spaces")
        elif info.field_name == "unit_symbol":
            v = v.lower()
            if not re.match(r"^[a-zA-Z0-9\s\/\.\%]+$", v):
                raise ValueError("Unit symbol can only contain letters, numbers, slashes, and periods")
        return v


# ---------------------------- Unit Response Schema -------------------------- #
class UnitResponse(UnitBase):
    unit_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
