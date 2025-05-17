from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.backend.database import Base

class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # velocity, quality, collaboration, etc.
    value = Column(Float)
    raw_data = Column(JSON)  # Store raw data as JSON
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    project_id = Column(Integer, ForeignKey("projects.id"))
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="metrics")
    sprint = relationship("Sprint", back_populates="metrics")
    
    def __repr__(self):
        return f"<Metric {self.name} ({self.value})>"
        
class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    goal = Column(String)
    status = Column(String)  # active, completed, etc.
    project_id = Column(Integer, ForeignKey("projects.id"))
    
    # Relationships
    project = relationship("Project", back_populates="sprints")
    metrics = relationship("Metric", back_populates="sprint")
    
    def __repr__(self):
        return f"<Sprint {self.name}>"
        
class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String)
    role = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"))
    
    # Relationships
    project = relationship("Project", back_populates="team_members")
    
    def __repr__(self):
        return f"<TeamMember {self.name}>" 