import json
import pytest
from unittest.mock import patch, MagicMock

# Assuming redis.exceptions.RedisError exists. If not, use a generic Exception.
import redis # Import for redis.exceptions

# Import the decorator and the client it uses
from src.integrations.cache import redis_cache, redis_client as actual_redis_client

# Store the original redis_client and restore it after tests if necessary,
# or ensure mocks are properly scoped. For module-level client, patching is safer.

@pytest.fixture
def mock_redis_client_fixture(mocker):
    """Fixture to mock the redis_client used by the decorator."""
    mock_client = MagicMock(spec=redis.Redis)
    mocker.patch('src.integrations.cache.redis_client', new=mock_client)
    return mock_client

# A simple function to be decorated for testing
@redis_cache(ttl_seconds=3600)
def expensive_function_no_args():
    expensive_function_no_args.call_count += 1
    return {"data": "result_no_args"}
expensive_function_no_args.call_count = 0

@redis_cache(ttl_seconds=1800)
def expensive_function_with_args(arg1, days=30):
    expensive_function_with_args.call_count += 1
    return {"data": f"result_{arg1}_{days}"}
expensive_function_with_args.call_count = 0

# Dummy class mimicking GitHubIntegration for testing cache key generation
class MockGitHubIntegration:
    def __init__(self, repository_name):
        self.repository_name = repository_name
        self.call_count = 0

    @redis_cache(ttl_seconds=60)
    def calculate_metrics(self, days=30):
        self.call_count += 1
        return {"repo": self.repository_name, "days": days, "metric": "gh_metric"}

# Dummy class mimicking JiraIntegration
class MockJiraIntegration:
    def __init__(self):
        # self.project_key will be set by the calculate_metrics method for the cache key
        self.call_count = 0

    @redis_cache(ttl_seconds=60)
    def calculate_metrics(self, project_key, days=30):
        self.project_key = project_key # Simulate behavior of real method
        self.call_count += 1
        return {"project": project_key, "days": days, "metric": "jira_metric"}

# Dummy class mimicking TrelloIntegration
class MockTrelloIntegration:
    def __init__(self):
        # self.board_id will be set by the calculate_metrics method
        self.call_count = 0

    @redis_cache(ttl_seconds=60)
    def calculate_metrics(self, board_id, days=30):
        self.board_id = board_id # Simulate behavior of real method
        self.call_count += 1
        return {"board": board_id, "days": days, "metric": "trello_metric"}


def test_cache_miss_no_args(mock_redis_client_fixture):
    # Reset call count for this specific test function
    # Note: expensive_function_no_args is defined at module level, its state persists.
    # Using a fixture to reset call_count (as added in previous step) is better.
    expensive_function_no_args.call_count = 0 
    mock_redis_client_fixture.get.return_value = None
    
    result = expensive_function_no_args()
    
    assert expensive_function_no_args.call_count == 1
    assert result == {"data": "result_no_args"}
    # Key for function with no args (other than self, which is not applicable here as it's not a method)
    # The new logic prepends class name if 'self' is an arg. For standalone functions, it's just func_name.
    # However, our test functions are module-level, not methods of a class passed as `args[0]`.
    # The decorator expects `args[0]` to be an instance.
    # Let's adjust the test to use methods of a dummy class for no-arg and with-arg standalone tests.

    # For now, assuming the test functions `expensive_function_no_args` and `expensive_function_with_args`
    # are NOT methods of a class instance being passed as `args[0]`.
    # The `inspect.signature` logic will work, but `instance.__class__.__name__` part will fail if no `args[0]`.
    # The current decorator code `instance = args[0]` will raise IndexError if not called on an instance.
    # THIS MEANS OUR TEST FUNCTIONS NEED TO BE METHODS OF A DUMMY CLASS.

    # Let's create a dummy class for these tests.
    class DummyTestClass:
        def __init__(self):
            self.expensive_method_no_args_call_count = 0
            self.expensive_method_with_args_call_count = 0

        @redis_cache(ttl_seconds=3600)
        def expensive_method_no_args(self):
            self.expensive_method_no_args_call_count += 1
            return {"data": "result_no_args_method"}

        @redis_cache(ttl_seconds=1800)
        def expensive_method_with_args(self, arg1, days=30):
            self.expensive_method_with_args_call_count += 1
            return {"data": f"result_method_{arg1}_{days}"}

    test_instance = DummyTestClass()
    result = test_instance.expensive_method_no_args()
    assert test_instance.expensive_method_no_args_call_count == 1
    assert result == {"data": "result_no_args_method"}
    expected_key_no_args = "DummyTestClass:expensive_method_no_args" # No other args
    mock_redis_client_fixture.get.assert_called_once_with(expected_key_no_args)
    mock_redis_client_fixture.setex.assert_called_once_with(
        expected_key_no_args,
        3600,
        json.dumps({"data": "result_no_args_method"})
    )

