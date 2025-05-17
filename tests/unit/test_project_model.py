import pytest
from sqlalchemy.exc import IntegrityError
from src.models.project import Project

@pytest.mark.unit
@pytest.mark.models
class TestProjectModel:
    """Tests for the Project model"""
    
    def test_create_project(self, db_session):
        """Test creating a project"""
        # Create a new project
        project = Project(name="Test Project", description="Test Description")
        db_session.add(project)
        db_session.commit()
        
        # Verify the project was created
        assert project.id is not None
        assert project.name == "Test Project"
        assert project.description == "Test Description"
        assert project.active is True
    
    def test_project_name_required(self, db_session):
        """Test that project name is required"""
        # Try to create a project without a name
        project = Project(description="Test Description")
        db_session.add(project)
        
        # Verify that an exception is raised
        with pytest.raises(IntegrityError):
            db_session.commit()
        
        # Rollback the failed transaction
        db_session.rollback()
    
    def test_project_relationships(self, db_session):
        """Test project relationships"""
        # Create a new project
        project = Project(name="Test Project", description="Test Description")
        db_session.add(project)
        db_session.commit()
        
        # Verify relationships are initialized to empty lists
        assert project.integrations == []
        assert project.metrics == []
        assert project.sprints == []
        assert project.team_members == []
    
    def test_project_repr(self, db_session):
        """Test project __repr__ method"""
        # Create a new project
        project = Project(name="Test Project")
        
        # Verify the string representation
        assert str(project) == "<Project Test Project>"
        
    def test_update_project(self, db_session):
        """Test updating a project"""
        # Create a new project
        project = Project(name="Test Project", description="Test Description")
        db_session.add(project)
        db_session.commit()
        
        # Update the project
        project.name = "Updated Project"
        project.description = "Updated Description"
        project.active = False
        db_session.commit()
        
        # Verify the project was updated
        updated_project = db_session.query(Project).filter(Project.id == project.id).first()
        assert updated_project.name == "Updated Project"
        assert updated_project.description == "Updated Description"
        assert updated_project.active is False 