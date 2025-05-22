import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
import json
import os

try:
    import redis
    redis_available = True
except ImportError:
    redis_available = False

from src.integrations.jira_integration import JiraIntegration
# Assuming generate_cache_key might be useful, or construct manually
# from src.integrations.cache import generate_cache_key 

# Fixture to get a Redis client instance if available (can be shared from conftest.py or github test)
@pytest.fixture(scope="module")
def redis_client_instance():
    if not redis_available:
        yield None
        return
        
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    try:
        client = redis.Redis.from_url(redis_url)
        client.ping() 
        yield client
    except redis.exceptions.ConnectionError:
        yield None

@pytest.mark.integration
@pytest.mark.jira
class TestJiraIntegrationCaching:
    """Integration tests for Jira integration caching"""

    def _setup_mock_jira_api(self, mock_jira_constructor):
        """Helper to set up common Jira API mocks."""
        mock_jira_instance = MagicMock()
        mock_jira_constructor.return_value = mock_jira_instance

        # Mock issues
        mock_issue1_data = {
            "id": "1001", "key": "PROJ-1", "fields": MagicMock(
                summary="Test Issue 1",
                status=MagicMock(name="To Do"),
                issuetype=MagicMock(name="Story"),
                priority=MagicMock(name="Medium"),
                created="2023-01-01T10:00:00.000+0000",
                updated="2023-01-01T11:00:00.000+0000",
                assignee=MagicMock(displayName="User A"),
                reporter=MagicMock(displayName="User B"),
                customfield_10002=5, # Story points
                customfield_10001=None # Sprint
            )
        }
        mock_issue1 = MagicMock(**mock_issue1_data)
        # Simulate transitions method if needed by your SUT, for now pass
        mock_jira_instance.transitions.return_value = []


        mock_jira_instance.search_issues.return_value = [mock_issue1]
        
        # Mock boards
        mock_board1 = MagicMock(id=1, name="Board 1", type="scrum")
        mock_jira_instance.boards.return_value = [mock_board1]
        
        # Mock sprints
        mock_sprint1 = MagicMock(id=1, name="Sprint 1", state="active", startDate="2023-01-01T00:00:00Z")
        mock_jira_instance.sprints.return_value = [mock_sprint1]
        
        return mock_jira_instance

    @patch('src.integrations.jira_integration.JIRA')
    def test_calculate_metrics_caching(self, mock_jira_constructor, redis_client_instance):
        """Test caching behavior of calculate_metrics for Jira."""
        if not redis_available or not redis_client_instance:
            pytest.skip("Redis client not available, skipping caching test.")

        mock_jira_api = self._setup_mock_jira_api(mock_jira_constructor)
        
        project_key_for_cache_test = "JIRA_CACHE_PROJ"
        days_for_cache_test = 30
        
        integration = JiraIntegration(server="https://test.jira.com", username="user", api_token="token")

        # Construct the expected cache key based on current cache.py logic
        # Format: "calculate_metrics:PROJECT_KEY:days=DAYS"
        expected_cache_key = f"calculate_metrics:{project_key_for_cache_test}:days={days_for_cache_test}"

        # Ensure cache is clean before test
        redis_client_instance.delete(expected_cache_key)
        
        # First call - should hit API and cache the result
        print(f"First call for Jira project {project_key_for_cache_test} (cache key: {expected_cache_key})")
        metrics1 = integration.calculate_metrics(project_key=project_key_for_cache_test, days=days_for_cache_test)
        
        mock_jira_api.search_issues.assert_called_once()
        # Depending on calculate_metrics logic, boards and sprints might also be called.
        # For this example, let's assume search_issues is the main one for a basic metrics set.
        # Add asserts for mock_jira_api.boards and mock_jira_api.sprints if they are definitely called.
        if integration.get_boards.__code__ is not JiraIntegration.get_boards.__code__ or \
           integration.get_sprints.__code__ is not JiraIntegration.get_sprints.__code__:
            # if these methods are part of the calculate_metrics call chain
            mock_jira_api.boards.assert_called() 
            mock_jira_api.sprints.assert_called()

        # Verify something was cached
        cached_value_after_first_call = redis_client_instance.get(expected_cache_key)
        assert cached_value_after_first_call is not None
        
        # Reset mocks for the second call
        mock_jira_api.search_issues.reset_mock()
        mock_jira_api.boards.reset_mock()
        mock_jira_api.sprints.reset_mock()
        
        # Second call - should use cache
        print(f"Second call for Jira project {project_key_for_cache_test} (cache key: {expected_cache_key})")
        metrics2 = integration.calculate_metrics(project_key=project_key_for_cache_test, days=days_for_cache_test)
        
        mock_jira_api.search_issues.assert_not_called()
        mock_jira_api.boards.assert_not_called()
        mock_jira_api.sprints.assert_not_called()
        
        assert metrics1 is not None, "Metrics from first call should not be None"
        assert metrics2 is not None, "Metrics from second call should not be None"
        # Comparing complex dicts; ensure they are equivalent. JSON dump comparison is robust.
        assert json.dumps(metrics1, sort_keys=True) == json.dumps(metrics2, sort_keys=True), \
               "Metrics from cache should be identical to initial metrics"

        # Clean up the cache key
        redis_client_instance.delete(expected_cache_key)
        print(f"Cleaned up Jira cache key: {expected_cache_key}")
