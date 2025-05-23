import os
import requests
from datetime import datetime, timedelta
import pandas as pd
from .cache import redis_cache # Import the decorator

class TrelloIntegration:
    def __init__(self, api_key=None, api_secret=None, token=None):
        self.api_key = api_key or os.getenv("TRELLO_API_KEY")
        self.token = token or os.getenv("TRELLO_TOKEN")
        
        if not self.api_key or not self.token:
            raise ValueError("Both API key and token are required for Trello integration")
        
        # Base URL for Trello API
        self.base_url = "https://api.trello.com/1"
        
    def get_boards(self):
        """Get all Trello boards"""
        try:
            # Make direct API call to Trello
            url = f"{self.base_url}/members/me/boards"
            params = {
                'key': self.api_key,
                'token': self.token,
                'filter': 'all'
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()  # Raise an exception for bad status codes
            
            boards = response.json()
            return pd.DataFrame([{
                "id": board['id'],
                "name": board['name'],
                "description": board.get('desc', ''),
                "closed": board.get('closed', False),
                "url": board.get('url', '')
            } for board in boards])
        except requests.exceptions.RequestException as e:
            print(f"Error in get_boards: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"Response text: {e.response.text}")
            raise ValueError(f"Failed to fetch Trello boards: {str(e)}")
    
    def get_lists(self, board_id):
        """Get lists from a board"""
        try:
            url = f"{self.base_url}/boards/{board_id}/lists"
            params = {
                'key': self.api_key,
                'token': self.token
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            lists = response.json()
            return pd.DataFrame([{
                "id": lst['id'],
                "name": lst['name'],
                "closed": lst.get('closed', False),
                "pos": lst.get('pos', 0)
            } for lst in lists])
        except requests.exceptions.RequestException as e:
            print(f"Error in get_lists: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"Response text: {e.response.text}")
            raise ValueError(f"Failed to fetch Trello lists: {str(e)}")
    
    def get_cards(self, board_id, days=30):
        """Get cards from a board"""
        try:
            url = f"{self.base_url}/boards/{board_id}/cards"
            params = {
                'key': self.api_key,
                'token': self.token,
                'members': 'true',
                'checklists': 'true'
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            cards = response.json()
            since = datetime.now() - timedelta(days=days)
            
            card_data = []
            for card in cards:
                # Try to filter by creation date
                try:
                    created_date = datetime.fromisoformat(card['dateLastActivity'].replace('Z', '+00:00'))
                    if created_date < since:
                        continue
                except:
                    pass  # If we can't get creation date, include the card
                
                # Get card details
                card_dict = {
                    "id": card['id'],
                    "name": card['name'],
                    "description": card.get('desc', ''),
                    "list_name": card.get('list', {}).get('name', ''),
                    "labels": [label['name'] for label in card.get('labels', [])],
                    "due": card.get('due'),
                    "closed": card.get('closed', False),
                    "url": card.get('url', ''),
                    "members": [member['fullName'] for member in card.get('members', [])]
                }
                
                # Get checklist completion
                if card.get('checklists'):
                    total_items = 0
                    checked_items = 0
                    
                    for checklist in card['checklists']:
                        total_items += len(checklist.get('checkItems', []))
                        checked_items += len([item for item in checklist.get('checkItems', []) if item.get('state') == 'complete'])
                    
                    card_dict["checklist_completion"] = checked_items / total_items if total_items > 0 else None
                else:
                    card_dict["checklist_completion"] = None
                    
                card_data.append(card_dict)
                
            return pd.DataFrame(card_data)
        except requests.exceptions.RequestException as e:
            print(f"Error in get_cards: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"Response text: {e.response.text}")
            raise ValueError(f"Failed to fetch Trello cards: {str(e)}")
    
    @redis_cache(ttl_seconds=1800) # Cache for 30 minutes
    def calculate_metrics(self, board_id, days=30):
        """Calculate agile metrics from Trello data"""
        # Store board_id on instance for cache key generation if not already there
        # This is a bit of a workaround for the current cache key generator
        if not hasattr(self, 'board_id') or self.board_id != board_id:
            self.board_id = board_id
            
        print(f"Calculating Trello metrics for board {board_id} over {days} days (cacheable)")
        lists = self.get_lists(board_id)
        cards = self.get_cards(board_id, days)
        
        metrics = {}
        
        # Card counts by list
        if not cards.empty:
            list_counts = cards.groupby("list_name").size()
            metrics["card_counts_by_list"] = list_counts.to_dict()
            
            # Closed cards
            closed_cards = cards[cards["closed"] == True]
            metrics["closed_card_count"] = len(closed_cards)
            metrics["open_card_count"] = len(cards) - len(closed_cards)
            
            # Cards with due dates
            cards_with_due = cards[cards["due"].notnull()]
            metrics["cards_with_due_count"] = len(cards_with_due)
            
            # Overdue cards
            now = datetime.now()
            overdue_cards = cards_with_due[cards_with_due["due"] < now]
            metrics["overdue_card_count"] = len(overdue_cards)
            
            # Checklist completion
            if "checklist_completion" in cards.columns and not cards["checklist_completion"].isna().all():
                metrics["avg_checklist_completion"] = cards["checklist_completion"].mean()
                
            # Label distribution
            if not cards["labels"].isna().all():
                all_labels = []
                for labels in cards["labels"]:
                    all_labels.extend(labels)
                    
                label_counts = pd.Series(all_labels).value_counts()
                metrics["label_distribution"] = label_counts.to_dict()
                
            # Member distribution
            if not cards["members"].isna().all():
                all_members = []
                for members in cards["members"]:
                    all_members.extend(members)
                    
                member_counts = pd.Series(all_members).value_counts()
                metrics["member_distribution"] = member_counts.to_dict()
                
        return metrics 