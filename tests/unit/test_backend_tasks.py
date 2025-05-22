import pytest
from unittest.mock import patch, MagicMock, ANY
from datetime import datetime
from sqlalchemy.sql import func # For func.now() comparison, though direct datetime is easier with freezegun

from src.backend.tasks import initial_sync_metrics_task, periodic_sync_all_integrations_metrics_task
from src.models.integration import Integration # Assuming your model is here
# from src.backend.database import SessionLocal # We will mock this
# from src.integrations.integration_factory import IntegrationFactory # We will mock this

# It's often helpful to use a library like freezegun to control time in tests
# For now, we'll use ANY for timestamp comparisons or check if it's set.


@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_initial_sync_metrics_task_success(mock_integration_factory, mock_session_local):
    """Test initial_sync_metrics_task successfully syncs an integration."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session
    
    mock_integration = MagicMock(spec=Integration)
    mock_integration.id = 1
    mock_integration.name = "Test GitHub"
    mock_integration.type = "github"
    mock_integration.api_key = "test_key"
    mock_integration.api_url = None
    mock_integration.username = None
    mock_integration.config = {"repository": "test/repo"}
    
    mock_db_session.query(Integration).filter(Integration.id == 1).first.return_value = mock_integration
    
    mock_integration_instance = MagicMock()
    mock_integration_factory.create_integration.return_value = mock_integration_instance
    mock_integration_factory.get_metrics.return_value = {"pr_count": 10}

    initial_sync_metrics_task(1)

    mock_integration_factory.create_integration.assert_called_once_with(
        integration_type="github",
        config={
            "api_token": "test_key", "api_key": "test_key", "token": "test_key",
            "server": None, "username": None, "repository": "test/repo", "api_secret": None
        }
    )
    mock_integration_factory.get_metrics.assert_called_once_with(
        mock_integration_instance, 
        {"days": 30} # Default days, project_key/board_id would be from config if present
    )
    
    assert mock_integration.last_sync is not None # Check it was set
    assert mock_integration.updated_at is not None # Check it was set
    mock_db_session.commit.assert_called_once()
    mock_db_session.close.assert_called_once()


@patch('src.backend.tasks.SessionLocal')
def test_initial_sync_metrics_task_integration_not_found(mock_session_local, caplog):
    """Test task when integration ID is not found."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session
    mock_db_session.query(Integration).filter(Integration.id == 999).first.return_value = None

    initial_sync_metrics_task(999)

    assert "Error: Integration with ID 999 not found." in caplog.text
    mock_db_session.commit.assert_not_called()
    mock_db_session.close.assert_called_once()