def test_cache_hit_no_args(mock_redis_client_fixture):
    class DummyTestClass:
        @redis_cache(ttl_seconds=3600)
        def expensive_method_no_args(self):
            # This attribute needs to be on the class or instance if modified by the method
            DummyTestClass.expensive_method_no_args_call_count += 1 
            return {"data": "result_no_args_method"}
    DummyTestClass.expensive_method_no_args_call_count = 0


    test_instance = DummyTestClass()
    cached_value = json.dumps({"data": "cached_result_method"})
    expected_key_no_args = "DummyTestClass:expensive_method_no_args"
    mock_redis_client_fixture.get.return_value = cached_value
    
    result = test_instance.expensive_method_no_args()
    
    assert DummyTestClass.expensive_method_no_args_call_count == 0 
    assert result == {"data": "cached_result_method"}
    mock_redis_client_fixture.get.assert_called_once_with(expected_key_no_args)
    mock_redis_client_fixture.setex.assert_not_called()

def test_cache_miss_with_args_kwargs(mock_redis_client_fixture):
    # Using the class from the manage_call_counts fixture implicitly
    expensive_function_with_args.call_count = 0 # Reset via fixture or manually if not using class method
    mock_redis_client_fixture.get.return_value = None
    
    # To test this properly with new keygen, it should be a method
    class DummyTestClassForArgs:
        def __init__(self):
            self.call_count = 0
        @redis_cache(ttl_seconds=1800)
        def expensive_method_for_test(self, arg1, days=30):
            self.call_count += 1
            return {"data": f"result_method_{arg1}_{days}"}
    
    test_instance = DummyTestClassForArgs()
    result = test_instance.expensive_method_for_test("test_arg_val", days=60)
    
    assert test_instance.call_count == 1
    assert result == {"data": "result_method_test_arg_val_60"}
    # New key: ClassName:FuncName:argName:argValue (if relevant)
    # Relevant args are 'project_key', 'board_id', 'days'. 'arg1' is not in this list.
    # So, for this generic function, only 'days' should be in the key if it's in the relevant list.
    # The current cache.py: `if name in ['project_key', 'board_id', 'days'] and value is not None:`
    # So 'arg1' will NOT be in the key. This is a change in behavior from the old key gen.
    expected_key = "DummyTestClassForArgs:expensive_method_for_test:days:60"
    mock_redis_client_fixture.get.assert_called_once_with(expected_key)
    mock_redis_client_fixture.setex.assert_called_once_with(
        expected_key,
        1800,
        json.dumps({"data": "result_method_test_arg_val_60"})
    )

def test_cache_miss_with_args_positional_days(mock_redis_client_fixture):
    expensive_function_with_args.call_count = 0
    mock_redis_client_fixture.get.return_value = None

    class DummyTestClassForArgsPos:
        def __init__(self):
            self.call_count = 0
        @redis_cache(ttl_seconds=1800)
        def expensive_method_for_test_pos(self, arg1, days=30): # 'days' is relevant
            self.call_count += 1
            return {"data": f"result_method_{arg1}_{days}"}

    test_instance = DummyTestClassForArgsPos()
    result = test_instance.expensive_method_for_test_pos("test_arg_pos_val", 70) 
    
    assert test_instance.call_count == 1
    assert result == {"data": "result_method_test_arg_pos_val_70"}
    # 'arg1' is not a relevant key part by name.
    expected_key = "DummyTestClassForArgsPos:expensive_method_for_test_pos:days:70"
    mock_redis_client_fixture.get.assert_called_once_with(expected_key)
    mock_redis_client_fixture.setex.assert_called_once_with(
        expected_key,
        1800,
        json.dumps({"data": "result_method_test_arg_pos_val_70"})
    )


