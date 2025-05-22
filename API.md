# API Documentation for AgileTrack

AgileTrack provides a comprehensive REST API for managing teams, integrations, and metrics.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  API Client     │─────│  FastAPI        │─────│  Database       │
│                 │     │  Backend        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Authentication │     │  Business       │     │  Data           │
│  & Security     │     │  Logic          │     │  Storage        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Authentication

### 1. Login
```http
POST /auth/login
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "secure_password"
}
```

Response:
```json
{
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer"
}
```

### 2. Register
```http
POST /auth/register
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "secure_password",
    "name": "John Doe"
}
```

## Teams

### 1. List Teams
```http
GET /teams
Authorization: Bearer <token>
```

Response:
```json
{
    "items": [
        {
            "id": 1,
            "name": "Team Alpha",
            "maturity_level": 4,
            "created_at": "2024-01-01T00:00:00Z"
        }
    ],
    "total": 1
}
```

### 2. Create Team
```http
POST /teams
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "Team Beta",
    "description": "New team for project X"
}
```

### 3. Get Team Details
```http
GET /teams/{team_id}
Authorization: Bearer <token>
```

## Integrations

### 1. List Team Integrations
```http
GET /teams/{team_id}/integrations
Authorization: Bearer <token>
```

Response:
```json
{
    "items": [
        {
            "id": 1,
            "type": "github",
            "name": "Main Repository",
            "status": "active",
            "last_sync": "2024-01-01T00:00:00Z"
        }
    ]
}
```

### 2. Create Integration
```http
POST /teams/{team_id}/integrations
Authorization: Bearer <token>
Content-Type: application/json

{
    "type": "github",
    "name": "New Repository",
    "config": {
        "repository": "owner/repo",
        "token": "github_token"
    }
}
```

### 3. Sync Integration
```http
POST /integrations/{integration_id}/sync
Authorization: Bearer <token>
```

## Metrics

### 1. Get Team Metrics
```http
GET /teams/{team_id}/metrics
Authorization: Bearer <token>
```

Response:
```json
{
    "velocity": 85,
    "quality": 92,
    "collaboration": 78,
    "technical_debt": 65,
    "maturity_level": 4
}
```

### 2. Get Integration Metrics
```http
GET /integrations/{integration_id}/metrics
Authorization: Bearer <token>
```

### 3. Force Metrics Recalculation
```http
POST /teams/{team_id}/metrics/recalculate
Authorization: Bearer <token>
```

## Error Handling

### 1. Error Response Format
```json
{
    "detail": "Error message",
    "code": "ERROR_CODE",
    "status": 400
}
```

### 2. Common Error Codes
- `AUTH_REQUIRED`: Authentication required
- `INVALID_CREDENTIALS`: Invalid login credentials
- `TEAM_NOT_FOUND`: Team not found
- `INTEGRATION_ERROR`: Integration error
- `VALIDATION_ERROR`: Request validation error

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user
- Rate limit headers included in responses

## Pagination

### 1. Request Format
```http
GET /teams?page=1&size=10
```

### 2. Response Format
```json
{
    "items": [...],
    "total": 100,
    "page": 1,
    "size": 10,
    "pages": 10
}
```

## Best Practices

1. **Authentication**
   - Always use HTTPS
   - Store tokens securely
   - Handle token expiration
   - Implement refresh mechanism

2. **Error Handling**
   - Check status codes
   - Handle rate limits
   - Implement retries
   - Log errors

3. **Performance**
   - Use pagination
   - Implement caching
   - Batch requests
   - Monitor usage

## SDK Examples

### Python
```python
import agiletrack

client = agiletrack.Client(
    base_url="https://api.agiletrack.com",
    token="your_token"
)

# Get team metrics
metrics = client.teams.get_metrics(team_id=1)
print(f"Team maturity: {metrics.maturity_level}")
```

### JavaScript
```javascript
import { AgileTrackClient } from '@agiletrack/client';

const client = new AgileTrackClient({
    baseUrl: 'https://api.agiletrack.com',
    token: 'your_token'
});

// Get team metrics
const metrics = await client.teams.getMetrics(1);
console.log(`Team maturity: ${metrics.maturityLevel}`);
```

## Webhooks

### 1. Configure Webhook
```http
POST /webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
    "url": "https://your-server.com/webhook",
    "events": ["metrics.updated", "integration.synced"]
}
```

### 2. Webhook Payload
```json
{
    "event": "metrics.updated",
    "timestamp": "2024-01-01T00:00:00Z",
    "data": {
        "team_id": 1,
        "metrics": {
            "velocity": 85,
            "quality": 92
        }
    }
}
```

## Future Improvements

1. **API Enhancements**
   - GraphQL support
   - Bulk operations
   - Real-time updates
   - Advanced filtering

2. **Documentation**
   - Interactive API docs
   - Code examples
   - SDK documentation
   - Integration guides

3. **Features**
   - Custom endpoints
   - Advanced analytics
   - Export capabilities
   - API versioning

## Contributing

When modifying the API:

1. Follow REST principles
2. Add comprehensive tests
3. Update documentation
4. Include examples
5. Consider backward compatibility

## License

This document is part of the AgileTrack project and is subject to the same license terms. 