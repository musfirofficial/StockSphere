import asyncio
import sys
import getpass
import re
from sqlalchemy import select
from app.database import async_session_maker, create_db_and_tables
from app.models import User, UserRole
from app.schemas.user import UserCreate
from app.crud import user as user_crud


def prompt_input(prompt_text: str, default: str = "") -> str:
    if default:
        val = input(f"{prompt_text} [{default}]: ").strip()
        return val if val else default
    return input(f"{prompt_text}: ").strip()


async def create_admin_interactive():
    print("\n" + "=" * 50)
    print("      StockSphere - Create Initial Admin User")
    print("=" * 50 + "\n")

    # Ensure tables exist
    await create_db_and_tables()

    async with async_session_maker() as db:
        # Check if an admin already exists
        result = await db.execute(select(User).filter(User.role == UserRole.ADMIN))
        existing_admins = result.scalars().all()
        if existing_admins:
            print(f"Notice: System already has {len(existing_admins)} Admin user(s).")
            proceed = input("Do you want to create another Admin? (y/N): ").strip().lower()
            if proceed not in ("y", "yes"):
                print("Aborted.")
                return

        # Prompt for fields with validation loops
        while True:
            full_name = prompt_input("Enter Admin Full Name (e.g. John Silva)")
            if len(full_name) >= 3 and re.match(r"^[a-zA-Z\s]+$", full_name):
                break
            print("Error: Full name must be at least 3 characters and contain only letters and spaces.\n")

        while True:
            user_name = prompt_input("Enter Username (e.g. admin or john_silva)").lower()
            if len(user_name) >= 3 and re.match(r"^[a-z0-9._]+$", user_name):
                existing = await user_crud.get_user_by_user_name(db, user_name)
                if not existing:
                    break
                print(f"Error: Username '{user_name}' already exists.\n")
            else:
                print("Error: Username must be min 3 chars (lowercase letters, digits, '.', '_').\n")

        while True:
            nic = prompt_input("Enter NIC (e.g. 200012345678 or 123456789V)").upper()
            if re.match(r"^(\d{9}[VvXx]|\d{12})$", nic):
                res = await db.execute(select(User).filter(User.nic == nic))
                if not res.scalar_one_or_none():
                    break
                print(f"Error: NIC '{nic}' is already registered to another user.\n")
            else:
                print("Error: Invalid NIC format (must be 9 digits + V/X or 12 digits).\n")

        while True:
            email = prompt_input("Enter Email (e.g. admin@stocksphere.com)").lower()
            if re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
                existing = await user_crud.get_user_by_email(db, email)
                if not existing:
                    break
                print(f"Error: Email '{email}' is already registered.\n")
            else:
                print("Error: Invalid email address format.\n")

        while True:
            phone_raw = prompt_input("Enter Phone Number (e.g. 0771234567)")
            phone = phone_raw.strip().replace(" ", "").replace("-", "")
            if re.match(r"^0\d{9}$", phone):
                res = await db.execute(select(User).filter(User.phone == phone))
                if not res.scalar_one_or_none():
                    break
                print(f"Error: Phone '{phone}' is already registered.\n")
            else:
                print("Error: Phone number must be 10 digits starting with 0 (e.g. 0771234567).\n")

        while True:
            password = getpass.getpass("Enter Password (min 8 characters): ")
            if len(password) < 8:
                print("Error: Password must be at least 8 characters.\n")
                continue
            if " " in password:
                print("Error: Password cannot contain spaces.\n")
                continue
            confirm = getpass.getpass("Confirm Password: ")
            if password != confirm:
                print("Error: Passwords do not match. Try again.\n")
                continue
            break

        # Create the admin user
        user_in = UserCreate(
            full_name=full_name,
            user_name=user_name,
            nic=nic,
            email=email,
            phone=phone,
            password=password,
            role=UserRole.ADMIN,
        )

        new_admin = await user_crud.create_user(db, user_in)
        print("\n" + "=" * 50)
        print(f" SUCCESS: Admin user created successfully!")
        print(f" User ID   : {new_admin.user_id}")
        print(f" Username  : {new_admin.user_name}")
        print(f" Email     : {new_admin.email}")
        print(f" Role      : {new_admin.role.value}")
        print("=" * 50 + "\n")


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("create-admin", "createadmin", "init-admin"):
        asyncio.run(create_admin_interactive())
    else:
        print("StockSphere CLI Usage:")
        print("  python -m app.cli create-admin    - Interactively create an initial Admin user")


if __name__ == "__main__":
    main()
