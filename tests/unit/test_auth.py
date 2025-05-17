import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.backend.database import Base, get_db
from src.backend.main import app
from src.backend.auth import get_password_hash
from src.models.user import User

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


# Create a test user
@pytest.fixture
def test_user(client):
    user_data = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "password123",
        "full_name": "Test User"
    }
    
    # Create user directly in the database
    db = TestingSessionLocal()
    db_user = User(
        email=user_data["email"],
        username=user_data["username"],
        hashed_password=get_password_hash(user_data["password"]),
        full_name=user_data["full_name"]
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    db.close()
    
    return user_data


# Test user registration
def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "newpassword123",
            "full_name": "New User"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["username"] == "newuser"
    assert "hashed_password" not in data
    assert data["setup_complete"] is False
    assert data["has_integration"] is False


# Test duplicate email registration
def test_register_duplicate_email(client, test_user):
    response = client.post(
        "/auth/register",
        json={
            "email": test_user["email"],
            "username": "another_username",
            "password": "password123",
            "full_name": "Another User"
        }
    )
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


# Test duplicate username registration
def test_register_duplicate_username(client, test_user):
    response = client.post(
        "/auth/register",
        json={
            "email": "another@example.com",
            "username": test_user["username"],
            "password": "password123",
            "full_name": "Another User"
        }
    )
    assert response.status_code == 400
    assert "Username already taken" in response.json()["detail"]


# Test user login
def test_login(client, test_user):
    response = client.post(
        "/auth/login",
        json={
            "email": test_user["email"],
            "password": test_user["password"]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


# Test login with invalid credentials
def test_login_invalid_credentials(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


# Test accessing protected endpoint
def test_access_protected_endpoint(client, test_user):
    # First login to get token
    login_response = client.post(
        "/auth/login",
        json={
            "email": test_user["email"],
            "password": test_user["password"]
        }
    )
    token = login_response.json()["access_token"]
    
    # Now access protected endpoint with token
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]
    assert data["username"] == test_user["username"]


# Test accessing protected endpoint without token
def test_access_protected_endpoint_without_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


# Test user setup
def test_user_setup(client, test_user):
    # Login first
    login_response = client.post(
        "/auth/login",
        json={
            "email": test_user["email"],
            "password": test_user["password"]
        }
    )
    token = login_response.json()["access_token"]
    
    # Update user setup info
    setup_data = {
        "full_name": "Updated Name",
        "company": "Test Company",
        "role": "developer",
        "team_size": "1-5"
    }
    response = client.put(
        "/auth/setup",
        json=setup_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == setup_data["full_name"]
    assert data["company"] == setup_data["company"]
    assert data["role"] == setup_data["role"]
    assert data["team_size"] == setup_data["team_size"]
    assert data["setup_complete"] is True 