#!/bin/bash
set -e

# Update your database URL to point to the Docker PostgreSQL service
cat > .env << EOL
DATABASE_URL=postgresql://postgres:postgres@db:5432/agiletrack
REDIS_URL=redis://redis:6379/0
EOL

# Wait for the PostgreSQL service to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! pg_isready -h db -p 5432 -U postgres; do
  sleep 1
done

echo "Creating database tables..."
# Run database migrations - we'll create these manually
python -c "
from src.backend.database import Base, engine
from src.models.project import Project, Sprint, TeamMember
from src.models.integration import Integration
from src.models.metric import Metric

# Create all tables
Base.metadata.create_all(bind=engine)
"

echo "Database initialization completed!" 