from celery import Celery
import os
from sqlalchemy.sql import func
from datetime import datetime

# Import database session and models
from src.backend.database import SessionLocal
from src.models.integration import Integration
from src.integrations.integration_factory import IntegrationFactory

redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
app = Celery('agiletrack', broker=redis_url, backend=redis_url)

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@app.task
def test_task():
    return "Celery task completed successfully" 

@app.task(bind=True, max_retries=3, default_retry_delay=60) # Added bind=True for self, and retry options
def initial_sync_metrics_task(self, integration_id: int):
    """
    Asynchronously performs the initial metrics sync for a new integration.
    """
    print(f"Celery task initial_sync_metrics_task started for integration_id: {integration_id}")
    db = SessionLocal()
    try:
        integration = db.query(Integration).filter(Integration.id == integration_id).first()
        if not integration:
            print(f"Error: Integration with ID {integration_id} not found.")
            return

        print(f"Processing integration: {integration.name} ({integration.type})")

        # Prepare config for IntegrationFactory
        factory_config = {
            "api_token": integration.api_key, # Generic token name
            "api_key": integration.api_key,   # For Trello compatibility in factory
            "token": integration.api_key,     # For GitHub/Jira compatibility in factory
            "server": integration.api_url,
            "username": integration.username,
            "repository": integration.config.get("repository") if integration.config else None,
            # For Trello, api_secret might be in integration.config if stored separately
            "api_secret": integration.config.get("api_secret") if integration.config else None,
        }
        
        # Ensure specific keys required by factory are present if they differ from integration model fields
        if integration.type == "trello" and integration.config:
            if 'api_key' in integration.config: factory_config['api_key'] = integration.config['api_key']
            if 'token' in integration.config: factory_config['token'] = integration.config['token']
            # api_secret is already handled above

        print(f"Factory config for {integration.type}: { {k: (v[:4] + '...' if isinstance(v, str) and k.endswith('_key') or k.endswith('_token') else v) for k,v in factory_config.items()} }")

        integration_instance = IntegrationFactory.create_integration(
            integration_type=integration.type,
            config=factory_config
        )

        # Prepare metrics_config for IntegrationFactory.get_metrics
        # For the initial sync, we use default days and rely on config for project/board identifiers
        metrics_params = {"days": 30}
        if integration.type == "jira" and integration.config and integration.config.get("project_key"):
            metrics_params["project_key"] = integration.config["project_key"]
        elif integration.type == "trello" and integration.config and integration.config.get("board_id"):
            metrics_params["board_id"] = integration.config["board_id"]
        
        print(f"Calling get_metrics for {integration.type} with params: {metrics_params}")
        
        try:
            # This call will use the cache if data is fresh, or populate it.
            metrics = IntegrationFactory.get_metrics(integration_instance, metrics_params)
            print(f"Successfully fetched/calculated metrics for integration {integration_id}. Metrics keys: {list(metrics.keys()) if metrics else 'No metrics'}")
            integration.last_sync = func.now()
            integration.updated_at = func.now() # Also update updated_at
            db.commit()
            print(f"Successfully updated last_sync for integration {integration_id}")
        except ValueError as ve:
            # This can happen if project_key/board_id is required but not found for Jira/Trello
            print(f"ValueError during metrics calculation for integration {integration_id} ({integration.type}): {str(ve)}. Integration may require further configuration.")
            # We can still update last_sync to indicate an attempt was made, or leave it
            # For now, let's update it, so it doesn't get picked up by a periodic "stale" checker too soon.
            integration.last_sync = func.now() 
            integration.updated_at = func.now()
            db.commit()
            print(f"Updated last_sync for integration {integration_id} despite ValueError during metrics calculation.")
        except Exception as e:
            print(f"Error during metrics calculation for integration {integration_id}: {str(e)}")
            # Retry the task if it's a potentially transient error
            raise self.retry(exc=e)

    except Exception as e:
        print(f"Unhandled exception in initial_sync_metrics_task for integration {integration_id}: {str(e)}")
        # Retry the task if it's a potentially transient error (e.g. DB connection issue)
        # Ensure self.request.retries is available if not using bind=True
        # For now, using max_retries in @app.task decorator handles this.
        raise # Reraise to trigger Celery's retry mechanism

    finally:
        db.close()
        print(f"Celery task initial_sync_metrics_task finished for integration_id: {integration_id}")

