import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
import json
import os

# Attempt to import actual redis for cleanup, will be skipped if not available for some reason
try:
    import redis
    redis_available = True
except ImportError:
    redis_available = False

from src.integrations.github_integration import GitHubIntegration
from src.integrations.cache import generate_cache_key # To help with key cleanup


# Fixture to get a Redis client instance if available
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
        yield None # Yield None if connection fails, tests can skip if client is None


@pytest.mark.integration
@pytest.mark.github
class TestGitHubIntegration:
    """Integration tests for GitHub integration"""

    def _setup_mock_github_api(self, mock_github_constructor):
        """Helper to set up common GitHub API mocks."""
        mock_github_instance = MagicMock()
        mock_repo_instance = MagicMock()

        mock_github_constructor.return_value = mock_github_instance
        mock_github_instance.get_repo.return_value = mock_repo_instance

        # Mock pull requests
        mock_pr1 = MagicMock()
        mock_pr1.number = 1; mock_pr1.title = "PR 1"; mock_pr1.state = "open"
        mock_pr1.created_at = pd.Timestamp('2023-01-01T10:00:00Z')
        mock_pr1.closed_at = None; mock_pr1.merged_at = None
        mock_pr1.user.login = "user1"; mock_pr1.additions = 10; mock_pr1.deletions = 5
        mock_pr1.changed_files = 2; mock_pr1.comments = 1; mock_pr1.review_comments = 1
        
        mock_repo_instance.get_pulls.return_value = [mock_pr1]
        
        # Mock commits
        mock_commit1 = MagicMock()
        mock_commit1.sha = "sha1"; mock_commit1.author.login = "user1"
        mock_commit1.commit.message = "Commit 1"; mock_commit1.commit.author.date = pd.Timestamp('2023-01-01T09:00:00Z')
        mock_commit1.stats.additions = 20; mock_commit1.stats.deletions = 3; mock_commit1.stats.total = 23
        
        mock_repo_instance.get_commits.return_value = [mock_commit1]

        # Mock issues
        mock_issue1 = MagicMock()
        mock_issue1.number = 101; mock_issue1.title = "Issue 1"; mock_issue1.state = "open"
        mock_issue1.created_at = pd.Timestamp('2023-01-02T10:00:00Z')
        mock_issue1.closed_at = None; mock_issue1.user.login = "user2"
        mock_issue1.labels = []; mock_issue1.comments = 0; mock_issue1.pull_request = None
        
        mock_repo_instance.get_issues.return_value = [mock_issue1]
        
        return mock_github_instance, mock_repo_instance

    @patch('src.integrations.github_integration.Github')
    def test_init_with_token(self, mock_github_constructor):
        """Test initializing with a token"""
        # Initialize integration
        integration = GitHubIntegration(api_token="test_token")
        
        # Verify Github was initialized with the token
        mock_github_constructor.assert_called_once_with("test_token")
        assert integration.api_token == "test_token"
    
    @patch('src.integrations.github_integration.Github')
    def test_set_repository(self, mock_github_constructor):
        """Test setting a repository"""
        # Set up mock
        mock_gh_instance, mock_repo_instance = self._setup_mock_github_api(mock_github_constructor)
        
        # Initialize integration and set repository
        integration = GitHubIntegration(api_token="test_token")
        integration.set_repository("test/repo")
        
        # Verify get_repo was called with the correct repository name
        mock_gh_instance.get_repo.assert_called_once_with("test/repo")
        assert integration.repository_name == "test/repo"
        assert integration.repository == mock_repo_instance
    
    @patch('src.integrations.github_integration.Github')
    def test_get_pull_requests(self, mock_github_constructor):
        """Test getting pull requests"""
        # Set up mock
        mock_gh_instance, mock_repo_instance = self._setup_mock_github_api(mock_github_constructor)
        
        # Modify mock_repo_instance.get_pulls specifically for this test if needed
        mock_pr1 = MagicMock(); mock_pr1.number = 1; mock_pr1.title = "Test PR 1"; mock_pr1.state = "open"
        mock_pr1.created_at = pd.Timestamp('2023-01-01T10:00:00Z'); mock_pr1.closed_at = None; mock_pr1.merged_at = None
        mock_pr1.user.login = "user1"; mock_pr1.additions = 100; mock_pr1.deletions = 50
        mock_pr1.changed_files = 5; mock_pr1.comments = 3; mock_pr1.review_comments = 2
        
        mock_pr2 = MagicMock(); mock_pr2.number = 2; mock_pr2.title = "Test PR 2"; mock_pr2.state = "closed"
        mock_pr2.created_at = pd.Timestamp('2023-01-02T10:00:00Z'); mock_pr2.closed_at = pd.Timestamp('2023-01-02T11:00:00Z'); mock_pr2.merged_at = pd.Timestamp('2023-01-02T11:00:00Z')
        mock_pr2.user.login = "user2"; mock_pr2.additions = 200; mock_pr2.deletions = 100
        mock_pr2.changed_files = 10; mock_pr2.comments = 5; mock_pr2.review_comments = 3
        
        mock_repo_instance.get_pulls.return_value = [mock_pr1, mock_pr2]

        # Initialize integration and get pull requests
        integration = GitHubIntegration(api_token="test_token")
        integration.set_repository("test/repo")
        prs = integration.get_pull_requests()
        
        # Verify get_pulls was called
        mock_repo_instance.get_pulls.assert_called_once()
        
        # Verify dataframe
        assert isinstance(prs, pd.DataFrame)
        assert len(prs) == 2
        assert prs.iloc[0]["id"] == 1
        assert prs.iloc[1]["id"] == 2
    
    @patch('src.integrations.github_integration.Github')
    def test_calculate_metrics(self, mock_github_constructor):
        """Test calculating metrics - basic functionality"""
        # Set up mocks
        mock_gh_instance, mock_repo_instance = self._setup_mock_github_api(mock_github_constructor)

        # Specific setup for this test if different from _setup_mock_github_api
        # For example, to test merge rate, ensure one PR is merged, one is not.
        mock_pr_open = MagicMock(); mock_pr_open.number = 1; mock_pr_open.title = "Open PR"; mock_pr_open.state = "open"
        mock_pr_open.created_at = pd.Timestamp('2023-01-01'); mock_pr_open.closed_at = None; mock_pr_open.merged_at = None
        mock_pr_open.user.login = "u1"; mock_pr_open.additions=1; mock_pr_open.deletions=1; mock_pr_open.changed_files=1; mock_pr_open.comments=1; mock_pr_open.review_comments=1

        mock_pr_merged = MagicMock(); mock_pr_merged.number = 2; mock_pr_merged.title = "Merged PR"; mock_pr_merged.state = "closed"
        mock_pr_merged.created_at = pd.Timestamp('2023-01-01'); mock_pr_merged.closed_at = pd.Timestamp('2023-01-02'); mock_pr_merged.merged_at = pd.Timestamp('2023-01-02')
        mock_pr_merged.user.login = "u2"; mock_pr_merged.additions=1; mock_pr_merged.deletions=1; mock_pr_merged.changed_files=1; mock_pr_merged.comments=1; mock_pr_merged.review_comments=1
        
        mock_repo_instance.get_pulls.return_value = [mock_pr_open, mock_pr_merged]
        
        # Initialize integration and calculate metrics
        integration = GitHubIntegration(api_token="test_token")
        integration.set_repository("test/repo")
        metrics = integration.calculate_metrics(days=30) # Using 30 days
        
        # Verify metrics
        assert isinstance(metrics, dict)
        assert metrics["pr_count"] == 2
        assert metrics["pr_merge_rate"] == 0.5  # 1 merged out of 2
        assert metrics["commit_count"] == 1 # From _setup_mock_github_api
        assert metrics["issue_count"] == 1 # From _setup_mock_github_api

    @patch('src.integrations.github_integration.Github')
    def test_calculate_metrics_caching(self, mock_github_constructor, redis_client_instance):
        """Test caching behavior of calculate_metrics for GitHub."""
        if not redis_available or not redis_client_instance:
            pytest.skip("Redis client not available, skipping caching test.")

        mock_gh_instance, mock_repo_instance = self._setup_mock_github_api(mock_github_constructor)
        
        repo_name_for_cache_test = "test/repo_caching_gh"
        integration = GitHubIntegration(api_token="test_token_cache_gh")
        integration.set_repository(repo_name_for_cache_test)

        # Construct the expected cache key
        # This depends on the cache key generation logic within @redis_cache
        # For calculate_metrics(self, days=30), key is like "calculate_metrics:repo_name:days=30"
        # We need to use the exact key generation as in cache.py for this to be reliable,
        # or make it simpler if possible. The current key gen in cache.py is complex.
        # Let's assume the key based on current implementation:
        cache_key_params = {"days": 30}
        # The cache key function needs the method object.
        # We can't directly call the `generate_cache_key` from `cache.py` easily here without the method instance.
        # So, we'll generate it manually based on observed behavior.
        # Expected key format: "calculate_metrics:REPOSITORY_NAME:days=DAYS_ARG"
        expected_cache_key = f"calculate_metrics:{repo_name_for_cache_test}:days=30"

        # Ensure cache is clean before test
        redis_client_instance.delete(expected_cache_key)
        
        # First call - should hit API and cache the result
        print(f"First call for {repo_name_for_cache_test} (cache key: {expected_cache_key})")
        metrics1 = integration.calculate_metrics(days=30)
        
        mock_repo_instance.get_pulls.assert_called_once()
        mock_repo_instance.get_commits.assert_called_once()
        mock_repo_instance.get_issues.assert_called_once()
        
        # Verify something was cached (optional, but good check)
        cached_value_after_first_call = redis_client_instance.get(expected_cache_key)
        assert cached_value_after_first_call is not None
        
        # Reset mocks for the second call
        mock_repo_instance.get_pulls.reset_mock()
        mock_repo_instance.get_commits.reset_mock()
        mock_repo_instance.get_issues.reset_mock()
        
        # Second call - should use cache
        print(f"Second call for {repo_name_for_cache_test} (cache key: {expected_cache_key})")
        metrics2 = integration.calculate_metrics(days=30)
        
        mock_repo_instance.get_pulls.assert_not_called()
        mock_repo_instance.get_commits.assert_not_called()
        mock_repo_instance.get_issues.assert_not_called()
        
        assert metrics1 == metrics2, "Metrics from cache should be identical to initial metrics"

        # Clean up the cache key
        redis_client_instance.delete(expected_cache_key)
        print(f"Cleaned up cache key: {expected_cache_key}")