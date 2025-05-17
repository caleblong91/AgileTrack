from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.backend.database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    active = Column(Boolean, default=True)
    
    # Team metrics and maturity level
    maturity_level = Column(Integer, default=1)  # 1-5 scale for team maturity
    
    # Relationships - using strings to avoid circular imports
    projects = relationship("Project", back_populates="team")
    integrations = relationship("Integration", back_populates="team")
    metrics = relationship("Metric", back_populates="team")
    team_members = relationship("TeamMember", back_populates="team")
    sprints = relationship("Sprint", back_populates="team")
    
    def __repr__(self):
        return f"<Team {self.name}>" 