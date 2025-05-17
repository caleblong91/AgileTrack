from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.backend.database import Base

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # github, jira, trello, etc.
    config = Column(JSON)  # Store integration config as JSON
    api_key = Column(String)  # Encrypted in production
    api_url = Column(String)
    username = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_sync = Column(DateTime(timezone=True))
    active = Column(Boolean, default=True)
    
    # Foreign Keys
    team_id = Column(Integer, ForeignKey("teams.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)  # Optional, for backward compatibility
    
    # Relationships
    team = relationship("Team", back_populates="integrations")
    project = relationship("Project", back_populates="integrations")
    
    def __repr__(self):
        return f"<Integration {self.name} ({self.type})>" 