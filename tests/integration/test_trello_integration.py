import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
import json
import os
from datetime import datetime, timezone

try:
    import redis
    redis_available = True
except ImportError:
    redis_available = False

from src.integrations.trello_integration import TrelloIntegration

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
        yield None

@pytest.mark.integration
@pytest.mark.trello
class TestTrelloIntegrationCaching:
    """Integration tests for Trello integration caching"""

    def _setup_mock_trello_api(self, mock_trello_constructor):
        """Helper to set up common Trello API mocks."""
        mock_trello_instance = MagicMock()
        mock_trello_constructor.return_value = mock_trello_instance

        mock_board = MagicMock()
        mock_trello_instance.get_board.return_value = mock_board

        # Mock lists
        mock_list1 = MagicMock(id="list1", name="To Do", closed=False, pos=1)
        mock_list2 = MagicMock(id="list2", name="Done", closed=False, pos=2)
        mock_board.list_lists.return_value = [mock_list1, mock_list2]

        # Mock cards for list1
        mock_card1_list1 = MagicMock(
            id="card1", name="Card 1 To Do", description="Desc1",
            labels=[], due_date=None, closed=False, url="url1", member_id=[], checklists=[]
        )
        # Simulate created_date if your code uses it for filtering
        mock_card1_list1.created_date = datetime.now(timezone.utc) 
        
        # Mock cards for list2
        mock_card1_list2 = MagicMock(
            id="card2", name="Card 2 Done", description="Desc2",
            labels=[], due_date=None, closed=True, url="url2", member_id=[], checklists=[]
        )
        mock_card1_list2.created_date = datetime.now(timezone.utc)

        # Make list_cards a callable mock that returns different cards based on the list
        def list_cards_side_effect(*args, **kwargs):
            # `self` here refers to the mock list object (mock_list1 or mock_list2)
            if self.id == "list1": # `self` is the mock list instance
                return [mock_card1_list1]
            elif self.id == "list2":
                return [mock_card1_list2]
            return []

        mock_list1.list_cards = MagicMock(side_effect=lambda: list_cards_side_effect.__get__(mock_list1)())
        mock_list2.list_cards = MagicMock(side_effect=lambda: list_cards_side_effect.__get__(mock_list2)())
        
        return mock_trello_instance, mock_board, mock_list1, mock_list2


    @patch('src.integrations.trello_integration.TrelloClient')
    def test_calculate_metrics_caching(self, mock_trello_constructor, redis_client_instance):
        """Test caching behavior of calculate_metrics for Trello."""
        if not redis_available or not redis_client_instance:
            pytest.skip("Redis client not available, skipping caching test.")

        mock_trello_api, mock_board_api, mock_list1_api, mock_list2_api = self._setup_mock_trello_api(mock_trello_constructor)
        
        board_id_for_cache_test = "TRELLO_CACHE_BOARD"
        days_for_cache_test = 30
        
        integration = TrelloIntegration(api_key="key", api_secret="secret", token="token")

        # Construct the expected cache key
        # New key format: ClassName:function_name:board_id:BOARD_ID_VAL:days:DAYS_VAL
        expected_cache_key = f"TrelloIntegration:calculate_metrics:board_id:{board_id_for_cache_test}:days={days_for_cache_test}"

        # Ensure cache is clean before test
        deleted_count = redis_client_instance.delete(expected_cache_key)
        print(f"Attempted to delete key {expected_cache_key}, deleted: {deleted_count}")
        
        # First call - should hit API and cache the result
        print(f"First call for Trello board {board_id_for_cache_test} (cache key: {expected_cache_key})")
        metrics1 = integration.calculate_metrics(board_id=board_id_for_cache_test, days=days_for_cache_test)
        
        mock_trello_api.get_board.assert_called_with(board_id_for_cache_test)
        mock_board_api.list_lists.assert_called() # Should be called to get lists, then cards from lists
        # Check that list_cards was called on the mock lists returned by list_lists
        assert mock_list1_api.list_cards.called or mock_list2_api.list_cards.called


        # Verify something was cached
        cached_value_after_first_call = redis_client_instance.get(expected_cache_key)
        assert cached_value_after_first_call is not None
        
        # Reset mocks for the second call
        mock_trello_api.get_board.reset_mock()
        mock_board_api.list_lists.reset_mock()
        mock_list1_api.list_cards.reset_mock()
        mock_list2_api.list_cards.reset_mock()
        
        # Second call - should use cache
        print(f"Second call for Trello board {board_id_for_cache_test} (cache key: {expected_cache_key})")
        metrics2 = integration.calculate_metrics(board_id=board_id_for_cache_test, days=days_for_cache_test)
        
        mock_trello_api.get_board.assert_not_called()
        mock_board_api.list_lists.assert_not_called()
        mock_list1_api.list_cards.assert_not_called()
        mock_list2_api.list_cards.assert_not_called()
        
        assert metrics1 is not None, "Metrics from first call should not be None"
        assert metrics2 is not None, "Metrics from second call should not be None"
        assert json.dumps(metrics1, sort_keys=True) == json.dumps(metrics2, sort_keys=True), \
               "Metrics from cache should be identical to initial metrics"

        # Clean up the cache key
        redis_client_instance.delete(expected_cache_key)
        print(f"Cleaned up Trello cache key: {expected_cache_key}")
