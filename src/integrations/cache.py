import os
import redis
import json
import functools
from typing import Callable, Any

# Initialize Redis connection
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
try:
    redis_client = redis.Redis.from_url(redis_url)
    redis_client.ping()
    print("Successfully connected to Redis for caching.")
except redis.exceptions.ConnectionError as e:
    print(f"Warning: Could not connect to Redis for caching: {e}")
    redis_client = None

def generate_cache_key(func: Callable, *args: Any, **kwargs: Any) -> str:
    """
    Generates a cache key based on the function name, instance attributes, and arguments.
    Assumes the first argument 'self' is an instance of an integration class.
    """
    key_parts = [func.__name__]
    
    # Add instance-specific identifiers (e.g., repository name, project key)
    if args and hasattr(args[0], 'repository_name') and args[0].repository_name:
        key_parts.append(str(args[0].repository_name))
    elif args and hasattr(args[0], 'project_key') and args[0].project_key: # For Jira
        key_parts.append(str(args[0].project_key))
    elif args and hasattr(args[0], 'board_id') and args[0].board_id: # For Trello
        key_parts.append(str(args[0].board_id))

    # Add other relevant args and kwargs
    # Skipping 'self' (args[0])
    for arg in args[1:]:
        key_parts.append(str(arg))
    
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}={v}")
        
    return ":".join(key_parts)

def redis_cache(ttl_seconds: int = 1800): # Default TTL 30 minutes
    """
    Decorator to cache the result of a function in Redis.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any):
            if not redis_client:
                print("Warning: Redis client not available. Bypassing cache.")
                return func(*args, **kwargs)

            # Adjust key generation based on actual method signature
            # For 'calculate_metrics(self, days=30)' or 'calculate_metrics(self, project_key, days=30)'
            
            instance = args[0]
            cache_key_parts = [func.__name__]

            # GitHub: uses self.repository_name implicitly
            if hasattr(instance, 'repository_name') and instance.repository_name:
                cache_key_parts.append(instance.repository_name)
            
            # Jira: project_key is an argument
            if 'project_key' in kwargs:
                cache_key_parts.append(str(kwargs['project_key']))
            elif len(args) > 1 and isinstance(args[1], str): # Assuming project_key is the first arg after self
                cache_key_parts.append(args[1])

            # Trello: board_id is an argument
            if 'board_id' in kwargs:
                cache_key_parts.append(str(kwargs['board_id']))
            # If board_id is passed as a positional arg (second arg after self)
            elif len(args) > 1 and (isinstance(args[1], str) and not ('project_key' in kwargs or (len(args) > 1 and isinstance(args[1], str) and func.__name__ != 'calculate_metrics_jira')) ) :
                 # this check is a bit complex to differentiate between jira's project_key and trello's board_id
                 # when they are passed as positional arguments.
                 # A more robust way would be to inspect func signature or use specific decorators.
                 if func.__qualname__.startswith('TrelloIntegration'): # Check class name
                    cache_key_parts.append(args[1])


            # Add 'days' argument if present
            if 'days' in kwargs:
                cache_key_parts.append(f"days={kwargs['days']}")
            elif len(args) > 2 and isinstance(args[2], int): # days is the second arg after self, project_key/board_id
                 cache_key_parts.append(f"days={args[2]}")
            elif len(args) > 1 and isinstance(args[1], int) and not ( hasattr(instance, 'repository_name') and instance.repository_name ): # days is the first arg after self (for github)
                 cache_key_parts.append(f"days={args[1]}")


            final_cache_key = ":".join(filter(None, cache_key_parts))
            
            try:
                cached_result = redis_client.get(final_cache_key)
                if cached_result:
                    print(f"Cache hit for key: {final_cache_key}")
                    return json.loads(cached_result)
            except redis.exceptions.RedisError as e:
                print(f"Redis error while getting cache: {e}. Bypassing cache.")

            print(f"Cache miss for key: {final_cache_key}. Calling function.")
            result = func(*args, **kwargs)
            
            try:
                redis_client.setex(final_cache_key, ttl_seconds, json.dumps(result))
            except redis.exceptions.RedisError as e:
                print(f"Redis error while setting cache: {e}.")
            
            return result
        return wrapper
    return decorator
