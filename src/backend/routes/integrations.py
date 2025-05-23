from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, field_serializer
from sqlalchemy.sql import func
from datetime import datetime

from src.backend.database import get_db
from src.models.integration import Integration
from src.models.project import Project
from src.integrations.integration_factory import IntegrationFactory
from src.integrations.trello_integration import TrelloIntegration
from src.backend.tasks import initial_sync_metrics_task # Import the Celery task
from src.models.metric import Metric

router = APIRouter(prefix="/integrations", tags=["integrations"])

# Pydantic models for request/response
class IntegrationBase(BaseModel):
    name: str
    type: str
    api_url: Optional[str] = None
    username: Optional[str] = None
    project_id: int
    team_id: Optional[int] = None
    
class IntegrationCreate(IntegrationBase):
    api_key: str
    config: Optional[Dict[str, Any]] = None

class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    api_key: Optional[str] = None
    project_id: Optional[int] = None
    team_id: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    
class IntegrationResponse(IntegrationBase):
    id: int
    active: bool
    last_sync: Optional[Union[str, datetime]] = None
    
    @field_serializer('last_sync')
    def serialize_dt(self, dt: Optional[Union[str, datetime]], _info):
        if dt is None:
            return None
        if isinstance(dt, str):
            return dt
        return dt.isoformat()
    
    class Config:
        orm_mode = True
        from_attributes = True

# New Pydantic model for paginated response
class PaginatedIntegrationsResponse(BaseModel):
    total_count: int
    items: List[IntegrationResponse]
        
class MetricsRequest(BaseModel):
    days: Optional[int] = 30
    project_key: Optional[str] = None
    board_id: Optional[str] = None
    
class MetricsResponse(BaseModel):
    integration_id: int
    integration_name: str
    integration_type: str
    metrics: Dict[str, Any]

class GitHubTokenRequest(BaseModel):
    api_key: str

class GitHubRepositoriesRequest(BaseModel):
    api_key: str

class TrelloBoardsRequest(BaseModel):
    api_key: str
    token: Optional[str] = None

class RepositoriesResponse(BaseModel):
    repositories: List[Dict[str, Any]]

class BoardsResponse(BaseModel):
    boards: List[Dict[str, Any]]

# Routes
@router.get("/", response_model=PaginatedIntegrationsResponse)
async def get_integrations(
    db: Session = Depends(get_db), 
    skip: int = Query(0, ge=0, description="Number of items to skip"), 
    limit: int = Query(100, ge=1, le=200, description="Number of items to return per page (max 200)")
):
    """Get all integrations with pagination"""
    total_count = db.query(func.count(Integration.id)).scalar()
    integrations = db.query(Integration).offset(skip).limit(limit).all()
    return PaginatedIntegrationsResponse(total_count=total_count, items=integrations)

