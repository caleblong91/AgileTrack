from celery import Celery
import os

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