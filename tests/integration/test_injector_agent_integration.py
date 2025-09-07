"""
Integration tests for the InjectorAgent with real memory systems.
"""
import pytest
import requests
import time
import json
from typing import Dict, Any


# Base URL for the API
BASE_URL = "http://localhost:8001"


class TestInjectorAgentIntegration:
    """Test suite for InjectorAgent integration tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup method to ensure the service is running before tests"""
        # Wait a bit for the service to start
        time.sleep(2)
        
        # Check if service is running
        try:
            response = requests.get(f"{BASE_URL}/health")
            assert response.status_code == 200
            assert response.json()["status"] == "healthy"
        except requests.exceptions.ConnectionError:
            pytest.fail("Could not connect to the ECE service. Make sure it's running.")
    
    def test_successful_context_injection_endpoint(self):
        """Test successful context injection via dedicated endpoint"""
        payload = {
            "prompt": "What are the applications of machine learning in healthcare?"
        }
        
        response = requests.post(f"{BASE_URL}/inject/context", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "original_prompt" in data
        assert "augmented_prompt" in data
        assert data["original_prompt"] == payload["prompt"]
    
    def test_chat_interface_with_injection_intent(self):
        """Test context injection through chat interface"""
        # First, store some context in cache
        cache_payload = {
            "key": "ml_healthcare",
            "value": "Machine learning has numerous applications in healthcare including diagnosis, drug discovery, and personalized treatment.",
            "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]
        }
        
        cache_response = requests.post(f"{BASE_URL}/cache/store", json=cache_payload)
        assert cache_response.status_code == 200
        
        # Now test injection through chat
        chat_payload = {
            "message": "Inject context about machine learning in healthcare",
            "context": {}
        }
        
        response = requests.post(f"{BASE_URL}/chat", json=chat_payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert "agent_used" in data
        assert data["agent_used"] == "InjectorAgent"
        
        # Verify successful injection
        response_text = data["response"]
        assert "successfully injected" in response_text.lower() or "confidence score" in response_text.lower()
    
    def test_injection_with_no_context_available(self):
        """Test injection when no relevant context is available"""
        payload = {
            "prompt": "What is the capital of Mars?",
            "context": {}
        }
        
        response = requests.post(f"{BASE_URL}/chat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        # Should still use InjectorAgent but with low confidence
        assert data["agent_used"] == "InjectorAgent"
    
    def test_direct_injection_endpoint_with_complex_prompt(self):
        """Test the direct injection endpoint with a complex prompt"""
        payload = {
            "prompt": "Explain the relationship between artificial intelligence, machine learning, and deep learning with examples."
        }
        
        response = requests.post(f"{BASE_URL}/inject/context", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["original_prompt"] == payload["prompt"]
        # Should return the augmented prompt even if no context was found
        assert "augmented_prompt" in data
    
    def test_injection_preserves_original_prompt(self):
        """Test that the original prompt is preserved in the response"""
        original_prompt = "How does natural language processing work?"
        payload = {
            "prompt": original_prompt
        }
        
        response = requests.post(f"{BASE_URL}/inject/context", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["original_prompt"] == original_prompt


if __name__ == "__main__":
    pytest.main([__file__])