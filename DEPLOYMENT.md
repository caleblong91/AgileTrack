# Deployment Guide for AgileTrack

This guide covers the deployment process for AgileTrack in both development and production environments.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Web Server     │─────│  Application    │─────│  Database       │
│  (Nginx)        │     │  Server         │     │  (PostgreSQL)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Static Files   │     │  Celery         │     │  Redis          │
│  (React)        │     │  Workers        │     │  (Cache)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Prerequisites

### 1. System Requirements
- Linux server (Ubuntu 20.04+ recommended)
- 4+ CPU cores
- 8GB+ RAM
- 50GB+ storage
- Docker and Docker Compose
- Git

### 2. Required Services
- PostgreSQL 13+
- Redis 6+
- Nginx
- Python 3.8+
- Node.js 14+

## Development Deployment

### 1. Local Setup
```bash
# Clone repository
git clone https://github.com/yourusername/agiletrack.git
cd agiletrack

# Create environment files
cp .env.example .env
cp .env.example.frontend .env.frontend

# Build and start containers
docker-compose up -d
```

### 2. Development Services
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: ./src/frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src/frontend:/app
    environment:
      - NODE_ENV=development

  backend:
    build: ./src/backend
    ports:
      - "8000:8000"
    volumes:
      - ./src/backend:/app
    environment:
      - ENVIRONMENT=development
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=agiletrack
      - POSTGRES_USER=agiletrack
      - POSTGRES_PASSWORD=development

  redis:
    image: redis:6
    ports:
      - "6379:6379"

  celery:
    build: ./src/backend
    command: celery -A tasks worker --loglevel=info
    volumes:
      - ./src/backend:/app
    environment:
      - ENVIRONMENT=development
    depends_on:
      - redis
      - db
```

## Production Deployment

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Production Configuration
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: always

  backend:
    build:
      context: ./src/backend
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
    depends_on:
      - db
      - redis
    restart: always

  db:
    image: postgres:13
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=agiletrack
      - POSTGRES_USER=agiletrack
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: always

  redis:
    image: redis:6
    volumes:
      - redis_data:/data
    restart: always

  celery:
    build:
      context: ./src/backend
      dockerfile: Dockerfile.prod
    command: celery -A tasks worker --loglevel=info --concurrency=4
    environment:
      - ENVIRONMENT=production
    depends_on:
      - redis
      - db
    restart: always

  celery-beat:
    build:
      context: ./src/backend
      dockerfile: Dockerfile.prod
    command: celery -A tasks beat --loglevel=info
    environment:
      - ENVIRONMENT=production
    depends_on:
      - redis
      - db
    restart: always

volumes:
  postgres_data:
  redis_data:
```

### 3. Nginx Configuration
```nginx
# /etc/nginx/sites-available/agiletrack
server {
    listen 80;
    server_name agiletrack.example.com;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. SSL Configuration
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d agiletrack.example.com
```

## Scaling

### 1. Horizontal Scaling
```yaml
# Scale Celery workers
docker-compose -f docker-compose.prod.yml up -d --scale celery=4

# Scale backend services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

### 2. Load Balancing
```nginx
# /etc/nginx/conf.d/load-balancer.conf
upstream backend_servers {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}

upstream celery_servers {
    server celery1:6379;
    server celery2:6379;
}
```

## Monitoring

### 1. Health Checks
```bash
# Check service health
curl -f http://localhost/health

# Monitor Celery workers
celery -A tasks status

# Check Redis status
redis-cli ping
```

### 2. Logging
```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f

# Monitor specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Check Nginx logs
tail -f /var/log/nginx/access.log
```

## Backup and Recovery

### 1. Database Backup
```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U agiletrack > backup.sql

# Restore from backup
cat backup.sql | docker-compose -f docker-compose.prod.yml exec -T db psql -U agiletrack
```

### 2. Configuration Backup
```bash
# Backup configuration files
tar -czf config_backup.tar.gz .env* docker-compose*.yml

# Restore configuration
tar -xzf config_backup.tar.gz
```

## Security

### 1. Firewall Configuration
```bash
# Allow required ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### 2. Security Headers
```nginx
# Add security headers
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header X-Content-Type-Options "nosniff";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

## Troubleshooting

### 1. Common Issues

#### Service Not Starting
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View service logs
docker-compose -f docker-compose.prod.yml logs service_name
```

#### Database Connection Issues
```bash
# Check database connection
docker-compose -f docker-compose.prod.yml exec db psql -U agiletrack -c "\l"

# Verify database credentials
docker-compose -f docker-compose.prod.yml exec backend python -c "from database import check_connection; check_connection()"
```

### 2. Debug Commands
```bash
# Check container resources
docker stats

# Inspect container
docker inspect container_name

# Check network connectivity
docker-compose -f docker-compose.prod.yml exec backend ping redis
```

## Future Improvements

1. **Deployment Enhancements**
   - Kubernetes support
   - CI/CD pipeline
   - Automated scaling
   - Blue-green deployment

2. **Monitoring**
   - Prometheus integration
   - Grafana dashboards
   - Alert system
   - Performance metrics

3. **Security**
   - Automated security scanning
   - Secret management
   - Network policies
   - Access control

## Contributing

When modifying deployment:

1. Test in development
2. Update documentation
3. Consider security
4. Add monitoring
5. Include rollback plan

## License

This document is part of the AgileTrack project and is subject to the same license terms. 