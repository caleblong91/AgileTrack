import os
from jira import JIRA
from datetime import datetime, timedelta
import pandas as pd

class JiraIntegration:
    def __init__(self, server=None, username=None, api_token=None):
        self.server = server or os.getenv("JIRA_SERVER")
        self.username = username or os.getenv("JIRA_USERNAME")
        self.api_token = api_token or os.getenv("JIRA_API_TOKEN")
        
        self.jira = JIRA(
            server=self.server,
            basic_auth=(self.username, self.api_token)
        )
        
    def get_projects(self):
        """Get list of Jira projects"""
        projects = self.jira.projects()
        
        return pd.DataFrame([{
            "id": project.id,
            "key": project.key,
            "name": project.name
        } for project in projects])
    
    def get_sprints(self, board_id, state=None):
        """Get sprints from a board"""
        sprints = self.jira.sprints(board_id, state=state)
        
        return pd.DataFrame([{
            "id": sprint.id,
            "name": sprint.name,
            "state": sprint.state,
            "start_date": sprint.startDate if hasattr(sprint, 'startDate') else None,
            "end_date": sprint.endDate if hasattr(sprint, 'endDate') else None,
            "complete_date": sprint.completeDate if hasattr(sprint, 'completeDate') else None
        } for sprint in sprints])
    
    def get_issues(self, project_key, days=30, max_results=1000):
        """Get issues from a project"""
        since = datetime.now() - timedelta(days=days)
        since_str = since.strftime("%Y-%m-%d")
        
        jql = f"project = {project_key} AND created >= {since_str} ORDER BY created DESC"
        issues = self.jira.search_issues(jql, maxResults=max_results)
        
        issue_data = []
        for issue in issues:
            # Get transitions
            transitions = self.jira.transitions(issue)
            transition_data = [{
                "id": t["id"],
                "name": t["name"],
                "to_status": t["to"]["name"]
            } for t in transitions]
            
            # Get issue data
            issue_dict = {
                "id": issue.id,
                "key": issue.key,
                "summary": issue.fields.summary,
                "status": issue.fields.status.name,
                "issue_type": issue.fields.issuetype.name,
                "priority": issue.fields.priority.name if hasattr(issue.fields, 'priority') and issue.fields.priority else None,
                "created": issue.fields.created,
                "updated": issue.fields.updated,
                "assignee": issue.fields.assignee.displayName if issue.fields.assignee else None,
                "reporter": issue.fields.reporter.displayName if hasattr(issue.fields, 'reporter') and issue.fields.reporter else None,
                "story_points": getattr(issue.fields, 'customfield_10002', None),  # Adjust field name as needed
                "sprint": getattr(issue.fields, 'customfield_10001', None),  # Adjust field name as needed
                "transitions": transition_data
            }
            
            issue_data.append(issue_dict)
            
        return pd.DataFrame(issue_data)
    
    def get_boards(self, project_key=None):
        """Get boards from Jira"""
        if project_key:
            boards = self.jira.boards(projectKeyOrID=project_key)
        else:
            boards = self.jira.boards()
            
        return pd.DataFrame([{
            "id": board.id,
            "name": board.name,
            "type": board.type
        } for board in boards])
    
    def calculate_metrics(self, project_key, days=30):
        """Calculate agile metrics from Jira data"""
        issues = self.get_issues(project_key, days)
        
        metrics = {}
        
        # Issue counts by type
        if not issues.empty:
            issue_types = issues.groupby("issue_type").size()
            metrics["issue_counts_by_type"] = issue_types.to_dict()
            
            # Story points completed
            if "story_points" in issues.columns:
                completed_issues = issues[issues["status"].isin(["Done", "Closed", "Resolved"])]
                if not completed_issues.empty and not completed_issues["story_points"].isna().all():
                    metrics["completed_story_points"] = completed_issues["story_points"].sum()
                    
            # Issue counts by status
            status_counts = issues.groupby("status").size()
            metrics["issue_counts_by_status"] = status_counts.to_dict()
            
            # Assignee distribution
            if not issues["assignee"].isna().all():
                assignee_counts = issues.groupby("assignee").size()
                metrics["assignee_distribution"] = assignee_counts.to_dict()
        
        # Board and Sprint info
        try:
            boards = self.get_boards(project_key)
            if not boards.empty:
                # Get sprints from first board
                board_id = boards.iloc[0]["id"]
                sprints = self.get_sprints(board_id)
                
                if not sprints.empty:
                    # Count active and completed sprints
                    active_sprints = sprints[sprints["state"] == "active"]
                    completed_sprints = sprints[sprints["state"] == "closed"]
                    
                    metrics["active_sprint_count"] = len(active_sprints)
                    metrics["completed_sprint_count"] = len(completed_sprints)
        except Exception as e:
            # Error handling for projects without boards
            metrics["sprint_error"] = str(e)
            
        return metrics 