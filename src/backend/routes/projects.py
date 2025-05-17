from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

from src.backend.database import get_db
from src.models.project import Project

router = APIRouter(prefix="/projects", tags=["projects"])

# Pydantic models for request/response
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    
class ProjectCreate(ProjectBase):
    pass
    
class ProjectResponse(ProjectBase):
    id: int
    active: bool
    
    class Config:
        orm_mode = True

# Mock data for integrations
MOCK_INTEGRATION_TYPES = ["GitHub", "Jira", "Trello", "GitLab"]

def generate_mock_integrations(project_id: int) -> List[Dict[str, Any]]:
    """Generate mock integrations for a project"""
    num_integrations = random.randint(1, 3)
    integration_types = random.sample(MOCK_INTEGRATION_TYPES, num_integrations)
    
    return [
        {
            "id": i + 1,
            "project_id": project_id,
            "type": integration_type,
            "config": {"url": f"https://api.{integration_type.lower()}.com", "token": "sample_token"},
            "active": True,
            "created_at": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
        }
        for i, integration_type in enumerate(integration_types)
    ]

def generate_mock_metrics(project_id: int) -> Dict[str, Any]:
    """Generate mock metrics data for a project"""
    num_sprints = 5
    sprint_names = [f"Sprint {i+1}" for i in range(num_sprints)]
    
    # Generate increasing velocity with some variation
    base_velocity = random.randint(8, 15)
    velocities = []
    for i in range(num_sprints):
        v = base_velocity + i + random.randint(-2, 4)
        velocities.append(v)
    
    # Generate decreasing burndown
    total_work = random.randint(80, 150)
    burndown = [total_work]
    remaining = total_work
    for i in range(1, num_sprints):
        work_done = random.randint(15, 25)
        remaining = max(0, remaining - work_done)
        burndown.append(remaining)
    
    # Generate improving cycle time
    base_cycle_time = random.uniform(4.0, 7.0)
    cycle_times = []
    for i in range(num_sprints):
        ct = max(1.0, base_cycle_time - (i * 0.5) + random.uniform(-0.3, 0.3))
        cycle_times.append(round(ct, 1))
    
    return {
        "velocity": velocities,
        "burndown": burndown,
        "cycletime": cycle_times,
        "sprints": sprint_names,
        "project_id": project_id
    }

# Routes
@router.get("/", response_model=List[ProjectResponse])
async def get_projects(db: Session = Depends(get_db)):
    """Get all projects"""
    projects = db.query(Project).all()
    return projects

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project"""
    db_project = Project(
        name=project.name,
        description=project.description
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return db_project

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get project by ID"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int, 
    project_update: ProjectCreate, 
    db: Session = Depends(get_db)
):
    """Update a project"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Update fields
    for key, value in project_update.dict(exclude_unset=True).items():
        setattr(db_project, key, value)
        
    db.commit()
    db.refresh(db_project)
    
    return db_project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project"""
    db_project = db.query(Project).filter(Project.id == project_id).first()
    
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Set project as inactive instead of deleting
    db_project.active = False
    db.commit()
    
    return None

@router.get("/{project_id}/integrations")
async def get_project_integrations(project_id: int, db: Session = Depends(get_db)):
    """Get all integrations for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Generate mock integrations since real ones aren't available
    return generate_mock_integrations(project_id)

@router.get("/{project_id}/metrics")
async def get_project_metrics(project_id: int, db: Session = Depends(get_db)):
    """Get all metrics for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Generate mock metrics since real ones aren't available
    return generate_mock_metrics(project_id) 