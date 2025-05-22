import pytest
from unittest.mock import patch, MagicMock, call
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from src.backend.tasks import initial_sync_metrics_task, periodic_sync_all_integrations_metrics_task
from src.models.integration import Integration
from src.models.project import Project # Required for project relationship
from src.models.team import Team # Required for team relationship
from src.backend.database import Base, engine # Assuming Base and engine are accessible for setup

# If using a test-specific DB session management, import it.
# For this example, we'll assume a fixture `db_session` is provided via conftest.py
# that handles session creation and cleanup.

# If conftest.py is not set up for db_session, we might need a local one:
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker
# from src.backend.database import Base
# SQLALCHEMY_DATABASE_URL_TEST = "sqlite:///:memory:"
# engine_test = create_engine(SQLALCHEMY_DATABASE_URL_TEST, connect_args={"check_same_thread": False})
# SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

@pytest.fixture(scope="function") # function scope to ensure clean DB for each test
def setup_test_database(db_session: Session): # Assuming db_session is from conftest
    # Create tables if they don't exist (for in-memory or test DB)
    # Base.metadata.create_all(bind=engine) # Bind to your test engine
    
    # Clear data from previous tests
    db_session.query(Integration).delete()
    db_session.query(Project).delete() # Delete dependent tables first if FK constraints
    db_session.query(Team).delete()
    db_session.commit()
    yield db_session


@pytest.mark.integration
class TestInitialSyncMetricsTaskIntegration:

    @patch('src.backend.tasks.IntegrationFactory.get_metrics')
    @patch('src.backend.tasks.IntegrationFactory.create_integration')
    def test_initial_sync_successful(self, mock_create_integration, mock_get_metrics, setup_test_database):
        db: Session = setup_test_database

        # Setup: Create a test team and project first
        test_team = Team(id=101, name="Test Team Sync")
        test_project = Project(id=202, name="Test Project Sync", team_id=test_team.id)
        db.add_all([test_team, test_project])
        db.commit()

        test_integration = Integration(
            id=1, name="GH Sync Test", type="github", 
            api_key="key1", config={"repository": "test/repo"},
            project_id=test_project.id, team_id=test_team.id
        )
        db.add(test_integration)
        db.commit()

        mock_get_metrics.return_value = {"pr_count": 50, "status": "active"}
        mock_create_integration.return_value = MagicMock() # Dummy integration instance

        initial_sync_metrics_task(test_integration.id)

        db.refresh(test_integration) # Refresh to get updated values from DB

        assert test_integration.last_sync is not None
        assert test_integration.updated_at is not None
        mock_create_integration.assert_called_once()
        mock_get_metrics.assert_called_once()
        
        # Check args for create_integration
        create_args = mock_create_integration.call_args[1] # kwargs
        assert create_args['integration_type'] == "github"
        assert create_args['config']['repository'] == "test/repo"


