import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, UserRole
from app.services.security import hash_password, verify_password
load_dotenv()

ADMIN_FULLNAME = os.getenv("ADMIN_FULLNAME")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_NIC = os.getenv("ADMIN_NIC")
ADMIN_PHONE = os.getenv("ADMIN_PHONE")
    
class AdminService:
    @staticmethod
    async def create_admin(db : AsyncSession) -> str:
        if not ADMIN_PASSWORD or not ADMIN_USERNAME or not ADMIN_FULLNAME or not ADMIN_USERNAME or not ADMIN_EMAIL or not ADMIN_NIC or not ADMIN_PHONE:
            raise ValueError("Wrong credentials in .env file")
        # 1. Search for the recovery admin by their unique username
        result = await db.execute(select(User).where(User.user_name == ADMIN_USERNAME))
        admin = result.scalar_one_or_none()
    
        if not admin:
            hashed_pw = hash_password(ADMIN_PASSWORD)

            new_admin = User(
                full_name = ADMIN_FULLNAME,
                user_name = ADMIN_USERNAME,
                email =  ADMIN_EMAIL,
                nic = ADMIN_NIC,
                phone = ADMIN_PHONE,
                role = UserRole.ADMIN,
                password_hash = hashed_pw,
                is_active = True
            )
            db.add(new_admin)
            await db.commit()
            await db.refresh(new_admin)
            return "created"
        
        password_matches = verify_password(ADMIN_PASSWORD, admin.password_hash)
        
        if not password_matches:
            # Only hash and update if the password changed
            if not password_matches:
                admin.password_hash = hash_password(ADMIN_PASSWORD)
    
            admin.full_name = ADMIN_FULLNAME
            admin.email = ADMIN_EMAIL
            admin.nic = ADMIN_NIC
            admin.phone = ADMIN_PHONE
            admin.is_active = True
            
            await db.commit()
            return "updated"
        
        # Scenario C: Everything is identical -> Do nothing! (Fast startup)
        return "unchanged"