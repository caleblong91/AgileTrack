from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Base user schema
class UserBase(BaseModel):
    email: EmailStr
    username: str

# Schema for user creation
class UserCreate(UserBase):
    password: str
    full_name: Optional[str] = None

# Schema for updating user data during setup
class UserSetup(BaseModel):
    full_name: str
    company: str
    role: str
    team_size: str
    
# Schema for login requests
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Schema for token responses
class Token(BaseModel):
    access_token: str
    token_type: str

# Schema for token data
class TokenData(BaseModel):
    user_id: Optional[int] = None

# Schema for user response (returned to client)
class User(UserBase):
    id: int
    full_name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    team_size: Optional[str] = None
    setup_complete: bool
    has_integration: bool
    created_at: datetime
    
    class Config:
        orm_mode = True 