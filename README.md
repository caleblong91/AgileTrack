# AgileTrack

A comprehensive platform for tracking and improving agile maturity across development teams. AgileTrack provides insights by collecting and analyzing data from multiple sources like GitHub, Jira, and Trello.

## Features

- **Multi-source Integration**: Connect with GitHub, Jira, Trello, and more
- **Comprehensive Metrics**: Track velocity, quality, collaboration, and technical debt
- **Agile Maturity Analysis**: Assess and improve team performance
- **Actionable Insights**: Get recommendations for process improvements
- **Beautiful Dashboards**: Visualize metrics with modern UI
- **Secure Authentication**: JWT-based authentication with password hashing
- **High Performance**: Local caching and optimized API calls for fast dashboard loading

## Recent Updates

The following improvements were recently added to enhance the application:

### Integration Fixes
- Fixed timezone handling in GitHub integration to correctly compare dates
- Resolved Pydantic model validation issues for integration responses
- Fixed CORS configuration to allow proper cross-origin requests

### Dashboard Enhancements
- Implemented real-time metrics display from GitHub, Jira, and Trello integrations
- Added integration metrics table showing key performance indicators
- Enhanced visualization of agile maturity metrics with dynamic charts
- Added smart analysis of metrics to provide actionable improvement suggestions

### Performance Optimizations
- Added persistent browser caching with localStorage to improve load times on refresh
- Implemented parallel API calls for faster data loading
- Added section-based loading indicators for better user feedback
- Integrated a force refresh mechanism to update all data when needed
- Added background data refreshing for real-time updates

## Tech Stack

- **Backend**: Python with FastAPI
- **Frontend**: React with Chart.js for visualizations
- **Database**: PostgreSQL (with SQLAlchemy ORM)
- **Task Processing**: Celery with Redis for background tasks
- **Data Analysis**: Pandas & NumPy
- **Authentication**: JWT tokens with bcrypt password hashing

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- PostgreSQL (or SQLite for development)
- Redis (optional, for background tasks)

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/agiletrack.git
cd agiletrack
```

2. Set up Python environment
```
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up frontend
```
cd src/frontend
npm install
```

4. Create a `.env` file in the root directory with your configuration:
```
DATABASE_URL=postgresql://username:password@localhost/agiletrack
SECRET_KEY=your_secure_secret_key_for_jwt
GITHUB_TOKEN=your_github_token
JIRA_SERVER=https://your-domain.atlassian.net
JIRA_USERNAME=your_email@example.com
JIRA_API_TOKEN=your_jira_api_token
TRELLO_API_KEY=your_trello_api_key
TRELLO_API_SECRET=your_trello_api_secret
TRELLO_TOKEN=your_trello_token
```

### Running the Application

1. Start the backend API
```
cd AgileTrack
uvicorn src.backend.main:app --reload
```

2. Start the frontend development server
```
cd src/frontend
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

### Running with Docker

The application is containerized for easy deployment and development.

#### Quick Start

The easiest way to get started with Docker:

```bash
# Clone the repository
git clone https://github.com/yourusername/agiletrack.git
cd agiletrack

# Run the quick start script
./docker-start.sh
```

Then open your browser to http://localhost

#### Prerequisites
- Docker
- Docker Compose

#### Start the Application with Docker

1. Clone the repository
```bash
git clone https://github.com/yourusername/agiletrack.git
cd agiletrack
```

2. Create a `.env` file from the template
```bash
cp .env.example .env
# Edit the .env file with your configuration
```

3. Build and start the containers
```bash
docker-compose up -d
```

4. Access the application at `http://localhost`

5. To view logs
```bash
docker-compose logs -f
```

6. To stop the application
```bash
docker-compose down
```

#### Development with Docker

The Docker setup includes volume mounting for development:
- Backend code changes are automatically reloaded
- For frontend changes, you'll need to rebuild the container:
```bash
docker-compose build frontend
docker-compose up -d frontend
```

#### Database Management

- The PostgreSQL database is accessible at `localhost:5432`
- Data is persisted in a Docker volume
- To reset the database:
```bash
docker-compose down -v  # This will delete the volumes
docker-compose up -d    # Start fresh
```

## Authentication System

AgileTrack implements a secure JWT-based authentication system with bcrypt password hashing:

### User Registration

- Create an account with email, username, and password
- Passwords are securely hashed using bcrypt before being stored
- Email addresses and usernames are unique

### User Login

- Login using email and password
- Successful authentication generates a JWT token valid for 24 hours
- Tokens are required for all protected routes

### User Setup Flow

1. After registration, users complete a setup process:
   - Account information (name, company, role, team size)
   - Integration setup (connecting to GitHub, Jira, or Trello)

2. Setup completion:
   - Users must complete the setup process to access the dashboard
   - At least one integration is required

### Protected Resources

All API endpoints (except authentication) require a valid JWT token:
- Tokens must be included in the Authorization header: `Authorization: Bearer <token>`
- Invalid or expired tokens result in 401 Unauthorized responses

### Security Considerations

- All passwords are hashed using bcrypt before storage
- Tokens have a 24-hour expiration
- Sensitive endpoint access is limited to authenticated users
- CORS headers are configured for security

## API Documentation

Once the application is running, you can access the API documentation at `http://localhost:8000/docs` or `http://localhost:8000/redoc`.

## Testing

The project includes a comprehensive test suite covering both backend and frontend code.

### Backend Tests

Run the backend tests using pytest:

```bash
# Run all tests
pytest tests/

# Run with coverage report
pytest --cov=src tests/

# Run specific test categories
pytest tests/unit/
pytest tests/integration/
pytest -m "unit and models"  # Using test markers
```

### Frontend Tests

Run the frontend tests using Jest:

```bash
cd src/frontend
npm test

# Run with coverage report
npm test -- --coverage
```

### Running Tests with Docker

You can also run the tests using Docker, which ensures a clean, consistent environment:

```bash
# Run all tests
./docker-test.sh

# Run only backend tests
./docker-test.sh backend

# Run only frontend tests
./docker-test.sh frontend
```

This uses a separate Docker Compose configuration that creates temporary test databases and services.

### Continuous Integration

The project is configured with GitHub Actions for continuous integration. Every push and pull request to the main branch will trigger:

1. Backend tests on multiple Python versions
2. Frontend tests on multiple Node.js versions
3. Code linting
4. Test coverage reporting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

When contributing, please:
1. Write tests for new features or bug fixes
2. Ensure all tests pass before submitting a PR
3. Update documentation as needed
4. Follow the existing code style

## License

This project is licensed under the MIT License - see the LICENSE file for details. 