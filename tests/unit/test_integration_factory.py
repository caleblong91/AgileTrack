import pytest
from src.integrations.integration_factory import IntegrationFactory
from src.integrations.github_integration import GitHubIntegration
from src.integrations.jira_integration import JiraIntegration
from src.integrations.trello_integration import TrelloIntegration

@pytest.mark.unit
class TestIntegrationFactory:
    """Tests for the IntegrationFactory"""
    
    def test_create_github_integration(self):
        """Test creating a GitHub integration"""
        # Create a GitHub integration
        integration = IntegrationFactory.create_integration("github", {
            "api_token": "test_token",
            "repository": "test/repo"
        })
        
        # Verify the integration type
        assert isinstance(integration, GitHubIntegration)
        assert integration.api_token == "test_token"
        assert integration.repository_name == "test/repo"
    
    def test_create_jira_integration(self):
        """Test creating a Jira integration"""
        # Create a Jira integration
        integration = IntegrationFactory.create_integration("jira", {
            "server": "https://test.atlassian.net",
            "username": "test_user",
            "api_token": "test_token"
        })
        
        # Verify the integration type
        assert isinstance(integration, JiraIntegration)
        assert integration.server == "https://test.atlassian.net"
        assert integration.username == "test_user"
        assert integration.api_token == "test_token"
    
    def test_create_trello_integration(self):
        """Test creating a Trello integration"""
        # Create a Trello integration
        integration = IntegrationFactory.create_integration("trello", {
            "api_key": "test_key",
            "api_secret": "test_secret",
            "token": "test_token"
        })
        
        # Verify the integration type
        assert isinstance(integration, TrelloIntegration)
        assert integration.api_key == "test_key"
        assert integration.api_secret == "test_secret"
        assert integration.token == "test_token"
    
    def test_unsupported_integration_type(self):
        """Test creating an unsupported integration type"""
        # Try to create an unsupported integration type
        with pytest.raises(ValueError) as exc_info:
            IntegrationFactory.create_integration("unsupported")
        
        # Verify the error message
        assert str(exc_info.value) == "Unsupported integration type: unsupported"
    
    def test_get_supported_metrics_github(self):
        """Test getting supported metrics for GitHub"""
        # Get supported metrics
        metrics = IntegrationFactory.get_supported_metrics("github")
        
        # Verify metrics are returned
        assert isinstance(metrics, dict)
        assert "pr_count" in metrics
        assert "commit_count" in metrics
        assert "issue_count" in metrics
    
    def test_get_supported_metrics_jira(self):
        """Test getting supported metrics for Jira"""
        # Get supported metrics
        metrics = IntegrationFactory.get_supported_metrics("jira")
        
        # Verify metrics are returned
        assert isinstance(metrics, dict)
        assert "issue_counts_by_type" in metrics
        assert "completed_story_points" in metrics
    
    def test_get_supported_metrics_trello(self):
        """Test getting supported metrics for Trello"""
        # Get supported metrics
        metrics = IntegrationFactory.get_supported_metrics("trello")
        
        # Verify metrics are returned
        assert isinstance(metrics, dict)
        assert "card_counts_by_list" in metrics
        assert "open_card_count" in metrics
    
    def test_get_supported_metrics_unsupported(self):
        """Test getting supported metrics for an unsupported integration type"""
        # Try to get supported metrics for an unsupported integration type
        with pytest.raises(ValueError) as exc_info:
            IntegrationFactory.get_supported_metrics("unsupported")
        
        # Verify the error message
        assert str(exc_info.value) == "Unsupported integration type: unsupported" 