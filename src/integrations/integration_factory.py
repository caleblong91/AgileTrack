from src.integrations.github_integration import GitHubIntegration
from src.integrations.jira_integration import JiraIntegration
from src.integrations.trello_integration import TrelloIntegration

class IntegrationFactory:
    """Factory for creating integration instances based on integration type"""
    
    @staticmethod
    def create_integration(integration_type, config=None):
        """
        Create a new integration instance based on the integration type
        
        Args:
            integration_type (str): Type of integration (github, jira, trello)
            config (dict): Configuration parameters for the integration
            
        Returns:
            Integration instance
        """
        if not config:
            config = {}
            
        if integration_type.lower() == "github":
            return GitHubIntegration(
                api_token=config.get("api_token"),
                repository=config.get("repository")
            )
        elif integration_type.lower() == "jira":
            return JiraIntegration(
                server=config.get("server"),
                username=config.get("username"),
                api_token=config.get("api_token")
            )
        elif integration_type.lower() == "trello":
            return TrelloIntegration(
                api_key=config.get("api_key"),
                api_secret=config.get("api_secret"),
                token=config.get("token")
            )
        else:
            raise ValueError(f"Unsupported integration type: {integration_type}")
    
    @staticmethod
    def get_metrics(integration_instance, config=None):
        """
        Get metrics from the integration instance
        
        Args:
            integration_instance: Integration instance
            config (dict): Configuration parameters for metric calculation
            
        Returns:
            dict: Metrics data
        """
        if not config:
            config = {}
            
        # Determine the type of integration and call the appropriate method
        if isinstance(integration_instance, GitHubIntegration):
            days = config.get("days", 30)
            return integration_instance.calculate_metrics(days=days)
        
        elif isinstance(integration_instance, JiraIntegration):
            project_key = config.get("project_key")
            days = config.get("days", 30)
            
            if not project_key:
                raise ValueError("project_key is required for Jira metrics")
                
            return integration_instance.calculate_metrics(project_key=project_key, days=days)
        
        elif isinstance(integration_instance, TrelloIntegration):
            board_id = config.get("board_id")
            days = config.get("days", 30)
            
            if not board_id:
                raise ValueError("board_id is required for Trello metrics")
                
            return integration_instance.calculate_metrics(board_id=board_id, days=days)
        
        else:
            raise ValueError(f"Unsupported integration type: {type(integration_instance)}")
            
    @staticmethod
    def get_supported_metrics(integration_type):
        """
        Get a list of supported metrics for a given integration type
        
        Args:
            integration_type (str): Type of integration (github, jira, trello)
            
        Returns:
            dict: Dictionary of metric names and descriptions
        """
        if integration_type.lower() == "github":
            return {
                "pr_count": "Number of pull requests in the period",
                "pr_merge_rate": "Percentage of pull requests that were merged",
                "avg_time_to_merge_hours": "Average time to merge pull requests (hours)",
                "commit_count": "Number of commits in the period",
                "avg_commit_size": "Average size of commits (lines changed)",
                "author_distribution": "Distribution of commits by author",
                "issue_count": "Number of issues in the period",
                "issue_close_rate": "Percentage of issues that were closed",
                "avg_time_to_close_hours": "Average time to close issues (hours)"
            }
        elif integration_type.lower() == "jira":
            return {
                "issue_counts_by_type": "Number of issues by type",
                "issue_counts_by_status": "Number of issues by status",
                "completed_story_points": "Total story points completed",
                "assignee_distribution": "Distribution of issues by assignee",
                "active_sprint_count": "Number of active sprints",
                "completed_sprint_count": "Number of completed sprints"
            }
        elif integration_type.lower() == "trello":
            return {
                "card_counts_by_list": "Number of cards in each list",
                "closed_card_count": "Number of closed cards",
                "open_card_count": "Number of open cards",
                "cards_with_due_count": "Number of cards with due dates",
                "overdue_card_count": "Number of overdue cards",
                "avg_checklist_completion": "Average checklist completion percentage",
                "label_distribution": "Distribution of cards by label",
                "member_distribution": "Distribution of cards by member"
            }
        else:
            raise ValueError(f"Unsupported integration type: {integration_type}") 