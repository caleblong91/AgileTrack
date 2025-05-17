#!/bin/bash
set -e

cat > .env << EOL
# Database connection
DATABASE_URL=postgresql://postgres:postgres@db:5432/agiletrack

# Redis connection
REDIS_URL=redis://redis:6379/0

# GitHub Integration
# Create a token at https://github.com/settings/tokens
GITHUB_TOKEN=your_github_token_here

# Jira Integration
# Get these from your Atlassian account
JIRA_SERVER=https://your-domain.atlassian.net
JIRA_USERNAME=your_email@example.com
JIRA_API_TOKEN=your_jira_api_token_here

# Trello Integration
# Get these from https://trello.com/app-key
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_API_SECRET=your_trello_api_secret_here
TRELLO_TOKEN=your_trello_token_here

# Application settings
DEBUG=True
SECRET_KEY=\$(openssl rand -hex 32)
ALLOWED_HOSTS=localhost,127.0.0.1
EOL

echo ".env file created successfully!"
echo "Please edit .env to fill in your API tokens for GitHub, Jira, and Trello."
echo "For local development without Docker, update the DATABASE_URL and REDIS_URL to point to localhost." 