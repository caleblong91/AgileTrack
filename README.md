# AgileTrack

A comprehensive platform for tracking and improving agile maturity across development teams. AgileTrack provides insights by collecting and analyzing data from multiple sources like GitHub, Jira, and Trello.

## Architecture Overview

AgileTrack follows a modern microservices architecture pattern:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │─────│  FastAPI Backend│─────│  PostgreSQL DB  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │
                        ┌──────┴──────┐
                        │             │
                        │  Redis      │
                        │  (Celery)   │
                        │             │
                        └─────────────┘
                               │
                               ▼
                     ┌───────────────────┐
                     │  External APIs    │
                     │  - GitHub         │
                     │  - Jira           │
                     │  - Trello         │
                     └───────────────────┘
```

### Main Components:

1. **Frontend**: React-based SPA with modern UI components and data visualization
2. **Backend API**: FastAPI-powered REST API handling business logic and data processing
3. **Database**: PostgreSQL for persistent storage with SQLAlchemy ORM
4. **Background Tasks**: Celery with Redis for async data processing
5. **Integration Layer**: Adapters for external services like GitHub, Jira, and Trello

## Features

- **Multi-source Integration**: Connect with GitHub, Jira, Trello, and more
- **Comprehensive Metrics**: Track velocity, quality, collaboration, and technical debt
- **Agile Maturity Analysis**: Assess and improve team performance
- **Actionable Insights**: Get recommendations for process improvements
- **Beautiful Dashboards**: Visualize metrics with modern UI
- **Secure Authentication**: JWT-based authentication with password hashing
- **High Performance**: Multi-level caching system for fast dashboard loading
- **Team Management**: Create and manage multiple teams within your organization
- **User Onboarding**: Guided setup flow for new users to configure their integrations
- **Real-time Sync**: Automatic synchronization of metrics from external services

## Technical Details

### Backend (Python/FastAPI)

- **Data Models**:
  - User: Authentication and user management
  - Team: Team structure and configuration
  - Integration: External service connections
  - Project: Project structure
  - Metrics: Performance data collection

- **API Routes**:
  - `/auth`: Authentication and user management
  - `/teams`: Team management
  - `/integrations`: External service connections
  - `/projects`: Project configuration

- **Integration Adapters**:
  - GitHub: Pull requests, commits, issues analysis
  - Jira: Tickets, sprints, velocity analysis
  - Trello: Boards, cards, workflow analysis

- **Background Tasks (Celery)**:
  - Initial metrics sync for new integrations
  - Periodic metrics sync for all active integrations
  - Automatic retry mechanism for failed tasks
  - Configurable sync intervals per integration type

### Frontend (React)

- **State Management**: React Context API for global state
- **Authentication**: JWT token-based auth with secure storage
- **Data Visualization**: Charts.js for metrics visualization
- **Responsive Design**: Modern UI that works across devices
- **Multi-level Caching**:
  - Local Storage: Persistent cache for teams and integrations (3-day expiry)
  - In-memory Cache: Session-based cache for metrics (4-hour expiry)
  - Optimistic UI updates with background syncing

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- PostgreSQL (or SQLite for development)
- Redis (required for Celery background tasks)
- Git account with API access (for GitHub integration)

### Installation

#### Using Docker (Recommended)

The easiest way to get started with AgileTrack:

```bash
# Clone the repository
git clone https://github.com/yourusername/agiletrack.git
cd agiletrack

# Run the setup script to create environment files
./create-env.sh

# Build and start the Docker containers
docker-compose up -d
```

This will start:
- Frontend on http://localhost
- Backend API on http://localhost/api
- API documentation on http://localhost/api/docs
- Redis for Celery tasks
- Celery worker for background tasks

#### Manual Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/agiletrack.git
cd agiletrack
```

2. Set up Python environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up frontend
```bash
cd src/frontend
npm install
```

4. Create a `.env` file in the root directory with your configuration:
```
DATABASE_URL=postgresql://username:password@localhost/agiletrack
SECRET_KEY=your_secure_secret_key_for_jwt
REDIS_URL=redis://localhost:6379/0
GITHUB_TOKEN=your_github_token
JIRA_SERVER=https://your-domain.atlassian.net
JIRA_USERNAME=your_email@example.com
JIRA_API_TOKEN=your_jira_api_token
TRELLO_API_KEY=your_trello_api_key
TRELLO_API_SECRET=your_trello_api_secret
TRELLO_TOKEN=your_trello_token
```

5. Initialize database
```bash
cd AgileTrack
python -m src.backend.database
python create_admin.py  # Creates an admin user
```

6. Start Redis server
```bash
redis-server
```

7. Start Celery worker
```bash
celery -A src.backend.tasks worker --loglevel=info
```

8. Start Celery beat (for periodic tasks)
```bash
celery -A src.backend.tasks beat --loglevel=info
```

9. Start the backend API
```bash
uvicorn src.backend.main:app --reload
```

10. Start the frontend development server (in a new terminal)
```bash
cd src/frontend
npm start
```

### Running in Production

For production deployment:

1. Build optimized frontend
```bash
cd src/frontend
npm run build
```

2. Use gunicorn with uvicorn workers
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.backend.main:app
```

3. Use a reverse proxy like Nginx to serve static files and proxy API requests

4. Configure Celery for production:
```bash
# Start Celery worker with production settings
celery -A src.backend.tasks worker --loglevel=info --concurrency=4

# Start Celery beat for periodic tasks
celery -A src.backend.tasks beat --loglevel=info
```

## User Flow

1. **Registration**: Create a new account with email and password
2. **Setup Process**:
   - Personal information (name, company, role)
   - Team creation or selection
   - Integration setup (GitHub, Jira, or Trello)
3. **Dashboard**: View metrics, team performance, and recommendations
4. **Integrations**: Add or edit external service connections
5. **Teams**: Manage teams and view team-specific metrics

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

## Integration Details

### GitHub Integration

- **Required credentials**: Personal Access Token with the following scopes:
  - `repo` - For private repositories
  - `read:user` - For user information
  - `read:org` - For organization repositories

- **Metrics collected**:
  - Pull request metrics (count, merge rate, time to merge)
  - Commit metrics (count, size, frequency)
  - Issue metrics (count, close rate, time to close)

### Jira Integration

- **Required credentials**:
  - Jira server URL
  - Email address
  - API token

- **Metrics collected**:
  - Sprint velocity
  - Issue cycle time
  - Backlog health
  - Burndown charts

### Trello Integration

- **Required credentials**:
  - API key
  - API token

- **Metrics collected**:
  - Card cycle time
  - List distribution
  - Activity metrics
  - Workflow efficiency

## Caching System

AgileTrack implements a multi-level caching system to optimize performance:

### Frontend Caching

1. **Local Storage Cache**:
   - Persists between sessions (3-day expiry)
   - Stores teams, integrations, and basic metrics
   - Automatically cleared when data is stale

2. **In-memory Cache**:
   - Session-based cache (4-hour expiry)
   - Stores frequently accessed metrics
   - Cleared on page refresh

3. **Optimistic Updates**:
   - Immediate UI updates with background syncing
   - Fallback to cached data if API calls fail

### Backend Caching

1. **Celery Task Results**:
   - Cached in Redis
   - Configurable expiry times
   - Automatic cleanup of stale results

2. **Integration Data**:
   - Periodic background syncs
   - Configurable sync intervals per integration type
   - Automatic retry mechanism for failed syncs

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

# Run specific test files
npm test -- AuthContext
```

## Contribution Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FastAPI for the excellent API framework
- React team for the frontend library
- Celery for background task processing
- All open-source libraries and contributors used in this project 