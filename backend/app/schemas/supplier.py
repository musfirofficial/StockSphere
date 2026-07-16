from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
import uuid
import re


# ------------------------------ Supplier Model ------------------------------ #
class SupplierBase(BaseModel):
    supplier_name: str = Field(min_length=3, max_length=100)
    contact_person: str = Field(min_length=3, max_length=100)
    phone: str = Field(max_length=12)
    email: EmailStr
    address: str = Field(max_length=255)
    notes: Optional[str | None] = Field(max_length=255)

    @field_validator('supplier_name', 'contact_person', 'phone', 'email', 'address', 'notes')
    @classmethod
    def clean_input(cls, v: str, info) -> str:
        v = v.strip()
        if info.field_name in ['supplier_name', 'contact_person']:
            if not re.match(r"^[a-zA-Z\s]+$", v):
                raise ValueError("Supplier name can only contain letters and spaces")
        elif info.field_name == 'phone':
            if not re.match(r"^\d{3} \d{3} \d{4}$", v):
                raise ValueError("Phone number must be in the format ### ### ####")
        return v

# ------------------------------ Supplier create schema----------------------------- #
class SupplierCreate(SupplierBase):
    pass

# update -> supplier_name, contact_person, phone, email, address, notes, status
class SupplierUpdate(BaseModel):
    supplier_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional [str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('supplier_name', 'contact_person', 'phone', 'email', 'address', 'notes')
    @classmethod
    def clean_update(cls, v : str | None, info) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if info.field_name in ['supplier_name', 'contact_person']:
            if not re.match(r"^[a-zA-Z\s]+$", v):
                raise ValueError("Supplier name can only contain letters and spaces")
        elif info.field_name == 'phone':
            if not re.match(r"^\d{3} \d{3} \d{4}$", v):
                raise ValueError("Phone number must be in the format ### ### ####")
        return v

# ------------------------- Supplier response schema ------------------------- #
class SupplierResponse(SupplierBase):
    supplier_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    total_supplies: int

    model_config = ConfigDict(from_attributes=True)