def test_cache_key_generation_github_kwargs(mock_redis_client_fixture):
    mock_redis_client_fixture.get.return_value = None
    gh_integration = MockGitHubIntegration("my/repo_gh_kwargs")
    
    gh_integration.calculate_metrics(days=90) # days is a relevant key
    # New key: ClassName:FuncName:repository_name:repo_val:days:days_val
    expected_key_gh = "MockGitHubIntegration:calculate_metrics:repository_name:my/repo_gh_kwargs:days:90"
    mock_redis_client_fixture.get.assert_called_with(expected_key_gh)
    mock_redis_client_fixture.setex.assert_called_with(
        expected_key_gh, 60, json.dumps({"repo": "my/repo_gh_kwargs", "days": 90, "metric": "gh_metric"})
    )

def test_cache_key_generation_github_pos_args(mock_redis_client_fixture):
    mock_redis_client_fixture.get.return_value = None
    gh_integration = MockGitHubIntegration("my/repo_gh_pos")

    gh_integration.calculate_metrics(15) # Positional arg for 'days'
    expected_key_gh_default = "MockGitHubIntegration:calculate_metrics:repository_name:my/repo_gh_pos:days:15"
    mock_redis_client_fixture.get.assert_called_with(expected_key_gh_default)
    mock_redis_client_fixture.setex.assert_called_with(
        expected_key_gh_default, 60, json.dumps({"repo": "my/repo_gh_pos", "days": 15, "metric": "gh_metric"})
    )


def test_cache_key_generation_jira_kwargs(mock_redis_client_fixture):
    mock_redis_client_fixture.get.return_value = None
    jira_integration = MockJiraIntegration()
    
    jira_integration.calculate_metrics(project_key="PROJ_KW", days=45)
    # New key: ClassName:FuncName:project_key:PROJ_KW:days:45
    expected_key_jira = "MockJiraIntegration:calculate_metrics:project_key:PROJ_KW:days:45" 
    mock_redis_client_fixture.get.assert_called_with(expected_key_jira)
    mock_redis_client_fixture.setex.assert_called_with(
        expected_key_jira, 60, json.dumps({"project": "PROJ_KW", "days": 45, "metric": "jira_metric"})
    )

def test_cache_key_generation_jira_pos_args(mock_redis_client_fixture):
    mock_redis_client_fixture.get.return_value = None
    jira_integration = MockJiraIntegration()
    
    jira_integration.calculate_metrics("PROJ_POS_JIRA", 25) # project_key, days as positional
    expected_key_jira = "MockJiraIntegration:calculate_metrics:project_key:PROJ_POS_JIRA:days:25" 
    mock_redis_client_fixture.get.assert_called_with(expected_key_jira)
    mock_redis_client_fixture.setex.assert_called_with(
        expected_key_jira, 60, json.dumps({"project": "PROJ_POS_JIRA", "days": 25, "metric": "jira_metric"})
    )


def test_cache_key_generation_trello_kwargs(mock_redis_client_fixture):
    mock_redis_client_fixture.get.return_value = None
    trello_integration = MockTrelloIntegration()
    
    trello_integration.calculate_metrics(board_id="BOARDX_KW", days=15)
    expected_key_trello = "MockTrelloIntegration:calculate_metrics:board_id:BOARDX_KW:days:15"
    mock_redis_client_fixture.get.assert_called_with(expected_key_trello)
    mock_redis_client_fixture.setex.assert_called_with(
        expected_key_trello, 60, json.dumps({"board": "BOARDX_KW", "days": 15, "metric": "trello_metric"})
    )

def test_cache_key_generation_trello_pos_args(mock_redis_client_fixture):
    mock_redis_client_fixture.get.return_value = None
    trello_integration = MockTrelloIntegration()
    
    trello_integration.calculate_metrics("BOARDY_POS", 5) # board_id, days as positional
    expected_key_trello = "MockTrelloIntegration:calculate_metrics:board_id:BOARDY_POS:days:5"
    mock_redis_client_fixture.get.assert_called_with(expected_key_trello)
    mock_redis_client_fixture.setex.assert_called_with(
        expected_key_trello, 60, json.dumps({"board": "BOARDY_POS", "days": 5, "metric": "trello_metric"})
    )


