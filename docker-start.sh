#!/bin/bash
set -e

echo "Starting AgileTrack with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Build the containers
echo "Building containers..."
docker-compose build

# Start the containers
echo "Starting containers..."
docker-compose up -d

# Initialize the database (this runs inside the backend container)
echo "Initializing database..."
docker-compose exec backend ./init-db.sh

echo "AgileTrack is now running!"
echo "- Frontend: http://localhost"
echo "- API: http://localhost/api"
echo "- API docs: http://localhost/api/docs"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop the application: docker-compose down" 