@router.post("/", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(integration: IntegrationCreate, db: Session = Depends(get_db)):
    """Create a new integration"""
    # Validate the integration type
    try:
        IntegrationFactory.get_supported_metrics(integration.type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Check if project exists, if not create a default project
    project_id = integration.project_id
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        # Create a default project if not found
        default_project = Project(
            name="Default Project",
            description="Default project created automatically"
        )
        db.add(default_project)
        db.commit()
        db.refresh(default_project)
        project_id = default_project.id
        print(f"Created default project with ID: {project_id}")
    
    # Use team_id from request or default to project_id
    team_id = integration.team_id or project_id
    print(f"Creating integration with team_id: {team_id}, project_id: {project_id}")
    
    # Create new integration in DB
    db_integration = Integration(
        name=integration.name,
        type=integration.type,
        api_key=integration.api_key,
        api_url=integration.api_url,
        username=integration.username,
        config=integration.config,
        project_id=project_id,
        team_id=team_id,
        active=True
    )
    
    try:
        db.add(db_integration)
        db.commit()
        db.refresh(db_integration)
        
        # Trigger initial metrics sync asynchronously using Celery
        try:
            print(f"Queueing initial metrics sync task for integration {db_integration.id}")
            initial_sync_metrics_task.delay(db_integration.id)
            print(f"Successfully queued Celery task for integration {db_integration.id}")
        except Exception as e:
            # Log the error but don't let it fail the integration creation
            print(f"Error queueing Celery task for initial metrics sync for integration {db_integration.id}: {str(e)}")
            # Depending on policy, you might want to raise an alert here or handle it more actively.
            # For now, the integration is created, but sync might need manual trigger or await a periodic job.

        return db_integration
    except Exception as e:
        db.rollback()
        print(f"Error creating integration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create integration: {str(e)}")

@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(integration_id: int, db: Session = Depends(get_db)):
    """Get integration by ID"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    return integration

@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: int, 
    integration_update: IntegrationUpdate, 
    db: Session = Depends(get_db)
):
    """Update an integration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if db_integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    # Update fields
    update_data = integration_update.dict(exclude_unset=True)
    
    # For config, we want to completely replace it rather than update it
    # This ensures old fields are removed when switching integration types
    if 'config' in update_data:
        update_data['config'] = update_data['config']
    
    for key, value in update_data.items():
        setattr(db_integration, key, value)
        
    db.commit()
    db.refresh(db_integration)
    
    return db_integration

@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(integration_id: int, db: Session = Depends(get_db)):
    """Delete an integration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if db_integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    db.delete(db_integration)
    db.commit()
    
    return None

@router.get("/types", response_model=List[str])
async def get_integration_types():
    """Get supported integration types"""
    return ["github", "jira", "trello"]

@router.get("/types/{integration_type}/metrics", response_model=Dict[str, str])
async def get_integration_metrics(integration_type: str):
    """Get supported metrics for an integration type"""
    try:
        return IntegrationFactory.get_supported_metrics(integration_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/github/repositories", response_model=RepositoriesResponse)
async def get_github_repositories(request: GitHubRepositoriesRequest):
    """Get GitHub repositories for a user"""
    try:
        client = GitHubIntegration(api_token=request.api_key)
        repositories = client.get_repositories()
        return {"repositories": repositories}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/trello/boards", response_model=BoardsResponse)
async def get_trello_boards(request: TrelloBoardsRequest):
    """Get Trello boards for a user"""
    try:
        # Create TrelloIntegration instance with both API key and token
        client = TrelloIntegration(api_key=request.api_key, token=request.token)
        boards_df = client.get_boards()
        # Convert DataFrame to list of dictionaries
        boards = boards_df.to_dict('records') if not boards_df.empty else []
        return {"boards": boards}
    except Exception as e:
        print(f"Error fetching Trello boards: {str(e)}")  # Add logging
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{integration_id}/metrics", response_model=MetricsResponse)
async def get_metrics(
    integration_id: int, 
    metrics_request: MetricsRequest, 
    db: Session = Depends(get_db)
):
    """Get metrics from an integration"""
    # Get integration from DB
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check if integration has required configuration    
    if integration.type == "github" and (not integration.config or not integration.config.get("repository")):
        # GitHub integration requires a repository name
        return {
            "integration_id": integration.id,
            "integration_name": integration.name,
            "integration_type": integration.type,
            "metrics": {
                "error": "Repository name not configured. Please edit the integration to add a repository."
            }
        }
    
    if integration.type == "jira" and not metrics_request.project_key:
        # Jira integration requires a project key
        return {
            "integration_id": integration.id,
            "integration_name": integration.name,
            "integration_type": integration.type,
            "metrics": {
                "error": "Project key not provided. Please specify a project_key in your request."
            }
        }
    
    if integration.type == "trello" and not metrics_request.board_id:
        # Trello integration requires a board ID
        return {
            "integration_id": integration.id,
            "integration_name": integration.name,
            "integration_type": integration.type,
            "metrics": {
                "error": "Board ID not provided. Please specify a board_id in your request."
            }
        }
        
    # Create integration instance
    try:
        config = {
            "api_token": integration.api_key,
            "server": integration.api_url,
            "username": integration.username,
            "repository": integration.config.get("repository") if integration.config else None,
            "api_key": integration.api_key if integration.type == "trello" else (integration.config.get("api_key") if integration.config else None),
            "api_secret": integration.config.get("api_secret") if integration.config else None,
            "token": integration.config.get("token") if integration.config else None
        }
        
        print(f"Integration {integration.id} config: {config}")
        
        integration_instance = IntegrationFactory.create_integration(
            integration_type=integration.type,
            config=config
        )
        
        # Prepare config for metric calculation
        metrics_config = {
            "days": metrics_request.days,
            "project_key": metrics_request.project_key,
            "board_id": metrics_request.board_id
        }
        
        # Get metrics
        try:
            metrics = IntegrationFactory.get_metrics(integration_instance, metrics_config)
            
            # Store metrics in database
            # Store each metric
            for metric_name, metric_value in metrics.items():
                if isinstance(metric_value, (int, float)):
                    # Create a new metric record
                    metric = Metric(
                        name=metric_name,
                        category=integration.type,  # Use integration type as category
                        value=float(metric_value),
                        raw_data=metrics,  # Store all metrics as raw data
                        team_id=integration.team_id,
                        project_id=integration.project_id
                    )
                    db.add(metric)
            
            # Update last sync in DB
            integration.last_sync = func.now()
            db.commit()
            
        except ValueError as ve:
            # Handle validation errors in a user-friendly way
            return {
                "integration_id": integration.id,
                "integration_name": integration.name,
                "integration_type": integration.type,
                "metrics": {
                    "error": str(ve)
                }
            }
        except Exception as e:
            # Log detailed error but return user-friendly message
            print(f"Error getting metrics for integration {integration.id}: {str(e)}")
            
            # Check for GitHub empty repository error
            error_str = str(e)
            if "409" in error_str and "Git Repository is empty" in error_str:
                return {
                    "integration_id": integration.id,
                    "integration_name": integration.name,
                    "integration_type": integration.type,
                    "metrics": {
                        "error": "The GitHub repository is empty. Please make at least one commit before syncing."
                    }
                }
            
            return {
                "integration_id": integration.id,
                "integration_name": integration.name,
                "integration_type": integration.type,
                "metrics": {
                    "error": "Failed to retrieve metrics. Please check your integration configuration."
                }
            }
        
        return {
            "integration_id": integration.id,
            "integration_name": integration.name,
            "integration_type": integration.type,
            "metrics": metrics
        }
    except Exception as e:
        print(f"Exception in metrics endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 