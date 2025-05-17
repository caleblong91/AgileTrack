from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
import logging

from src.backend.database import get_db, SessionLocal
from src.backend.auth import (
    authenticate_user, 
    create_access_token, 
    get_password_hash, 
    get_current_active_user, 
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from src.models.user import User
from src.models.schemas import UserCreate, User as UserSchema, UserLogin, Token, UserSetup

# Create router
router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

# Register new user
@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    print(f"Registration attempt with email: {user.email}, username: {user.username}")
    
    # Check if email already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        print(f"Registration failed: Email {user.email} already exists")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    db_username = db.query(User).filter(User.username == user.username).first()
    if db_username:
        print(f"Registration failed: Username {user.username} already exists")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        full_name=user.full_name
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

# Login for access token
@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Login (custom endpoint that accepts email instead of username)
@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Get current user
@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# Update user setup information
@router.put("/setup", response_model=UserSchema)
async def update_user_setup(
    setup_data: UserSetup, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Update user info
    current_user.full_name = setup_data.full_name
    current_user.company = setup_data.company
    current_user.role = setup_data.role
    current_user.team_size = setup_data.team_size
    current_user.setup_complete = True
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

# Mark user as having integrations
@router.put("/has-integration", response_model=UserSchema)
async def update_integration_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    current_user.has_integration = True
    db.commit()
    db.refresh(current_user)
    
    return current_user

# Create a demo admin user on startup
def create_demo_admin():
    db = SessionLocal()
    try:
        # Check if admin user already exists
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin:
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
            print("Demo admin user created with email: admin@example.com and password: adminpassword")
    except Exception as e:
        print(f"Error creating admin user: {e}")
    finally:
        db.close()

# Create admin user on module import
create_demo_admin() 