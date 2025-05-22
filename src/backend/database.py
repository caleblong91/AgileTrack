from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL from environment or default to SQLite for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agiletrack.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Function to initialize database
def init_db():
    # Import all models here to ensure they are registered with Base
    from src.models.user import User
    from src.models.team import Team
    from src.models.integration import Integration
    from src.models.metric import Metric, Sprint, TeamMember
    from src.models.project import Project
    
    # Create all tables
    Base.metadata.create_all(bind=engine) 