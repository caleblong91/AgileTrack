from fastapi import APIRouter, Depends, HTTPException, status, Query # Added Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func # Added func
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import asyncio 

from src.backend.database import get_db
from src.models.project import Project
from src.models.integration import Integration # Import Integration model
# Import relevant Pydantic models and functions from integrations router
from src.backend.routes.integrations import IntegrationResponse, MetricsRequest, get_metrics 

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

# Define a new response model for aggregated project metrics
class ProjectMetricsResponse(BaseModel):
    project_id: int
    project_name: str
    integrations_count: int
    has_metrics: bool
    metrics_by_integration: Dict[int, Dict[str, Any]] # Keyed by integration ID
    # Add any summary metrics if needed, similar to TeamMetrics
    summary: Optional[Dict[str, Any]] = None

# New Pydantic model for paginated Project response
class PaginatedProjectsResponse(BaseModel):
    total_count: int
    items: List[ProjectResponse]


# Routes
@router.get("/", response_model=PaginatedProjectsResponse)
async def get_projects(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=200, description="Number of items to return per page (max 200)")
):
    """Get all projects with pagination"""
    total_count = db.query(func.count(Project.id)).scalar()
    projects = db.query(Project).offset(skip).limit(limit).all()
    return PaginatedProjectsResponse(total_count=total_count, items=projects)

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
    
    # Query real integrations
    project_integrations = db.query(Integration).filter(Integration.project_id == project_id).all()
    return project_integrations

@router.get("/{project_id}/metrics", response_model=ProjectMetricsResponse)
async def get_project_metrics(project_id: int, db: Session = Depends(get_db)):
    """Get all metrics for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get active integrations for this project
    integrations = db.query(Integration).filter(
        Integration.project_id == project_id,
        Integration.active == True
    ).all()
    
    if not integrations:
        return ProjectMetricsResponse(
            project_id=project_id,
            project_name=project.name,
            integrations_count=0,
            has_metrics=False,
            metrics_by_integration={},
            summary={"message": "No active integrations found for this project"}
        )
        
    metrics_collection: Dict[int, Dict[str, Any]] = {}
    tasks = []

    for integration in integrations:
        project_key = None
        board_id = None
        days = 30  # Default lookback period

        if integration.type.lower() == "jira":
            project_key = integration.config.get("project_key") if integration.config else None
            if not project_key:
                print(f"Warning: project_key not found in config for Jira integration ID {integration.id} of project {project_id}. Metrics might be incomplete or fail.")
        elif integration.type.lower() == "trello":
            board_id = integration.config.get("board_id") if integration.config else None
            if not board_id:
                 print(f"Warning: board_id not found in config for Trello integration ID {integration.id} of project {project_id}. Metrics might be incomplete or fail.")
        
        current_metrics_request = MetricsRequest(days=days, project_key=project_key, board_id=board_id)
        
        tasks.append(
            get_metrics(
                integration_id=integration.id,
                metrics_request=current_metrics_request,
                db=db
            )
        )

    print(f"Gathering metrics for {len(tasks)} integrations concurrently for project {project_id}")
    results = await asyncio.gather(*tasks, return_exceptions=True)
    print(f"Finished gathering metrics for project {project_id}. Received {len(results)} results.")

    for i, result in enumerate(results):
        integration = integrations[i]
        integration_id_key = integration.id # Use actual integration ID as key

        if isinstance(result, Exception):
            print(f"Error fetching metrics for integration {integration.id} ({integration.name}) for project {project_id}: {str(result)}")
            metrics_collection[integration_id_key] = {
                "source": integration.name,
                "type": integration.type,
                "error": str(result),
                "data": {}
            }
        elif result and "metrics" in result:
            metrics_data = result["metrics"]
            if isinstance(metrics_data, dict) and "error" in metrics_data:
                 print(f"Application error fetching metrics for integration {integration.id} ({integration.name}) for project {project_id}: {metrics_data['error']}")
                 metrics_collection[integration_id_key] = {
                    "source": integration.name,
                    "type": integration.type,
                    "error": metrics_data['error'],
                    "data": {}
                }
            else:
                metrics_collection[integration_id_key] = {
                    "source": integration.name,
                    "type": integration.type,
                    "data": metrics_data
                }
        else:
            print(f"Unexpected result structure for integration {integration.id} for project {project_id}: {result}")
            metrics_collection[integration_id_key] = {
                "source": integration.name,
                "type": integration.type,
                "error": "Unexpected result structure from metrics fetch.",
                "data": {}
            }
            
    # Basic summary (can be expanded)
    total_fetched_metrics = sum(1 for m in metrics_collection.values() if not m.get("error") and m.get("data"))
    
    return ProjectMetricsResponse(
        project_id=project_id,
        project_name=project.name,
        integrations_count=len(integrations),
        has_metrics=total_fetched_metrics > 0,
        metrics_by_integration=metrics_collection,
        summary={
            "total_integrations_synced_successfully": total_fetched_metrics,
            "total_integrations_with_errors": len(integrations) - total_fetched_metrics
        }
    )