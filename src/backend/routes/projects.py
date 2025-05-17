from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

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

@router.get("/{project_id}/integrations", response_model=List)
async def get_project_integrations(project_id: int, db: Session = Depends(get_db)):
    """Get all integrations for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project.integrations

@router.get("/{project_id}/metrics", response_model=List)
async def get_project_metrics(project_id: int, db: Session = Depends(get_db)):
    """Get all metrics for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project.metrics 