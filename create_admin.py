from src.backend.database import SessionLocal
from src.models.user import User
from src.backend.auth import get_password_hash

def create_admin_user():
    # Connect to the database
    db = SessionLocal()
    try:
        # Check if admin user already exists
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if admin:
            print("Admin user already exists.")
            return
            
        # Create admin user
        hashed_password = get_password_hash("adminpassword")
        admin_user = User(
            email="admin@example.com",
            username="admin",
            hashed_password=hashed_password,
            full_name="Admin User",
            setup_complete=True,
            has_integration=True,
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        print("Admin user created with email: admin@example.com and password: adminpassword")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user() 