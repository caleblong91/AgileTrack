import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from src.integrations.github_integration import GitHubIntegration

@pytest.mark.integration
@pytest.mark.github
class TestGitHubIntegration:
    """Integration tests for GitHub integration"""
    
    @patch('src.integrations.github_integration.Github')
    def test_init_with_token(self, mock_github):
        """Test initializing with a token"""
        # Initialize integration
        integration = GitHubIntegration(api_token="test_token")
        
        # Verify Github was initialized with the token
        mock_github.assert_called_once_with("test_token")
        assert integration.api_token == "test_token"
    
    @patch('src.integrations.github_integration.Github')
    def test_set_repository(self, mock_github):
        """Test setting a repository"""
        # Set up mock
        mock_repo = MagicMock()
        mock_github.return_value.get_repo.return_value = mock_repo
        
        # Initialize integration and set repository
        integration = GitHubIntegration(api_token="test_token")
        integration.set_repository("test/repo")
        
        # Verify get_repo was called with the correct repository name
        mock_github.return_value.get_repo.assert_called_once_with("test/repo")
        assert integration.repository_name == "test/repo"
        assert integration.repository == mock_repo
    
    @patch('src.integrations.github_integration.Github')
    def test_get_pull_requests(self, mock_github):
        """Test getting pull requests"""
        # Set up mock
        mock_repo = MagicMock()
        mock_pr1 = MagicMock()
        mock_pr1.number = 1
        mock_pr1.title = "Test PR 1"
        mock_pr1.state = "open"
        mock_pr1.created_at = pd.Timestamp.now()
        mock_pr1.closed_at = None
        mock_pr1.merged_at = None
        mock_pr1.user.login = "test_user"
        mock_pr1.additions = 100
        mock_pr1.deletions = 50
        mock_pr1.changed_files = 5
        mock_pr1.comments = 3
        mock_pr1.review_comments = 2
        
        mock_pr2 = MagicMock()
        mock_pr2.number = 2
        mock_pr2.title = "Test PR 2"
        mock_pr2.state = "closed"
        mock_pr2.created_at = pd.Timestamp.now()
        mock_pr2.closed_at = pd.Timestamp.now()
        mock_pr2.merged_at = pd.Timestamp.now()
        mock_pr2.user.login = "test_user2"
        mock_pr2.additions = 200
        mock_pr2.deletions = 100
        mock_pr2.changed_files = 10
        mock_pr2.comments = 5
        mock_pr2.review_comments = 3
        
        mock_repo.get_pulls.return_value = [mock_pr1, mock_pr2]
        mock_github.return_value.get_repo.return_value = mock_repo
        
        # Initialize integration and get pull requests
        integration = GitHubIntegration(api_token="test_token")
        integration.set_repository("test/repo")
        prs = integration.get_pull_requests()
        
        # Verify get_pulls was called
        mock_repo.get_pulls.assert_called_once()
        
        # Verify dataframe
        assert isinstance(prs, pd.DataFrame)
        assert len(prs) == 2
        assert prs.iloc[0]["id"] == 1
        assert prs.iloc[0]["title"] == "Test PR 1"
        assert prs.iloc[0]["state"] == "open"
        assert prs.iloc[1]["id"] == 2
        assert prs.iloc[1]["title"] == "Test PR 2"
        assert prs.iloc[1]["state"] == "closed"
    
    @patch('src.integrations.github_integration.Github')
    def test_calculate_metrics(self, mock_github):
        """Test calculating metrics"""
        # Set up mocks
        mock_repo = MagicMock()
        
        # Mock pull requests
        mock_pr1 = MagicMock()
        mock_pr1.number = 1
        mock_pr1.title = "Test PR 1"
        mock_pr1.state = "open"
        mock_pr1.created_at = pd.Timestamp.now()
        mock_pr1.closed_at = None
        mock_pr1.merged_at = None
        
        mock_pr2 = MagicMock()
        mock_pr2.number = 2
        mock_pr2.title = "Test PR 2"
        mock_pr2.state = "closed"
        mock_pr2.created_at = pd.Timestamp.now()
        mock_pr2.closed_at = pd.Timestamp.now()
        mock_pr2.merged_at = pd.Timestamp.now()
        
        mock_repo.get_pulls.return_value = [mock_pr1, mock_pr2]
        
        # Mock commits
        mock_commit1 = MagicMock()
        mock_commit1.sha = "abc123"
        mock_commit1.author.login = "test_user"
        mock_commit1.commit.message = "Test commit 1"
        mock_commit1.commit.author.date = pd.Timestamp.now()
        mock_commit1.stats.additions = 100
        mock_commit1.stats.deletions = 50
        mock_commit1.stats.total = 150
        
        mock_commit2 = MagicMock()
        mock_commit2.sha = "def456"
        mock_commit2.author.login = "test_user2"
        mock_commit2.commit.message = "Test commit 2"
        mock_commit2.commit.author.date = pd.Timestamp.now()
        mock_commit2.stats.additions = 200
        mock_commit2.stats.deletions = 100
        mock_commit2.stats.total = 300
        
        mock_repo.get_commits.return_value = [mock_commit1, mock_commit2]
        
        # Mock issues
        mock_issue1 = MagicMock()
        mock_issue1.number = 1
        mock_issue1.title = "Test Issue 1"
        mock_issue1.state = "open"
        mock_issue1.created_at = pd.Timestamp.now()
        mock_issue1.closed_at = None
        mock_issue1.user.login = "test_user"
        mock_issue1.labels = []
        mock_issue1.comments = 3
        mock_issue1.pull_request = None
        
        mock_issue2 = MagicMock()
        mock_issue2.number = 2
        mock_issue2.title = "Test Issue 2"
        mock_issue2.state = "closed"
        mock_issue2.created_at = pd.Timestamp.now()
        mock_issue2.closed_at = pd.Timestamp.now()
        mock_issue2.user.login = "test_user2"
        mock_issue2.labels = []
        mock_issue2.comments = 5
        mock_issue2.pull_request = None
        
        # Issue that is a PR (should be skipped)
        mock_issue3 = MagicMock()
        mock_issue3.number = 3
        mock_issue3.pull_request = MagicMock()
        
        mock_repo.get_issues.return_value = [mock_issue1, mock_issue2, mock_issue3]
        
        mock_github.return_value.get_repo.return_value = mock_repo
        
        # Initialize integration and calculate metrics
        integration = GitHubIntegration(api_token="test_token")
        integration.set_repository("test/repo")
        metrics = integration.calculate_metrics()
        
        # Verify metrics
        assert isinstance(metrics, dict)
        assert metrics["pr_count"] == 2
        assert metrics["pr_merge_rate"] == 0.5  # 1 merged out of 2
        assert metrics["commit_count"] == 2
        assert metrics["avg_commit_size"] == 225.0  # (150 + 300) / 2
        assert metrics["issue_count"] == 2
        assert metrics["issue_close_rate"] == 0.5  # 1 closed out of 2
        assert "author_distribution" in metrics 