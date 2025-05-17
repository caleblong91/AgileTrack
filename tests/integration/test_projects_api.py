import pytest
from fastapi import status

@pytest.mark.integration
@pytest.mark.api
class TestProjectsAPI:
    """Integration tests for the Projects API"""
    
    def test_create_project(self, client, sample_project_data):
        """Test creating a project via API"""
        # Create a project
        response = client.post("/projects/", json=sample_project_data)
        
        # Verify the response
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == sample_project_data["name"]
        assert data["description"] == sample_project_data["description"]
        assert data["active"] is True
        assert "id" in data
    
    def test_get_projects(self, client, sample_project_data):
        """Test getting all projects via API"""
        # Create a project first
        client.post("/projects/", json=sample_project_data)
        
        # Get all projects
        response = client.get("/projects/")
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == sample_project_data["name"]
    
    def test_get_project_by_id(self, client, sample_project_data):
        """Test getting a project by ID via API"""
        # Create a project first
        create_response = client.post("/projects/", json=sample_project_data)
        project_id = create_response.json()["id"]
        
        # Get the project by ID
        response = client.get(f"/projects/{project_id}")
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == sample_project_data["name"]
        assert data["description"] == sample_project_data["description"]
    
    def test_get_project_not_found(self, client):
        """Test getting a project that doesn't exist"""
        # Try to get a project with an invalid ID
        response = client.get("/projects/999")
        
        # Verify the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Project not found"
    
    def test_update_project(self, client, sample_project_data):
        """Test updating a project via API"""
        # Create a project first
        create_response = client.post("/projects/", json=sample_project_data)
        project_id = create_response.json()["id"]
        
        # Update the project
        update_data = {
            "name": "Updated Project",
            "description": "Updated description"
        }
        response = client.put(f"/projects/{project_id}", json=update_data)
        
        # Verify the response
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        
        # Verify the project was updated in the database
        get_response = client.get(f"/projects/{project_id}")
        assert get_response.json()["name"] == update_data["name"]
    
    def test_delete_project(self, client, sample_project_data):
        """Test deleting a project via API"""
        # Create a project first
        create_response = client.post("/projects/", json=sample_project_data)
        project_id = create_response.json()["id"]
        
        # Delete the project
        response = client.delete(f"/projects/{project_id}")
        
        # Verify the response
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify the project is now inactive
        get_response = client.get(f"/projects/{project_id}")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.json()["active"] is False 