@app.task(bind=True, max_retries=2, default_retry_delay=300) # Retry a couple of times with 5min delay for the whole batch
def periodic_sync_all_integrations_metrics_task(self):
    """
    Periodically syncs metrics for all active integrations.
    """
    print("Celery Beat: periodic_sync_all_integrations_metrics_task started.")
    db = SessionLocal()
    try:
        active_integrations = db.query(Integration).filter(Integration.active == True).all()
        if not active_integrations:
            print("Celery Beat: No active integrations found to sync.")
            return

        print(f"Celery Beat: Found {len(active_integrations)} active integrations to sync.")
        successful_syncs = 0
        failed_syncs = 0

        for integration in active_integrations:
            print(f"Celery Beat: Processing integration ID {integration.id} ({integration.name}, type: {integration.type})")
            try:
                # Prepare config for IntegrationFactory (similar to initial_sync_metrics_task)
                factory_config = {
                    "api_token": integration.api_key,
                    "api_key": integration.api_key,
                    "token": integration.api_key,
                    "server": integration.api_url,
                    "username": integration.username,
                    "repository": integration.config.get("repository") if integration.config else None,
                    "api_secret": integration.config.get("api_secret") if integration.config else None,
                }
                if integration.type == "trello" and integration.config:
                    if 'api_key' in integration.config: factory_config['api_key'] = integration.config['api_key']
                    if 'token' in integration.config: factory_config['token'] = integration.config['token']

                integration_instance = IntegrationFactory.create_integration(
                    integration_type=integration.type,
                    config=factory_config
                )

                # Prepare metrics_params for IntegrationFactory.get_metrics
                metrics_params = {"days": 30} # Default lookback period for periodic sync
                
                if integration.type == "jira":
                    project_key = integration.config.get("project_key") if integration.config else None
                    if not project_key:
                        print(f"Warning: project_key not found in config for Jira integration ID {integration.id}. Skipping metrics sync.")
                        failed_syncs +=1
                        continue
                    metrics_params["project_key"] = project_key
                elif integration.type == "trello":
                    board_id = integration.config.get("board_id") if integration.config else None
                    if not board_id:
                        print(f"Warning: board_id not found in config for Trello integration ID {integration.id}. Skipping metrics sync.")
                        failed_syncs +=1
                        continue
                    metrics_params["board_id"] = board_id
                
                print(f"Celery Beat: Calling get_metrics for integration {integration.id} with params: {metrics_params}")
                metrics = IntegrationFactory.get_metrics(integration_instance, metrics_params)
                
                integration.last_sync = func.now()
                integration.updated_at = func.now()
                db.commit()
                successful_syncs += 1
                print(f"Celery Beat: Successfully synced metrics for integration {integration.id}. Metrics keys: {list(metrics.keys()) if metrics else 'No metrics'}")

            except ValueError as ve: # Catch errors from get_metrics if config is bad (e.g. missing key after all)
                print(f"Celery Beat: ValueError during metrics sync for integration ID {integration.id}: {str(ve)}")
                failed_syncs += 1
                # Optionally update last_sync to now to prevent immediate re-attempts if the error is persistent config related
                integration.last_sync = func.now() 
                integration.updated_at = func.now()
                db.commit()
            except Exception as e:
                print(f"Celery Beat: Error syncing metrics for integration ID {integration.id}: {str(e)}")
                failed_syncs += 1
                # Do not re-raise here to allow other integrations to sync. Error is logged.
                # Consider if a specific integration should be marked as inactive after too many failures.

        print(f"Celery Beat: Finished periodic sync. Successful: {successful_syncs}, Failed: {failed_syncs}")

    except Exception as e:
        print(f"Celery Beat: Unhandled exception in periodic_sync_all_integrations_metrics_task: {str(e)}")
        raise self.retry(exc=e) # Retry the whole batch processing if a major error occurs
    finally:
        db.close()
        print("Celery Beat: periodic_sync_all_integrations_metrics_task finished.")

# Configure Celery Beat Schedule
app.conf.beat_schedule = {
    'sync-all-metrics-every-hour': {
        'task': 'src.backend.tasks.periodic_sync_all_integrations_metrics_task',
        'schedule': 3600.0,  # Run every hour (3600 seconds)
    },
}

# To ensure Celery Beat picks up timezone correctly if not already set globally
app.conf.timezone = 'UTC'