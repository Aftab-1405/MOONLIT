# test_integration_firestore_service.py
import pytest
import firebase_admin
from dotenv import load_dotenv
from services.firestore_service import FirestoreService

load_dotenv()

@pytest.mark.usefixtures("restore_real_env")
@pytest.mark.integration
def test_integration_firestore_initialize():
    # We do NOT use mocks. We call the real initialize method.
    try:
        FirestoreService.initialize()
        
        # Verify that firebase_admin._apps is populated
        assert len(firebase_admin._apps) > 0
        
        # Verify that get_db returns a valid client and we can access collections
        db = FirestoreService.get_db()
        assert db is not None
        
        # Let's do a simple read/write check to make sure the connection is fully operational
        test_ref = db.collection("integration_test_init").document("status")
        test_ref.set({"initialized": True})
        
        doc = test_ref.get()
        assert doc.exists
        assert doc.to_dict()["initialized"] is True
        
        # Cleanup
        test_ref.delete()
        
    except Exception as e:
        pytest.fail(f"Real Firestore initialization failed: {e}")
