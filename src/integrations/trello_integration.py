import os
from trello import TrelloClient
from datetime import datetime, timedelta
import pandas as pd
from .cache import redis_cache # Import the decorator

class TrelloIntegration:
    def __init__(self, api_key=None, api_secret=None, token=None):
        self.api_key = api_key or os.getenv("TRELLO_API_KEY")
        self.api_secret = api_secret or os.getenv("TRELLO_API_SECRET")
        self.token = token or os.getenv("TRELLO_TOKEN")
        
        self.client = TrelloClient(
            api_key=self.api_key,
            api_secret=self.api_secret,
            token=self.token
        )
        
    def get_boards(self):
        """Get all Trello boards"""
        boards = self.client.list_boards()
        
        return pd.DataFrame([{
            "id": board.id,
            "name": board.name,
            "description": board.description,
            "closed": board.closed,
            "url": board.url
        } for board in boards])
    
    def get_lists(self, board_id):
        """Get lists from a board"""
        board = self.client.get_board(board_id)
        lists = board.list_lists()
        
        return pd.DataFrame([{
            "id": lst.id,
            "name": lst.name,
            "closed": lst.closed,
            "pos": lst.pos
        } for lst in lists])
    
    def get_cards(self, board_id, days=30):
        """Get cards from a board"""
        board = self.client.get_board(board_id)
        lists = board.list_lists()
        since = datetime.now() - timedelta(days=days)
        
        card_data = []
        for lst in lists:
            cards = lst.list_cards()
            for card in cards:
                # Try to filter by creation date
                try:
                    created_date = card.created_date
                    if created_date and created_date < since:
                        continue
                except:
                    pass  # If we can't get creation date, include the card
                
                # Get card details
                card_dict = {
                    "id": card.id,
                    "name": card.name,
                    "description": card.description,
                    "list_name": lst.name,
                    "labels": [label.name for label in card.labels],
                    "due": card.due_date,
                    "closed": card.closed,
                    "url": card.url,
                    "members": [member.full_name for member in card.member_id]
                }
                
                # Get checklist completion
                if card.checklists:
                    total_items = 0
                    checked_items = 0
                    
                    for checklist in card.checklists:
                        total_items += len(checklist.items)
                        checked_items += len([item for item in checklist.items if item["checked"]])
                    
                    card_dict["checklist_completion"] = checked_items / total_items if total_items > 0 else None
                else:
                    card_dict["checklist_completion"] = None
                    
                card_data.append(card_dict)
                
        return pd.DataFrame(card_data)
    
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