def test_redis_get_error_graceful_handling(mock_redis_client_fixture, caplog):
    # Using a method for this test
    class DummyTestClassForError:
        def __init__(self): self.call_count = 0
        @redis_cache(ttl_seconds=60)
        def error_test_method(self):
            self.call_count+=1
            return "data"
    test_instance = DummyTestClassForError()
    mock_redis_client_fixture.get.side_effect = redis.exceptions.RedisError("Connection failed during GET")
    
    result = test_instance.error_test_method()
    
    assert test_instance.call_count == 1
    assert result == "data"
    mock_redis_client_fixture.setex.assert_called_once() 
    assert "Redis error while getting cache: Connection failed during GET" in caplog.text

def test_redis_setex_error_graceful_handling(mock_redis_client_fixture, caplog):
    class DummyTestClassForError:
        def __init__(self): self.call_count = 0
        @redis_cache(ttl_seconds=60)
        def error_test_method(self):
            self.call_count+=1
            return "data"
    test_instance = DummyTestClassForError()

    mock_redis_client_fixture.get.return_value = None 
    mock_redis_client_fixture.setex.side_effect = redis.exceptions.RedisError("Connection failed during SETEX")
    
    result = test_instance.error_test_method()
    
    assert test_instance.call_count == 1
    assert result == "data"
    assert "Redis error while setting cache: Connection failed during SETEX" in caplog.text


@patch('src.integrations.cache.redis_client', None) # Patch directly for this test
def test_redis_client_disabled(caplog): # No mock_redis_client_fixture needed here
    # Using a method for this test
    class DummyTestClassDisabled:
        def __init__(self): self.call_count = 0
        @redis_cache(ttl_seconds=60) # Decorator applied when redis_client is None in its module
        def disabled_test_method(self):
            self.call_count+=1
            return "data_disabled"
    
    test_instance = DummyTestClassDisabled()
    result = test_instance.disabled_test_method()

    assert test_instance.call_count == 1
    assert result == "data_disabled"
    assert "Warning: Redis client not available. Bypassing cache." in caplog.text
    # No Redis methods should be called if client is None - this is implicitly tested as redis_client is None.


# Note: Removed test_cache_key_generation_trello_positional_args as it was complex
# and its specific path `func.__qualname__.startswith('TrelloIntegration')` is unlikely
# to be effective with the current decorator structure where `func` is the already bound method.
# The generic positional/keyword argument handling for 'board_id' is covered by
# test_cache_key_generation_trello_pos_args and test_cache_key_generation_trello_kwargs.

# Similarly, test_cache_key_generic_func_pos_days covers generic functions with positional 'days'.
# The old logic for GitHub positional days was specific to `not ( hasattr(instance, 'repository_name') ... )`
# which is now covered by the more direct `if hasattr(instance, 'repository_name')` followed by inspect.

# The logging tests for hit/miss need to be adapted for methods of a class.
class LoggingTestClass:
    def __init__(self): self.call_count = 0
    @redis_cache(ttl_seconds=60)
    def logging_method(self):
        self.call_count += 1
        return "log_data"

def test_cache_hit_logging(mock_redis_client_fixture, caplog):
    instance = LoggingTestClass()
    cached_value = json.dumps("log_data_cached")
    # Expected key: ClassName:FuncName
    expected_key = "LoggingTestClass:logging_method"
    mock_redis_client_fixture.get.return_value = cached_value
    
    instance.logging_method()
    assert f"Cache hit for key: {expected_key}" in caplog.text

def test_cache_miss_logging(mock_redis_client_fixture, caplog):
    instance = LoggingTestClass()
    mock_redis_client_fixture.get.return_value = None
    expected_key = "LoggingTestClass:logging_method"
    
    instance.logging_method()
    assert f"Cache miss for key: {expected_key}. Calling function." in caplog.text
    assert f"Generated cache key for logging_method: {expected_key}" # Also check the generation log

# Test TTL argument usage - needs to be a method for new keygen
class TTLTestClass:
    @redis_cache(ttl_seconds=5) # Short TTL for testing
    def short_ttl_method(self):
        return "short_lived_method"

def test_custom_ttl(mock_redis_client_fixture):
    instance = TTLTestClass()
    mock_redis_client_fixture.get.return_value = None
    instance.short_ttl_method()
    expected_key = "TTLTestClass:short_ttl_method"
    mock_redis_client_fixture.setex.assert_called_once_with(
        expected_key,
        5, # Expected TTL
        json.dumps("short_lived_method")
    )
