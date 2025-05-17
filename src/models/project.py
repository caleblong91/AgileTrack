from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.backend.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    active = Column(Boolean, default=True)
    
    # Relationships - using strings to avoid circular imports
    integrations = relationship("Integration", back_populates="project")
    metrics = relationship("Metric", back_populates="project")
    sprints = relationship("Sprint", back_populates="project")
    team_members = relationship("TeamMember", back_populates="project")
    
    def __repr__(self):
        return f"<Project {self.name}>" 