import os
import redis
import json
import functools
import inspect # Import inspect
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
            # New cache key generation using inspect.signature
            instance = args[0] # Assuming the first argument is 'self'
            
            # Start key with class name and function name
            key_parts = [instance.__class__.__name__, func.__name__]

            # Handle GitHub's repository_name from instance attribute
            if hasattr(instance, 'repository_name') and instance.repository_name:
                key_parts.append(f"repository_name:{instance.repository_name}")

            sig = inspect.signature(func)
            try:
                bound_args = sig.bind(*args, **kwargs)
            except TypeError as e:
                # This can happen if a required arg is missing, though FastAPI/Pydantic usually catch this earlier.
                # Or if *args/**kwargs don't match the signature at all.
                print(f"Cache key generation error: Could not bind args for {func.__name__}: {e}")
                # Fallback to a less specific key or re-raise, for now, log and make a simple key
                key_parts.extend([str(arg) for arg in args[1:]]) # Skip self
                key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
                final_cache_key = ":".join(filter(None, key_parts))
            else:
                bound_args.apply_defaults()
                
                # Iterate over all arguments including 'self'
                first_param_name = next(iter(sig.parameters)) # Get the name of the first parameter (usually 'self')
                
                for name, value in bound_args.arguments.items():
                    if name == first_param_name: # Skip 'self' as its class is already in key_parts
                        continue
                    
                    # Only include relevant arguments by name for the cache key
                    # These are typically the ones that define the scope of the data being fetched.
                    if name in ['project_key', 'board_id', 'days'] and value is not None:
                        key_parts.append(f"{name}:{str(value)}")
                    # Example for other potential args, if any, that should be part of the key:
                    # elif name == 'another_relevant_arg' and value is not None:
                    #     key_parts.append(f"{name}:{str(value)}")

                final_cache_key = ":".join(filter(None, key_parts))

            print(f"Generated cache key for {func.__name__}: {final_cache_key}")
            
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
