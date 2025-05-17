import pytest
import os
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from src.backend.main import app
from src.backend.database import Base, get_db

# Test database setup
@pytest.fixture(scope="session")
def test_db_engine():
    """Create a test database engine"""
    # Create temporary file for SQLite database
    db_file_handle, db_file_path = tempfile.mkstemp()
    test_db_url = f"sqlite:///{db_file_path}"
    
    # Create engine and tables
    engine = create_engine(test_db_url)
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Cleanup
    os.close(db_file_handle)
    os.unlink(db_file_path)

@pytest.fixture
def db_session(test_db_engine):
    """Create a test database session"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db_session):
    """Create a test client for FastAPI app"""
    # Override the get_db dependency to use the test database
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    
    # Remove the override after the test
    app.dependency_overrides.clear()

# Mock Integration Fixtures
@pytest.fixture
def mock_github_integration():
    """Mock GitHub integration"""
    class MockGitHubIntegration:
        def __init__(self, api_token=None, repository=None):
            self.api_token = api_token or "mock_token"
            self.repository_name = repository or "mock/repo"
        
        def set_repository(self, repository_name):
            self.repository_name = repository_name
            return {"name": repository_name}
        
        def get_pull_requests(self, state="all", days=30):
            return [{"id": 1, "title": "Test PR", "state": "open"}]
        
        def get_commits(self, days=30):
            return [{"sha": "abc123", "message": "Test commit"}]
        
        def calculate_metrics(self, days=30):
            return {
                "pr_count": 10,
                "commit_count": 50,
                "avg_time_to_merge_hours": 24
            }
    
    return MockGitHubIntegration()

@pytest.fixture
def mock_jira_integration():
    """Mock Jira integration"""
    class MockJiraIntegration:
        def __init__(self, server=None, username=None, api_token=None):
            self.server = server or "https://mock.atlassian.net"
            self.username = username or "mock_user"
            self.api_token = api_token or "mock_token"
        
        def get_projects(self):
            return [{"id": "PRJ", "name": "Test Project"}]
        
        def get_issues(self, project_key, days=30):
            return [{"id": "PRJ-1", "summary": "Test Issue", "status": "In Progress"}]
        
        def calculate_metrics(self, project_key, days=30):
            return {
                "issue_counts_by_type": {"Story": 10, "Bug": 5},
                "completed_story_points": 45
            }
    
    return MockJiraIntegration()

@pytest.fixture
def mock_trello_integration():
    """Mock Trello integration"""
    class MockTrelloIntegration:
        def __init__(self, api_key=None, api_secret=None, token=None):
            self.api_key = api_key or "mock_key"
            self.api_secret = api_secret or "mock_secret"
            self.token = token or "mock_token"
        
        def get_boards(self):
            return [{"id": "board1", "name": "Test Board"}]
        
        def get_cards(self, board_id, days=30):
            return [{"id": "card1", "name": "Test Card", "list_name": "To Do"}]
        
        def calculate_metrics(self, board_id, days=30):
            return {
                "card_counts_by_list": {"To Do": 5, "Doing": 3, "Done": 10},
                "open_card_count": 8,
                "closed_card_count": 10
            }
    
    return MockTrelloIntegration()

# Test data fixtures
@pytest.fixture
def sample_project_data():
    """Sample project data"""
    return {
        "name": "Test Project",
        "description": "A test project for unit tests"
    }

@pytest.fixture
def sample_integration_data():
    """Sample integration data"""
    return {
        "name": "Test GitHub Integration",
        "type": "github",
        "api_key": "test_api_key",
        "api_url": "https://api.github.com",
        "project_id": 1,
        "config": {
            "repository": "test/repo"
        }
    } 