import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from src.backend.database import Base, get_db
from src.backend.main import app
from src.backend.auth import get_password_hash, create_access_token
from src.models.user import User
from src.models.team import Team
from src.models.integration import Integration

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Create test database and tables
def setup_test_db():
    Base.metadata.create_all(bind=engine)


# Tear down test database
def teardown_test_db():
    Base.metadata.drop_all(bind=engine)


# Override the get_db dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Setup test client
@pytest.fixture
def client():
    # Set up
    setup_test_db()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    # Tear down
    app.dependency_overrides = {}
    teardown_test_db()


# Create a test user with a token
@pytest.fixture
def authenticated_client(client):
    # Create user
    db = TestingSessionLocal()
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("password123"),
        setup_complete=True,
        has_integration=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create access token
    token = create_access_token(data={"sub": user.email})
    
    # Add auth header to client
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    return client, user


# Create test data for dashboard testing
@pytest.fixture
def dashboard_test_data(authenticated_client):
    client, user = authenticated_client
    db = TestingSessionLocal()
    
    # Create team
    team = Team(
        name="Test Team",
        description="Test team for dashboard testing",
        maturity_level=3,
        active=True
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    
    # Create GitHub integration
    github_integration = Integration(
        name="GitHub Integration",
        type="github",
        api_key="test_github_token",
        api_url=None,
        username=None,
        project_id=1,
        team_id=team.id,
        active=True,
        config={"repository": "test/repo"},
        last_sync=datetime.now() - timedelta(hours=1)
    )
    db.add(github_integration)
    
    # Create Jira integration
    jira_integration = Integration(
        name="Jira Integration",
        type="jira",
        api_key="test_jira_token",
        api_url="https://test.atlassian.net",
        username="test@example.com",
        project_id=1,
        team_id=team.id,
        active=True,
        config={"project_key": "TEST"},
        last_sync=datetime.now() - timedelta(hours=2)
    )
    db.add(jira_integration)
    
    db.commit()
    db.refresh(github_integration)
    db.refresh(jira_integration)
    
    return client, user, team, github_integration, jira_integration


# Test dashboard endpoint returns team data
def test_get_dashboard(dashboard_test_data):
    client, user, team, github_integration, jira_integration = dashboard_test_data
    
    response = client.get("/teams")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == team.id
    assert data[0]["name"] == "Test Team"
    assert data[0]["maturity_level"] == 3


# Test getting integrations for a team
def test_get_team_integrations(dashboard_test_data):
    client, user, team, github_integration, jira_integration = dashboard_test_data
    
    response = client.get(f"/teams/{team.id}/integrations")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    
    # Check both integrations are in the response
    integration_names = [i["name"] for i in data]
    assert "GitHub Integration" in integration_names
    assert "Jira Integration" in integration_names
    
    # Check integration details
    github_data = next(i for i in data if i["name"] == "GitHub Integration")
    assert github_data["type"] == "github"
    assert github_data["team_id"] == team.id
    assert github_data["config"]["repository"] == "test/repo"


# Test getting metrics for a team
@patch('src.integrations.integration_factory.IntegrationFactory.create_integration')
@patch('src.integrations.integration_factory.IntegrationFactory.get_metrics')
def test_get_team_metrics(mock_get_metrics, mock_create_integration, dashboard_test_data):
    client, user, team, github_integration, jira_integration = dashboard_test_data
    
    # Mock the integration instance
    mock_github = MagicMock()
    mock_jira = MagicMock()
    
    # Setup return values for create_integration
    def side_effect_create(integration_type, config):
        if integration_type == "github":
            return mock_github
        elif integration_type == "jira":
            return mock_jira
    
    mock_create_integration.side_effect = side_effect_create
    
    # Setup metrics data
    github_metrics = {
        "pr_count": 10,
        "pr_merge_rate": 0.8,
        "avg_time_to_merge_hours": 24,
        "commit_count": 50,
        "avg_commit_size": 75,
        "issue_count": 20,
        "issue_close_rate": 0.6
    }
    
    jira_metrics = {
        "story_points_completed": 100,
        "story_points_total": 150,
        "velocity": 20,
        "issues_created": 30,
        "issues_resolved": 25
    }
    
    # Setup return values for get_metrics
    def side_effect_metrics(integration_instance, config):
        if integration_instance == mock_github:
            return github_metrics
        elif integration_instance == mock_jira:
            return jira_metrics
    
    mock_get_metrics.side_effect = side_effect_metrics
    
    # Call the endpoint
    response = client.get(f"/teams/{team.id}/metrics")
    assert response.status_code == 200
    
    data = response.json()
    assert "team_id" in data
    assert data["team_id"] == team.id
    
    # Should have metrics for both integrations
    assert len(mock_get_metrics.call_args_list) == 2
    
    # Verify GitHub metrics
    response = client.post(f"/integrations/{github_integration.id}/metrics", json={"days": 30})
    assert response.status_code == 200
    
    github_data = response.json()
    assert github_data["integration_name"] == "GitHub Integration"
    assert github_data["metrics"] == github_metrics
    
    # Verify Jira metrics
    response = client.post(f"/integrations/{jira_integration.id}/metrics", json={"days": 30, "project_key": "TEST"})
    assert response.status_code == 200
    
    jira_data = response.json()
    assert jira_data["integration_name"] == "Jira Integration"
    assert jira_data["metrics"] == jira_metrics


# Test dashboard with inactive integrations
def test_dashboard_with_inactive_integration(dashboard_test_data):
    client, user, team, github_integration, jira_integration = dashboard_test_data
    
    # Update the GitHub integration to be inactive
    db = TestingSessionLocal()
    github_int = db.query(Integration).filter(Integration.id == github_integration.id).first()
    github_int.active = False
    db.commit()
    
    # Check that inactive integrations are filtered out by default
    response = client.get(f"/teams/{team.id}/integrations?active_only=true")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1  # Only the active Jira integration
    assert data[0]["name"] == "Jira Integration"
    
    # Check that we can include inactive integrations when needed
    response = client.get(f"/teams/{team.id}/integrations?active_only=false")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2  # Both integrations


# Test dashboard without any integrations
def test_dashboard_without_integrations(authenticated_client):
    client, user = authenticated_client
    db = TestingSessionLocal()
    
    # Create team without integrations
    team = Team(
        name="Empty Team",
        description="Team with no integrations",
        maturity_level=1,
        active=True
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    
    # Get team integrations
    response = client.get(f"/teams/{team.id}/integrations")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0  # No integrations
    
    # Get team metrics
    response = client.get(f"/teams/{team.id}/metrics")
    assert response.status_code == 200
    
    data = response.json()
    assert "message" in data
    assert "No integrations found" in data["message"]
    assert data["integrations_count"] == 0 