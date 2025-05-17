#!/bin/bash
set -e

echo "Running AgileTrack tests with Docker..."

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

# Run all tests or specific component
if [ "$1" == "backend" ]; then
    echo "Running backend tests..."
    docker-compose -f docker-compose.test.yml run --rm backend-tests
elif [ "$1" == "frontend" ]; then
    echo "Running frontend tests..."
    docker-compose -f docker-compose.test.yml run --rm frontend-tests
else
    echo "Running all tests..."
    docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
fi

# Clean up test containers
echo "Cleaning up test containers..."
docker-compose -f docker-compose.test.yml down

echo "Tests completed!" 