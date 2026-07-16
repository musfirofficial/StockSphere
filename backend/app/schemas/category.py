from pydantic import BaseModel, ConfigDict,Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re

# ------------------------------ Category Model ------------------------------ #
class CategoryBase(BaseModel):
    category_name: str = Field(min_length=3, max_length=100)
    description: Optional[str] = None

    @field_validator('category_name', 'description')
    @classmethod
    def clean_input(cls, v: str, info) -> str:
        if v:
            v = v.strip()
        if info.field_name == 'category_name':
            if not re.match(r"^[a-zA-Z0-9\s]+$", v):
                raise ValueError("Category name can only contain letters, numbers, and spaces")
        return v

# -------------------------- Create category schema -------------------------- #
class CategoryCreate(CategoryBase):
    pass

# -------------------------- Create category update schema -------------------------- #
class CategoryUpdate(BaseModel):
    category_name: Optional[str] = None
    description: Optional[str] = None

    @field_validator('category_name', 'description')
    @classmethod
    def clean_input(cls, v: str, info) -> str:
        if v:
            v = v.strip()
            if info.field_name == 'category_name':
                if not re.match(r"^[a-zA-Z0-9\s]+$", v):
                    raise ValueError("Category name can only contain letters, numbers, and spaces")
        return v

# ------------------------- category response schema ------------------------- #
class CategoryResponse(CategoryBase):
    category_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)