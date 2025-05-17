from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.sql import func

from src.backend.database import get_db
from src.models.integration import Integration
from src.models.project import Project
from src.integrations.integration_factory import IntegrationFactory

router = APIRouter(prefix="/integrations", tags=["integrations"])

# Pydantic models for request/response
class IntegrationBase(BaseModel):
    name: str
    type: str
    api_url: Optional[str] = None
    username: Optional[str] = None
    project_id: int
    
class IntegrationCreate(IntegrationBase):
    api_key: str
    config: Optional[Dict[str, Any]] = None
    
class IntegrationResponse(IntegrationBase):
    id: int
    active: bool
    last_sync: Optional[str] = None
    
    class Config:
        orm_mode = True
        
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

# Routes
@router.get("/", response_model=List[IntegrationResponse])
async def get_integrations(db: Session = Depends(get_db)):
    """Get all integrations"""
    integrations = db.query(Integration).all()
    return integrations

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
    
    # Create new integration in DB
    db_integration = Integration(
        name=integration.name,
        type=integration.type,
        api_key=integration.api_key,
        api_url=integration.api_url,
        username=integration.username,
        config=integration.config,
        project_id=project_id
    )
    
    try:
        db.add(db_integration)
        db.commit()
        db.refresh(db_integration)
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
    integration_update: IntegrationCreate, 
    db: Session = Depends(get_db)
):
    """Update an integration"""
    db_integration = db.query(Integration).filter(Integration.id == integration_id).first()
    
    if db_integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    # Update fields
    for key, value in integration_update.dict(exclude_unset=True).items():
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

@router.post("/github/repositories")
async def get_github_repositories(request: GitHubTokenRequest):
    """Fetch repositories available for a GitHub API token"""
    try:
        from github import Github
        
        # Initialize the GitHub client with the provided token
        github_client = Github(request.api_key)
        
        # Fetch repositories the user has access to
        repos = []
        for repo in github_client.get_user().get_repos():
            repos.append({
                "id": repo.full_name,
                "name": repo.full_name,
                "description": repo.description,
                "private": repo.private,
                "url": repo.html_url
            })
        
        return {"repositories": repos}
    except Exception as e:
        print(f"Error fetching GitHub repositories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch repositories: {str(e)}"
        )

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
            "api_key": integration.config.get("api_key") if integration.config else None,
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
        
        # Update last sync in DB
        integration.last_sync = func.now()
        db.commit()
        
        return {
            "integration_id": integration.id,
            "integration_name": integration.name,
            "integration_type": integration.type,
            "metrics": metrics
        }
    except Exception as e:
        print(f"Exception in metrics endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 