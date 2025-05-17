import os
from github import Github
from datetime import datetime, timedelta, timezone
import pandas as pd

class GitHubIntegration:
    def __init__(self, api_token=None, repository=None):
        self.api_token = api_token or os.getenv("GITHUB_TOKEN")
        self.repository_name = repository
        self.github = Github(self.api_token)
        self.repository = None
        
        if self.repository_name:
            self.set_repository(self.repository_name)
    
    def set_repository(self, repository_name):
        """Set the repository to analyze"""
        if not repository_name:
            print("Warning: Empty repository name provided")
            raise ValueError("Repository name cannot be empty")
            
        self.repository_name = repository_name
        
        try:
            print(f"Trying to get repository: {repository_name}")
            self.repository = self.github.get_repo(repository_name)
            print(f"Successfully initialized repository: {repository_name}")
            return self.repository
        except Exception as e:
            print(f"Error getting repository {repository_name}: {str(e)}")
            raise ValueError(f"Could not access repository: {str(e)}")
    
    def get_pull_requests(self, state="all", days=30):
        """Get pull requests from the repository"""
        if not self.repository:
            raise ValueError("Repository not set")
            
        since = datetime.now(timezone.utc) - timedelta(days=days)
        pull_requests = self.repository.get_pulls(state=state, sort="created", direction="desc")
        
        pr_data = []
        for pr in pull_requests:
            if pr.created_at < since:
                continue
                
            pr_data.append({
                "id": pr.number,
                "title": pr.title,
                "state": pr.state,
                "created_at": pr.created_at,
                "closed_at": pr.closed_at,
                "merged_at": pr.merged_at,
                "user": pr.user.login,
                "additions": pr.additions,
                "deletions": pr.deletions,
                "changed_files": pr.changed_files,
                "comments": pr.comments,
                "review_comments": pr.review_comments
            })
            
        return pd.DataFrame(pr_data)
    
    def get_commits(self, days=30):
        """Get commits from the repository"""
        if not self.repository:
            raise ValueError("Repository not set")
            
        since = datetime.now(timezone.utc) - timedelta(days=days)
        commits = self.repository.get_commits(since=since)
        
        commit_data = []
        for commit in commits:
            stats = commit.stats
            
            commit_data.append({
                "sha": commit.sha,
                "author": commit.author.login if commit.author else "Unknown",
                "message": commit.commit.message,
                "date": commit.commit.author.date,
                "additions": stats.additions,
                "deletions": stats.deletions,
                "total_changes": stats.total
            })
            
        return pd.DataFrame(commit_data)
    
    def get_issues(self, state="all", days=30):
        """Get issues from the repository"""
        if not self.repository:
            raise ValueError("Repository not set")
            
        since = datetime.now(timezone.utc) - timedelta(days=days)
        issues = self.repository.get_issues(state=state, sort="created", direction="desc")
        
        issue_data = []
        for issue in issues:
            if issue.pull_request:  # Skip pull requests
                continue
                
            if issue.created_at < since:
                continue
                
            issue_data.append({
                "id": issue.number,
                "title": issue.title,
                "state": issue.state,
                "created_at": issue.created_at,
                "closed_at": issue.closed_at,
                "user": issue.user.login,
                "labels": [label.name for label in issue.labels],
                "comments": issue.comments
            })
            
        return pd.DataFrame(issue_data)
    
    def calculate_metrics(self, days=30):
        """Calculate metrics from GitHub data"""
        print(f"Calculating GitHub metrics for repository {self.repository_name} over {days} days")
        
        try:
            prs = self.get_pull_requests(days=days)
            print(f"Found {len(prs) if not prs.empty else 0} pull requests")
            
            commits = self.get_commits(days=days)
            print(f"Found {len(commits) if not commits.empty else 0} commits")
            
            issues = self.get_issues(days=days)
            print(f"Found {len(issues) if not issues.empty else 0} issues")
            
            metrics = {}
            
            # PR metrics
            if not prs.empty:
                merged_prs = prs[prs["merged_at"].notnull()]
                
                # Time to merge
                if not merged_prs.empty:
                    merged_prs["time_to_merge"] = (merged_prs["merged_at"] - merged_prs["created_at"]).dt.total_seconds() / 3600
                    metrics["avg_time_to_merge_hours"] = merged_prs["time_to_merge"].mean()
                    
                metrics["pr_count"] = len(prs)
                metrics["pr_merge_rate"] = len(merged_prs) / len(prs) if len(prs) > 0 else 0
                
            # Commit metrics
            if not commits.empty:
                metrics["commit_count"] = len(commits)
                metrics["avg_commit_size"] = commits["total_changes"].mean()
                
                # Commits per author
                author_commits = commits.groupby("author").size()
                metrics["author_distribution"] = author_commits.to_dict()
                
            # Issue metrics
            if not issues.empty:
                closed_issues = issues[issues["closed_at"].notnull()]
                
                # Time to close
                if not closed_issues.empty:
                    closed_issues["time_to_close"] = (closed_issues["closed_at"] - closed_issues["created_at"]).dt.total_seconds() / 3600
                    metrics["avg_time_to_close_hours"] = closed_issues["time_to_close"].mean()
                    
                metrics["issue_count"] = len(issues)
                metrics["issue_close_rate"] = len(closed_issues) / len(issues) if len(issues) > 0 else 0
                
            # If no metrics were calculated, add a placeholder to avoid returning empty object
            if not metrics:
                metrics["no_activity"] = True
                metrics["message"] = f"No activity found in the repository {self.repository_name} in the last {days} days"
                metrics["status"] = "valid_but_inactive"  # Add a status to show this is a valid repo, just inactive
                metrics["pr_count"] = 0
                metrics["commit_count"] = 0
                metrics["issue_count"] = 0
                print(f"No metrics calculated for {self.repository_name}: No recent activity")
            else:
                metrics["status"] = "active"
                print(f"Calculated metrics for {self.repository_name}: {', '.join(metrics.keys())}")
                
            return metrics
        
        except Exception as e:
            print(f"Error calculating GitHub metrics for {self.repository_name}: {str(e)}")
            # Return a metrics object with the error
            return {
                "error": True,
                "message": f"Error calculating metrics: {str(e)}"
            } 