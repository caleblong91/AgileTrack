from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import database
from src.backend.database import engine, Base, init_db

# Import models in the correct order to avoid circular dependencies
from src.models.user import User
from src.models.team import Team
from src.models.integration import Integration
from src.models.metric import Metric, Sprint, TeamMember 
from src.models.project import Project

# Import routes
from src.backend.routes import projects, integrations, auth, teams

# Import Celery tasks
from src.backend.tasks import app as celery_app

# Initialize database
init_db()

# Create FastAPI app
app = FastAPI(title="AgileTrack API", description="API for tracking agile metrics across multiple platforms")

# Add CORS middleware with specific configuration
origins = [
    "http://localhost",  # Frontend origin
    "http://localhost:3000",  # Alternative frontend port
    "http://127.0.0.1",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(teams.router)
app.include_router(integrations.router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to AgileTrack API", "status": "online"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 