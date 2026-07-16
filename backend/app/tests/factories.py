import uuid
from datetime import datetime, timezone
from app.models import User, UserRole

CREATE_PAYLOAD = {
    "full_name"  : "John Perera",
    "user_name"  : "john.perera",
    "nic"        : "123456789V",    
    "email"      : "john.perera@test.com",
    "phone"      : "071 234 5678",       
    "password"   : "Secure@123",          
    "role"       : "Sales",
}

DEATIVATED_PAYLOAD = {"is_active": False}

UPDATE_PAYLOAD = {"full_name": "Updated Name"}

DELETE_PASSWORD_PAYLOAD_WITH_NONE = {
    "current_password": None,
    "new_password": "new_password"
}

DELETE_PASSWORD_PAYLOAD = {
    "current_password": "current_password",
    "new_password": "new_password"
}

DELETE_PASSWORD_IDENTICAL = {
    "current_password": "new_password",
    "new_password": "new_password"
}


def make_mock_user(**overrides):
    defaults = dict(
        user_id    = uuid.uuid4(),
        full_name  = "John Perera",
        user_name  = "john.perera",
        nic        = "123456789V",
        email      = "john.perera@test.com",
        phone      = "071 234 5678",
        role       = UserRole.SALES,
        is_active  = True,
        created_at = datetime.now(timezone.utc),
        updated_at = datetime.now(timezone.utc),
    )
    return User(**{**defaults, **overrides})