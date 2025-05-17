from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

from src.backend.database import get_db
from src.models.team import Team
from src.models.project import Project
from src.models.integration import Integration
from src.backend.routes.integrations import get_metrics

router = APIRouter(prefix="/teams", tags=["teams"])

# Pydantic models for request/response
class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None
    
class TeamCreate(TeamBase):
    pass
    
class TeamResponse(TeamBase):
    id: int
    active: bool
    maturity_level: int
    
    class Config:
        orm_mode = True

class ProjectBrief(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    active: bool
    
    class Config:
        orm_mode = True

# Mock data for integrations (similar to projects.py)
MOCK_INTEGRATION_TYPES = ["GitHub", "Jira", "Trello", "GitLab"]

def generate_mock_integrations(team_id: int) -> List[Dict[str, Any]]:
    """Generate mock integrations for a team"""
    num_integrations = random.randint(1, 3)
    integration_types = random.sample(MOCK_INTEGRATION_TYPES, num_integrations)
    
    return [
        {
            "id": i + 1,
            "team_id": team_id,
            "type": integration_type,
            "config": {"url": f"https://api.{integration_type.lower()}.com", "token": "sample_token"},
            "active": True,
            "created_at": (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
        }
        for i, integration_type in enumerate(integration_types)
    ]

def generate_mock_metrics(team_id: int) -> Dict[str, Any]:
    """Generate mock metrics data for a team"""
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
    
    # Team-specific metrics
    maturity_metrics = {
        "collaboration_score": round(random.uniform(1.0, 5.0), 1),
        "technical_practices_score": round(random.uniform(1.0, 5.0), 1),
        "delivery_predictability": round(random.uniform(1.0, 5.0), 1),
        "quality_score": round(random.uniform(1.0, 5.0), 1),
        "overall_maturity": round(random.uniform(1.0, 5.0), 1)
    }
    
    return {
        "velocity": velocities,
        "burndown": burndown,
        "cycletime": cycle_times,
        "sprints": sprint_names,
        "team_id": team_id,
        "maturity_metrics": maturity_metrics
    }

# Routes
@router.get("/", response_model=List[TeamResponse])
async def get_teams(db: Session = Depends(get_db)):
    """Get all teams"""
    teams = db.query(Team).all()
    return teams

@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(team: TeamCreate, db: Session = Depends(get_db)):
    """Create a new team"""
    db_team = Team(
        name=team.name,
        description=team.description
    )
    
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    
    return db_team

@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: int, db: Session = Depends(get_db)):
    """Get team by ID"""
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
        
    return team

@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: int, 
    team_update: TeamCreate, 
    db: Session = Depends(get_db)
):
    """Update a team"""
    db_team = db.query(Team).filter(Team.id == team_id).first()
    
    if db_team is None:
        raise HTTPException(status_code=404, detail="Team not found")
        
    # Update fields
    for key, value in team_update.dict(exclude_unset=True).items():
        setattr(db_team, key, value)
        
    db.commit()
    db.refresh(db_team)
    
    return db_team

@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: int, db: Session = Depends(get_db)):
    """Delete a team"""
    db_team = db.query(Team).filter(Team.id == team_id).first()
    
    if db_team is None:
        raise HTTPException(status_code=404, detail="Team not found")
        
    # Set team as inactive instead of deleting
    db_team.active = False
    db.commit()
    
    return None

@router.get("/{team_id}/projects", response_model=List[ProjectBrief])
async def get_team_projects(team_id: int, db: Session = Depends(get_db)):
    """Get all projects for a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
        
    return team.projects

@router.get("/{team_id}/integrations")
async def get_team_integrations(team_id: int, db: Session = Depends(get_db)):
    """Get all integrations for a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Query for real integrations linked to this team
    # Check both team_id and project_id fields for backward compatibility
    integrations = db.query(Integration).filter(
        or_(
            Integration.team_id == team_id,
            Integration.project_id == team_id
        )
    ).all()
    
    # Verify each integration still exists by checking if we can get it by ID
    # This ensures we don't return any "phantom" integrations
    valid_integrations = []
    for integration in integrations:
        check_integration = db.query(Integration).filter(Integration.id == integration.id).first()
        if check_integration:
            valid_integrations.append(integration)
    
    return valid_integrations

@router.get("/{team_id}/metrics")
async def get_team_metrics(team_id: int, db: Session = Depends(get_db)):
    """Get all metrics for a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get real integrations for this team
    integrations = db.query(Integration).filter(
        or_(
            Integration.team_id == team_id,
            Integration.project_id == team_id
        )
    ).all()
    
    # If no integrations, return minimal data structure
    if not integrations:
        return {
            "message": "No integrations found for this team",
            "team_id": team_id,
            "integrations_count": 0
        }
    
    # Collect metrics from all integrations
    metrics_collection = {}
    
    for integration in integrations:
        try:
            # Try to get cached metrics first (from last_sync)
            if integration.last_sync:
                # Use metrics based on integration type
                if integration.type.lower() == "github":
                    # Get GitHub-specific metrics by calling the metrics endpoint
                    metrics_response = await get_metrics(
                        integration_id=integration.id,
                        metrics_request={"days": 30},
                        db=db
                    )
                    if metrics_response and "metrics" in metrics_response:
                        metrics_collection[integration.id] = {
                            "source": integration.name,
                            "type": integration.type,
                            "data": metrics_response["metrics"]
                        }
        except Exception as e:
            print(f"Error fetching metrics for integration {integration.id}: {str(e)}")
            continue
    
    # Transform the metrics into a standardized dashboard format
    velocity_data = []
    quality_data = []
    team_metrics = {
        "team_id": team_id,
        "team_name": team.name,
        "integrations_count": len(integrations),
        "has_metrics": len(metrics_collection) > 0,
        "metrics_by_integration": metrics_collection,
        "summary": {
            "velocity": sum([m.get("data", {}).get("pr_count", 0) for m in metrics_collection.values() if m.get("data")]) or 0,
            "quality": sum([m.get("data", {}).get("pr_merge_rate", 0) * 100 for m in metrics_collection.values() if m.get("data")]) / max(1, len(metrics_collection)) if metrics_collection else 0,
            "maturity_level": team.maturity_level
        }
    }
    
    return team_metrics 