@pytest.mark.integration
class TestPeriodicSyncAllIntegrationsTaskIntegration:

    @patch('src.backend.tasks.IntegrationFactory.get_metrics')
    @patch('src.backend.tasks.IntegrationFactory.create_integration')
    def test_periodic_sync_multiple_integrations(self, mock_create_integration, mock_get_metrics, setup_test_database):
        db: Session = setup_test_database

        # Setup: Create a test team and project first
        test_team = Team(id=303, name="Periodic Team")
        test_project = Project(id=404, name="Periodic Project", team_id=test_team.id)
        db.add_all([test_team, test_project])
        db.commit()
        
        # Create integrations
        int1 = Integration(id=10, name="GH1", type="github", api_key="ghk1", config={"repository": "r1"}, active=True, project_id=test_project.id, team_id=test_team.id)
        int2 = Integration(id=11, name="Jira1", type="jira", api_key="jk1", config={"project_key": "JP1"}, active=True, project_id=test_project.id, team_id=test_team.id)
        int3 = Integration(id=12, name="GH2 Inactive", type="github", api_key="ghk2", config={"repository": "r2"}, active=False, project_id=test_project.id, team_id=test_team.id) # Inactive
        int4 = Integration(id=13, name="Jira2 NoKey", type="jira", api_key="jk3", config={}, active=True, project_id=test_project.id, team_id=test_team.id) # Active but missing project_key

        db.add_all([int1, int2, int3, int4])
        db.commit()

        mock_get_metrics.return_value = {"status": "active", "data_points": 10}
        mock_create_integration.return_value = MagicMock() # Generic mock for integration instances

        periodic_sync_all_integrations_metrics_task()

        db.refresh(int1); db.refresh(int2); db.refresh(int3); db.refresh(int4)

        # Assertions
        assert int1.last_sync is not None
        assert int1.updated_at is not None
        assert int2.last_sync is not None
        assert int2.updated_at is not None
        
        assert int3.last_sync is None # Inactive, should not be processed
        assert int3.updated_at is None 
        
        # int4 (Jira2 NoKey) will be skipped by the task's internal check for project_key
        # and a warning will be logged. last_sync should not be updated by get_metrics.
        assert int4.last_sync is None 
        assert int4.updated_at is None

        # create_integration is called for each active integration that passes initial checks
        # int1, int2 are active and have valid config structure for the task's factory call
        # int4 is active but its config for Jira (missing project_key) means it's skipped *before* get_metrics
        # but after create_integration might be called by the task.
        # The task calls create_integration, then checks config for project_key/board_id for Jira/Trello.
        # So create_integration will be called for int1, int2, int4.
        assert mock_create_integration.call_count == 3 
        
        # get_metrics is called for int1 and int2
        assert mock_get_metrics.call_count == 2
        
        # Check create_integration calls more specifically
        # This can be complex if order is not guaranteed, but for side_effect list it might be
        calls = [
            call(integration_type="github", config=ANY), # For int1
            call(integration_type="jira", config=ANY),   # For int2
            call(integration_type="jira", config=ANY)    # For int4 (even if it's skipped later)
        ]
        # mock_create_integration.assert_has_calls(calls, any_order=True) # This is more robust

    @patch('src.backend.tasks.IntegrationFactory.get_metrics')
    @patch('src.backend.tasks.IntegrationFactory.create_integration')
    def test_periodic_sync_get_metrics_error_handling(self, mock_create_integration, mock_get_metrics, setup_test_database, caplog):
        db: Session = setup_test_database

        test_team = Team(id=505, name="Error Team")
        test_project = Project(id=606, name="Error Project", team_id=test_team.id)
        db.add_all([test_team, test_project])
        db.commit()

        int_ok = Integration(id=20, name="OK_GH", type="github", api_key="ok_key", config={"repository": "ok/repo"}, active=True, project_id=test_project.id, team_id=test_team.id)
        int_fail_value_error = Integration(id=21, name="FailJiraValueError", type="jira", api_key="fail_key1", config={"project_key": "FV"}, active=True, project_id=test_project.id, team_id=test_team.id)
        int_fail_general_error = Integration(id=22, name="FailTrelloGeneral", type="trello", api_key="fail_key2", config={"board_id": "FB"}, active=True, project_id=test_project.id, team_id=test_team.id)

        db.add_all([int_ok, int_fail_value_error, int_fail_general_error])
        db.commit()

        mock_inst_ok = MagicMock(type="github")
        mock_inst_fail_value = MagicMock(type="jira")
        mock_inst_fail_general = MagicMock(type="trello")
        mock_create_integration.side_effect = [mock_inst_ok, mock_inst_fail_value, mock_inst_fail_general]
        
        value_error_exception = ValueError("Jira config error")
        general_exception = Exception("Trello API unavailable")

        def get_metrics_side_effect(instance, params):
            if instance == mock_inst_ok:
                return {"data": "ok_data"}
            elif instance == mock_inst_fail_value:
                raise value_error_exception
            elif instance == mock_inst_fail_general:
                raise general_exception
            return {}
        mock_get_metrics.side_effect = get_metrics_side_effect

        periodic_sync_all_integrations_metrics_task()

        db.refresh(int_ok); db.refresh(int_fail_value_error); db.refresh(int_fail_general_error)

        assert int_ok.last_sync is not None # Should succeed
        
        # For ValueError, task logic updates last_sync
        assert int_fail_value_error.last_sync is not None 
        assert f"ValueError during metrics sync for integration ID {int_fail_value_error.id}: {str(value_error_exception)}" in caplog.text
        
        # For general Exception, task logic does not update last_sync and logs error
        assert int_fail_general_error.last_sync is None 
        assert f"Celery Beat: Error syncing metrics for integration ID {int_fail_general_error.id}: {str(general_exception)}" in caplog.text

        assert mock_create_integration.call_count == 3
        assert mock_get_metrics.call_count == 3
        assert db.commit.call_count == 2 # Once for int_ok, once for int_fail_value_error (to update last_sync)
        
        # Check that the task completed for all integrations despite errors
        assert "Celery Beat: Finished periodic sync." in caplog.text
        assert f"Successful: 1, Failed: 2" in caplog.text # Based on how we count failures (any exception)
                                                          # The task counts a ValueError as a "failed_sync"
                                                          # and a general exception as a "failed_sync".
                                                          # So, 1 success, 2 failures.
                                                          
        # Note: The "Failed: 2" comes from the task's own print statement.
        # The actual success count from a DB perspective (updated last_sync for metrics) is 1.
        # The task's "failed_syncs" counter increments for any exception during the loop for an integration.
        # The ValueError case for int_fail_value_error updates last_sync but is still counted as a failure by the task's log.