@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_initial_sync_metrics_task_get_metrics_value_error(mock_integration_factory, mock_session_local, caplog):
    """Test task when get_metrics raises ValueError (e.g. missing project_key)."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session
    
    mock_integration = MagicMock(spec=Integration)
    mock_integration.id = 2
    mock_integration.type = "jira" # Jira requires project_key
    mock_integration.config = {} # Missing project_key
    
    mock_db_session.query(Integration).filter(Integration.id == 2).first.return_value = mock_integration
    
    mock_integration_instance = MagicMock()
    mock_integration_factory.create_integration.return_value = mock_integration_instance
    mock_integration_factory.get_metrics.side_effect = ValueError("Missing project_key")

    initial_sync_metrics_task(2)

    assert mock_integration_factory.get_metrics.called
    # As per current task logic, last_sync is updated even on ValueError
    assert mock_integration.last_sync is not None 
    assert mock_integration.updated_at is not None
    mock_db_session.commit.assert_called_once() # Commit happens to update last_sync
    assert "ValueError during metrics calculation for integration 2 (jira): Missing project_key" in caplog.text
    mock_db_session.close.assert_called_once()


@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_initial_sync_metrics_task_get_metrics_general_error(mock_integration_factory, mock_session_local, caplog):
    """Test task when get_metrics raises a general Exception."""
    # This test assumes the task might retry for general errors.
    # The `initial_sync_metrics_task` has `bind=True` and calls `self.retry(exc=e)`
    # For unit testing, we can check if it re-raises the exception,
    # or mock `self.retry` if we want to assert it's called.
    
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session
    
    mock_integration = MagicMock(spec=Integration)
    mock_integration.id = 3
    mock_integration.type = "github"
    mock_integration.config = {"repository": "test/repo"}
        
    mock_db_session.query(Integration).filter(Integration.id == 3).first.return_value = mock_integration
    
    mock_integration_instance = MagicMock()
    mock_integration_factory.create_integration.return_value = mock_integration_instance
    general_exception = Exception("API timeout")
    mock_integration_factory.get_metrics.side_effect = general_exception

    # To test retry, we need to mock the task instance's retry method
    with patch.object(initial_sync_metrics_task, 'retry', side_effect=Exception("Retry called")) as mock_retry:
        with pytest.raises(Exception, match="Retry called"): # Expect the retry exception
             initial_sync_metrics_task(3)

        mock_retry.assert_called_once_with(exc=general_exception)
    
    # In this case, commit for last_sync might not be called if error is raised before
    mock_db_session.commit.assert_not_called() 
    assert f"Error during metrics calculation for integration 3: {str(general_exception)}" in caplog.text
    mock_db_session.close.assert_called_once()


# --- Tests for periodic_sync_all_integrations_metrics_task ---

@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_periodic_sync_all_success(mock_integration_factory, mock_session_local):
    """Test periodic sync successfully processes multiple integrations."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session

    mock_int1 = MagicMock(spec=Integration, id=1, type="github", config={"repository": "r1"}, api_key="k1", api_url=None, username=None)
    mock_int2 = MagicMock(spec=Integration, id=2, type="jira", config={"project_key": "p1"}, api_key="k2", api_url="jira.com", username="u2")
    
    mock_db_session.query(Integration).filter(Integration.active == True).all.return_value = [mock_int1, mock_int2]
    
    mock_integration_factory.get_metrics.return_value = {"data": "some_metric"}

    periodic_sync_all_integrations_metrics_task()

    assert mock_integration_factory.create_integration.call_count == 2
    assert mock_integration_factory.get_metrics.call_count == 2
    
    assert mock_int1.last_sync is not None
    assert mock_int1.updated_at is not None
    assert mock_int2.last_sync is not None
    assert mock_int2.updated_at is not None
    
    # Commit should be called for each successful integration sync
    assert mock_db_session.commit.call_count == 2 
    mock_db_session.close.assert_called_once()


@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_periodic_sync_no_active_integrations(mock_integration_factory, mock_session_local, caplog):
    """Test periodic sync when no active integrations are found."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session
    mock_db_session.query(Integration).filter(Integration.active == True).all.return_value = []

    periodic_sync_all_integrations_metrics_task()

    mock_integration_factory.create_integration.assert_not_called()
    mock_integration_factory.get_metrics.assert_not_called()
    assert "Celery Beat: No active integrations found to sync." in caplog.text
    mock_db_session.commit.assert_not_called()
    mock_db_session.close.assert_called_once()


@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_periodic_sync_one_fails_others_succeed(mock_integration_factory, mock_session_local, caplog):
    """Test periodic sync where one integration fails but others succeed."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session

    mock_int1 = MagicMock(spec=Integration, id=1, type="github", config={"repository": "r1"}, api_key="k1", api_url=None, username=None)
    # Jira integration missing project_key in config, will cause ValueError in get_metrics via factory
    mock_int2_failing = MagicMock(spec=Integration, id=2, type="jira", config={}, api_key="k2", api_url="jira.com", username="u2") 
    mock_int3 = MagicMock(spec=Integration, id=3, type="trello", config={"board_id": "b1"}, api_key="k3", api_url=None, username=None)

    mock_db_session.query(Integration).filter(Integration.active == True).all.return_value = [mock_int1, mock_int2_failing, mock_int3]

    # Simulate get_metrics behavior: success for int1 & int3, ValueError for int2
    def get_metrics_side_effect(instance, params):
        if params.get("project_key") == "MISSING_FOR_INT2_FAIL": # This check needs to align with how create_integration is called
             # This is a bit tricky, the error is raised if project_key is required by JiraIntegration's calculate_metrics
             # and not passed in `params`. The factory's get_metrics raises ValueError if config.get('project_key') is None.
             # For mock_int2_failing, its config is {}, so project_key will be None.
             # The task tries to get project_key from integration.config for Jira.
             # If integration.config.get("project_key") is None, it won't be in metrics_params.
             # Then IntegrationFactory.get_metrics will raise ValueError for Jira if project_key is not in params.
            if instance.type == "jira" and not params.get("project_key"): # Simulate the factory's check
                raise ValueError("project_key is required for Jira metrics")
            return {"data": "metric_data"}
        return {"data": "metric_data"}
    
    # More accurate simulation: The task itself checks for project_key in config.
    # If not found, it prints a warning and skips that integration for get_metrics call.
    # So, IntegrationFactory.get_metrics won't even be called for mock_int2_failing for its metrics.
    # Instead, a warning is logged.
    
    # Let's refine: mock_integration_factory.get_metrics will only be called for valid configs.
    mock_integration_factory.get_metrics.return_value = {"data": "some_metric"}


    periodic_sync_all_integrations_metrics_task()

    # create_integration should be called for all three
    assert mock_integration_factory.create_integration.call_count == 3
    # get_metrics should be called for int1 and int3, but skipped for int2 due to missing config.
    assert mock_integration_factory.get_metrics.call_count == 2 
    
    assert mock_int1.last_sync is not None
    assert mock_int1.updated_at is not None
    
    # For mock_int2_failing, it should be skipped by the task's own logic before calling get_metrics
    assert mock_int2_failing.last_sync is None # Should not be updated as it was skipped
    assert mock_int2_failing.updated_at is None
    assert f"Warning: project_key not found in config for Jira integration ID {mock_int2_failing.id}. Skipping metrics sync." in caplog.text

    assert mock_int3.last_sync is not None
    assert mock_int3.updated_at is not None
    
    assert mock_db_session.commit.call_count == 2 # For int1 and int3
    mock_db_session.close.assert_called_once()


