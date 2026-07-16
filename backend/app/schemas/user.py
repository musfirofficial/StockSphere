from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re
from app.models import UserRole

# ------------------------------ User base model ----------------------------- #
class UserBase(BaseModel):
    full_name: str = Field(min_length=3, max_length=100)
    user_name: str = Field(min_length=3, max_length=50)
    nic: str = Field(min_length = 10, max_length = 12)
    email: EmailStr = Field (max_length = 100)
    phone: str = Field( max_length=12)

    @field_validator('full_name','user_name', 'email', 'phone', 'nic')
    @classmethod
    def clean_input(cls, v: str, info) -> str:
        v = v.strip()

        if info.field_name == 'full_name':
            if not re.match(r"^[a-zA-Z\s]+$", v):
                raise ValueError("Full name can only contain letters and spaces")
        elif info.field_name == 'user_name':
            if not re.match(r"^[a-z0-9._]+$", v):
                raise ValueError("Username can only contain lowercase letters, numbers, periods(.), and underscores(_)")
        elif info.field_name == 'nic':
            v = v.upper()
            if not re.match(r"^(\d{9}V|\d{12})$", v):
                raise ValueError("Invalid NIC format")
        elif info.field_name == 'email':
            v = v.lower()
        elif info.field_name == 'phone':
            v = v.strip()
            if not re.match(r"^\d{3} \d{3} \d{4}$", v):
                raise ValueError("Phone number must be in the format ### ### ####")
        return v

# ---------------------------- User create Schema ---------------------------- #
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72) # !!! Need to be Hashed
    role: Optional[UserRole] = UserRole.SALES

    @field_validator('password')
    @classmethod
    def clean_password(cls, v: str) -> str:
        if " " in v:
            raise ValueError("Password cannot contain spaces")
        return v

# -------------------- User update schema (regular/admin) -------------------- #
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    user_name: Optional[str] = None
    nic: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('user_name', 'nic', 'email','phone', 'full_name')
    @classmethod
    def validate_updates(cls, v, info):
        if v is None:
            return v
        v = v.strip()   
        if info.field_name == 'full_name':
            if not re.match(r"^[a-zA-Z\s]+$", v):
                raise ValueError("Full name can only contain letters and spaces")     
        if info.field_name == 'user_name':
            if not re.match(r"^[a-z0-9._]+$", v):
                raise ValueError("Username can only contain lowercase letters, numbers, periods(.), and underscores(_)")        
        if info.field_name == 'nic':
            v = v.upper()
            if not re.match(r"^(\d{9}V|\d{12})$", v):
                raise ValueError("Invalid NIC format")        
        if info.field_name == 'phone':
            if not re.match(r"^\d{3} \d{3} \d{4}$", v):
                raise ValueError("Phone number must be in the format ### ### ####")                  
        return v

# -------------------------- Password change schema -------------------------- #
class ChangePasswordRequest(BaseModel):
    current_password: str | None = Field(default = None, min_length=8, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

# --------------------------- User response schema --------------------------- #
class UserResponse(UserBase):
    user_id: uuid.UUID
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True) # It allows Pydantic to read data from SQLAlchemy objects

