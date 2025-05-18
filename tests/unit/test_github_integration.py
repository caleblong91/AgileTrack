import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone
from src.integrations.github_integration import GitHubIntegration

class TestGitHubIntegration:
    """Test cases for the GitHub Integration class"""
    
    def test_init_with_token(self):
        """Test initializing with token only"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            integration = GitHubIntegration(api_token="test_token")
            mock_github.assert_called_once_with("test_token")
            assert integration.api_token == "test_token"
            assert integration.repository_name is None
            assert integration.repository is None
    
    def test_init_with_token_and_repo(self):
        """Test initializing with token and repository"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            mock_instance = MagicMock()
            mock_github.return_value = mock_instance
            mock_instance.get_repo.return_value = "test_repo_object"
            
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            mock_github.assert_called_once_with("test_token")
            mock_instance.get_repo.assert_called_once_with("owner/repo")
            assert integration.api_token == "test_token"
            assert integration.repository_name == "owner/repo"
            assert integration.repository == "test_repo_object"
    
    def test_set_repository_success(self):
        """Test setting repository successfully"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            mock_instance = MagicMock()
            mock_github.return_value = mock_instance
            mock_instance.get_repo.return_value = "test_repo_object"
            
            integration = GitHubIntegration(api_token="test_token")
            result = integration.set_repository("owner/repo")
            
            mock_instance.get_repo.assert_called_once_with("owner/repo")
            assert integration.repository_name == "owner/repo"
            assert integration.repository == "test_repo_object"
            assert result == "test_repo_object"
    
    def test_set_repository_empty_name(self):
        """Test setting repository with empty name raises ValueError"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            integration = GitHubIntegration(api_token="test_token")
            
            with pytest.raises(ValueError) as excinfo:
                integration.set_repository("")
                
            assert "Repository name cannot be empty" in str(excinfo.value)
            mock_github.return_value.get_repo.assert_not_called()
    
    def test_set_repository_error(self):
        """Test setting repository with invalid name raises ValueError"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            mock_instance = MagicMock()
            mock_github.return_value = mock_instance
            mock_instance.get_repo.side_effect = Exception("Repository not found")
            
            integration = GitHubIntegration(api_token="test_token")
            
            with pytest.raises(ValueError) as excinfo:
                integration.set_repository("invalid/repo")
                
            assert "Could not access repository" in str(excinfo.value)
            mock_instance.get_repo.assert_called_once_with("invalid/repo")
    
    def test_get_pull_requests_no_repository(self):
        """Test get_pull_requests with no repository raises ValueError"""
        with patch('src.integrations.github_integration.Github'):
            integration = GitHubIntegration(api_token="test_token")
            
            with pytest.raises(ValueError) as excinfo:
                integration.get_pull_requests()
                
            assert "Repository not set" in str(excinfo.value)
    
    def test_get_pull_requests_success(self):
        """Test get_pull_requests returns correct DataFrame"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            # Setup mock repository
            mock_instance = MagicMock()
            mock_github.return_value = mock_instance
            mock_repo = MagicMock()
            mock_instance.get_repo.return_value = mock_repo
            
            # Setup mock pull requests
            mock_pr1 = MagicMock()
            mock_pr1.number = 1
            mock_pr1.title = "Test PR 1"
            mock_pr1.state = "closed"
            mock_pr1.created_at = datetime.now(timezone.utc) - timedelta(days=5)
            mock_pr1.closed_at = datetime.now(timezone.utc) - timedelta(days=3)
            mock_pr1.merged_at = datetime.now(timezone.utc) - timedelta(days=3)
            mock_pr1.user.login = "testuser"
            mock_pr1.additions = 100
            mock_pr1.deletions = 50
            mock_pr1.changed_files = 10
            mock_pr1.comments = 5
            mock_pr1.review_comments = 3
            
            mock_pr2 = MagicMock()
            mock_pr2.number = 2
            mock_pr2.title = "Test PR 2"
            mock_pr2.state = "open"
            mock_pr2.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            mock_pr2.closed_at = None
            mock_pr2.merged_at = None
            mock_pr2.user.login = "testuser2"
            mock_pr2.additions = 200
            mock_pr2.deletions = 100
            mock_pr2.changed_files = 20
            mock_pr2.comments = 2
            mock_pr2.review_comments = 1
            
            # Setup old PR that should be filtered out by date
            mock_pr_old = MagicMock()
            mock_pr_old.number = 3
            mock_pr_old.created_at = datetime.now(timezone.utc) - timedelta(days=60)
            
            mock_repo.get_pulls.return_value = [mock_pr1, mock_pr2, mock_pr_old]
            
            # Initialize integration with repository
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            # Call the method
            result = integration.get_pull_requests(days=30)
            
            # Assertions
            mock_repo.get_pulls.assert_called_once_with(state="all", sort="created", direction="desc")
            assert isinstance(result, pd.DataFrame)
            assert len(result) == 2  # old PR should be filtered out
            assert result.iloc[0]["id"] == 1
            assert result.iloc[1]["id"] == 2
            assert "title" in result.columns
            assert "state" in result.columns
            assert "created_at" in result.columns
            assert "merged_at" in result.columns
    
    def test_get_commits_success(self):
        """Test get_commits returns correct DataFrame"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            # Setup mock repository
            mock_instance = MagicMock()
            mock_github.return_value = mock_instance
            mock_repo = MagicMock()
            mock_instance.get_repo.return_value = mock_repo
            
            # Setup mock commits
            mock_commit1 = MagicMock()
            mock_commit1.sha = "abc123"
            mock_commit1.author.login = "testuser"
            mock_commit1.commit.message = "Test commit 1"
            mock_commit1.commit.author.date = datetime.now(timezone.utc) - timedelta(days=3)
            mock_commit1.stats.additions = 50
            mock_commit1.stats.deletions = 20
            mock_commit1.stats.total = 70
            
            mock_commit2 = MagicMock()
            mock_commit2.sha = "def456"
            mock_commit2.author.login = "testuser2"
            mock_commit2.commit.message = "Test commit 2"
            mock_commit2.commit.author.date = datetime.now(timezone.utc) - timedelta(days=1)
            mock_commit2.stats.additions = 30
            mock_commit2.stats.deletions = 10
            mock_commit2.stats.total = 40
            
            mock_repo.get_commits.return_value = [mock_commit1, mock_commit2]
            
            # Initialize integration with repository
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            # Call the method
            result = integration.get_commits(days=30)
            
            # Assertions
            assert isinstance(result, pd.DataFrame)
            assert len(result) == 2
            assert result.iloc[0]["sha"] == "abc123"
            assert result.iloc[1]["sha"] == "def456"
            assert "author" in result.columns
            assert "message" in result.columns
            assert "additions" in result.columns
            assert "deletions" in result.columns
    
    def test_get_issues_success(self):
        """Test get_issues returns correct DataFrame"""
        with patch('src.integrations.github_integration.Github') as mock_github:
            # Setup mock repository
            mock_instance = MagicMock()
            mock_github.return_value = mock_instance
            mock_repo = MagicMock()
            mock_instance.get_repo.return_value = mock_repo
            
            # Setup mock issues
            mock_issue1 = MagicMock()
            mock_issue1.number = 1
            mock_issue1.title = "Test issue 1"
            mock_issue1.state = "closed"
            mock_issue1.created_at = datetime.now(timezone.utc) - timedelta(days=10)
            mock_issue1.closed_at = datetime.now(timezone.utc) - timedelta(days=5)
            mock_issue1.user.login = "testuser"
            mock_issue1.pull_request = None  # This is not a PR
            mock_label1 = MagicMock()
            mock_label1.name = "bug"
            mock_issue1.labels = [mock_label1]
            mock_issue1.comments = 3
            
            mock_issue2 = MagicMock()
            mock_issue2.number = 2
            mock_issue2.title = "Test issue 2"
            mock_issue2.state = "open"
            mock_issue2.created_at = datetime.now(timezone.utc) - timedelta(days=3)
            mock_issue2.closed_at = None
            mock_issue2.user.login = "testuser2"
            mock_issue2.pull_request = None  # This is not a PR
            mock_label2 = MagicMock()
            mock_label2.name = "enhancement"
            mock_issue2.labels = [mock_label2]
            mock_issue2.comments = 1
            
            # Issue that is a PR (should be filtered out)
            mock_issue_pr = MagicMock()
            mock_issue_pr.number = 3
            mock_issue_pr.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            mock_issue_pr.pull_request = True
            
            # Old issue (should be filtered out)
            mock_issue_old = MagicMock()
            mock_issue_old.number = 4
            mock_issue_old.created_at = datetime.now(timezone.utc) - timedelta(days=40)
            mock_issue_old.pull_request = None
            
            mock_repo.get_issues.return_value = [mock_issue1, mock_issue2, mock_issue_pr, mock_issue_old]
            
            # Initialize integration with repository
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            # Call the method
            result = integration.get_issues(days=30)
            
            # Assertions
            mock_repo.get_issues.assert_called_once_with(state="all", sort="created", direction="desc")
            assert isinstance(result, pd.DataFrame)
            assert len(result) == 2  # PR and old issue should be filtered out
            assert result.iloc[0]["id"] == 1
            assert result.iloc[1]["id"] == 2
            assert "title" in result.columns
            assert "state" in result.columns
            assert "labels" in result.columns
            assert result.iloc[0]["labels"] == ["bug"]
    
    def test_calculate_metrics_active_repo(self):
        """Test calculate_metrics with active repository"""
        with patch('src.integrations.github_integration.Github'):
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            # Mock the data retrieval methods
            with patch.object(integration, 'get_pull_requests') as mock_get_prs, \
                 patch.object(integration, 'get_commits') as mock_get_commits, \
                 patch.object(integration, 'get_issues') as mock_get_issues:
                
                # Setup mock data
                # PRs data
                prs_data = {
                    'id': [1, 2, 3],
                    'title': ['PR1', 'PR2', 'PR3'],
                    'created_at': [
                        datetime.now(timezone.utc) - timedelta(days=10),
                        datetime.now(timezone.utc) - timedelta(days=8),
                        datetime.now(timezone.utc) - timedelta(days=5)
                    ],
                    'merged_at': [
                        datetime.now(timezone.utc) - timedelta(days=9),
                        datetime.now(timezone.utc) - timedelta(days=7),
                        None  # Not merged
                    ],
                    'state': ['closed', 'closed', 'open']
                }
                mock_get_prs.return_value = pd.DataFrame(prs_data)
                
                # Commits data
                commits_data = {
                    'sha': ['abc', 'def', 'ghi'],
                    'author': ['user1', 'user2', 'user1'],
                    'total_changes': [100, 50, 75]
                }
                mock_get_commits.return_value = pd.DataFrame(commits_data)
                
                # Issues data
                issues_data = {
                    'id': [4, 5, 6],
                    'title': ['Issue1', 'Issue2', 'Issue3'],
                    'created_at': [
                        datetime.now(timezone.utc) - timedelta(days=15),
                        datetime.now(timezone.utc) - timedelta(days=12),
                        datetime.now(timezone.utc) - timedelta(days=6)
                    ],
                    'closed_at': [
                        datetime.now(timezone.utc) - timedelta(days=10),
                        None,  # Not closed
                        None   # Not closed
                    ],
                    'state': ['closed', 'open', 'open']
                }
                mock_get_issues.return_value = pd.DataFrame(issues_data)
                
                # Call the method
                result = integration.calculate_metrics(days=30)
                
                # Assertions
                assert isinstance(result, dict)
                assert 'pr_count' in result
                assert result['pr_count'] == 3
                assert 'pr_merge_rate' in result
                assert result['pr_merge_rate'] == 2/3  # 2 out of 3 PRs merged
                assert 'commit_count' in result
                assert result['commit_count'] == 3
                assert 'avg_commit_size' in result
                assert result['avg_commit_size'] == (100 + 50 + 75) / 3
                assert 'issue_count' in result
                assert result['issue_count'] == 3
                assert 'issue_close_rate' in result
                assert result['issue_close_rate'] == 1/3  # 1 out of 3 issues closed
    
    def test_calculate_metrics_inactive_repo(self):
        """Test calculate_metrics with inactive repository"""
        with patch('src.integrations.github_integration.Github'):
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            # Mock the data retrieval methods to return empty DataFrames
            with patch.object(integration, 'get_pull_requests') as mock_get_prs, \
                 patch.object(integration, 'get_commits') as mock_get_commits, \
                 patch.object(integration, 'get_issues') as mock_get_issues:
                
                mock_get_prs.return_value = pd.DataFrame()
                mock_get_commits.return_value = pd.DataFrame()
                mock_get_issues.return_value = pd.DataFrame()
                
                # Call the method
                result = integration.calculate_metrics(days=30)
                
                # Assertions
                assert isinstance(result, dict)
                assert 'no_activity' in result
                assert result['no_activity'] is True
                assert 'status' in result
                assert result['status'] == 'valid_but_inactive'
                assert 'pr_count' in result
                assert result['pr_count'] == 0
                assert 'commit_count' in result
                assert result['commit_count'] == 0
                assert 'issue_count' in result
                assert result['issue_count'] == 0
    
    def test_calculate_metrics_error(self):
        """Test calculate_metrics with an error during data retrieval"""
        with patch('src.integrations.github_integration.Github'):
            integration = GitHubIntegration(api_token="test_token", repository="owner/repo")
            
            # Mock the data retrieval methods to raise exceptions
            with patch.object(integration, 'get_pull_requests') as mock_get_prs:
                mock_get_prs.side_effect = Exception("API error")
                
                # Call the method
                result = integration.calculate_metrics(days=30)
                
                # Assertions
                assert isinstance(result, dict)
                assert 'error' in result
                assert result['error'] is True
                assert 'message' in result
                assert "Error calculating metrics" in result['message'] 