@patch('src.backend.tasks.SessionLocal')
@patch('src.backend.tasks.IntegrationFactory')
def test_periodic_sync_get_metrics_general_exception(mock_integration_factory, mock_session_local, caplog):
    """Test periodic sync when get_metrics raises a general Exception for one integration."""
    mock_db_session = MagicMock()
    mock_session_local.return_value = mock_db_session

    mock_int1 = MagicMock(spec=Integration, id=1, type="github", config={"repository": "r1"}, api_key="k1")
    mock_int2_error = MagicMock(spec=Integration, id=2, type="github", config={"repository": "r2"}, api_key="k2")
    
    mock_db_session.query(Integration).filter(Integration.active == True).all.return_value = [mock_int1, mock_int2_error]

    general_exception = Exception("Temporary API issue")
    def get_metrics_side_effect(instance, params):
        # Based on how create_integration is called by the task, we can determine which integration it is
        # The config passed to create_integration has the api_key.
        # This is a bit complex to differentiate here. Let's assume instance has an id or unique field.
        # The mock_integration_factory.create_integration will return a mock.
        # We need to make that mock identifiable or make get_metrics fail for a specific call.
        
        # Simplification: make it fail on the second call to get_metrics
        if mock_integration_factory.get_metrics.call_count == 2: # First call is 1, second is 2
            raise general_exception
        return {"data": "metric_data"}

    # Instead, let's make create_integration return identifiable mocks
    mock_inst1 = MagicMock(type="github")
    mock_inst2_error = MagicMock(type="github")
    mock_integration_factory.create_integration.side_effect = [mock_inst1, mock_inst2_error]
    
    # Now, make get_metrics fail if it's called with mock_inst2_error
    def get_metrics_selective_fail(instance, params):
        if instance == mock_inst2_error:
            raise general_exception
        return {"data": "metric_data_for_inst1"}
    mock_integration_factory.get_metrics.side_effect = get_metrics_selective_fail


    periodic_sync_all_integrations_metrics_task()

    assert mock_integration_factory.create_integration.call_count == 2
    assert mock_integration_factory.get_metrics.call_count == 2 
    
    assert mock_int1.last_sync is not None # Success for int1
    
    assert mock_int2_error.last_sync is None # Should not be updated due to general error
    assert f"Celery Beat: Error syncing metrics for integration ID {mock_int2_error.id}: {str(general_exception)}" in caplog.text
    
    assert mock_db_session.commit.call_count == 1 # Only for int1
    mock_db_session.close.assert_called_once()
