from src.backend.database import SessionLocal
from src.models.project import Project

def create_default_project():
    # Connect to the database
    db = SessionLocal()
    try:
        # Check if any project exists
        existing_project = db.query(Project).first()
        if existing_project:
            print(f"Default project already exists: {existing_project}")
            return existing_project.id
            
        # Create default project
        default_project = Project(
            name="Default Project",
            description="Default project for integrations"
        )
        db.add(default_project)
        db.commit()
        db.refresh(default_project)
        
        print(f"Default project created with id: {default_project.id}")
        return default_project.id
    except Exception as e:
        print(f"Error creating default project: {e}")
        db.rollback()
        return None
    finally:
        db.close()

if __name__ == "__main__":
    create_default_project() 