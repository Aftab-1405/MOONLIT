# test_integration_config.py
import pytest
from dotenv import load_dotenv
from config import Config

load_dotenv()

@pytest.mark.integration
def test_integration_firebase_project_consistency():
    # We do NOT use mocks. We test the actual environment settings.
    try:
        # Verify project IDs are defined and consistent in the actual environment
        is_consistent = Config.validate_firebase_project_consistency()
        assert is_consistent is True, "Firebase project configuration in the environment is inconsistent or missing"
    except Exception as e:
        pytest.fail(f"Firebase project consistency check failed: {e}")
