#!/usr/bin/env python3
"""
Test script for ECE Memory Management System
Run this after starting the system to verify all endpoints work
"""

import requests
import json
import sys
from datetime import datetime

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_health():
    """Test the health endpoint"""
    print("\n1. Testing Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/memory/health")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ System Status: {data.get('status', 'unknown')}")
            print(f"   - Neo4j: {'Connected' if data.get('neo4j') else 'Not connected'}")
            print(f"   - Redis: {'Connected' if data.get('redis') else 'Not connected'}")
            print(f"   - GPU: {'Available' if data.get('gpu') else 'Not available'}")
            return True
        else:
            print(f"   ✗ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ✗ Could not connect to API. Is the server running?")
        return False

def test_store_memory():
    """Test storing a memory"""
    print("\n2. Testing Memory Storage...")
    
    test_memory = {
        "raw_text": f"This is a test memory stored at {datetime.now()}. The ECE Memory Management System uses Q-Learning for optimal path finding.",
        "source": "test_script",
        "metadata": {
            "test": True,
            "timestamp": datetime.now().isoformat()
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/memory/store",
            json=test_memory,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Memory stored successfully")
            print(f"   - Concepts extracted: {data.get('concepts_extracted', 0)}")
            print(f"   - Node IDs: {data.get('node_ids', [])[:3]}...")
            return True
        else:
            print(f"   ✗ Storage failed: {response.status_code}")
            print(f"   - Error: {response.text}")
            return False
    except Exception as e:
        print(f"   ✗ Error storing memory: {e}")
        return False

def test_query_memory():
    """Test querying memories"""
    print("\n3. Testing Memory Query...")
    
    query_data = {
        "query": "What do you know about Q-Learning and path finding?",
        "max_results": 5,
        "max_hops": 3
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/memory/query",
            json=query_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Query executed successfully")
            if data.get('context'):
                context = data['context']
                print(f"   - Relevance score: {context.get('relevance_score', 0):.2f}")
                print(f"   - Token count: {context.get('token_count', 0)}")
                print(f"   - Processing time: {context.get('processing_time_ms', 0):.2f}ms")
                
                # Show a snippet of the summary
                summary = context.get('summary', '')
                if summary:
                    print(f"   - Summary preview: {summary[:100]}...")
            return True
        else:
            print(f"   ✗ Query failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ✗ Error querying memory: {e}")
        return False

def test_stats():
    """Test the statistics endpoint"""
    print("\n4. Testing Statistics...")
    
    try:
        response = requests.get(f"{BASE_URL}/memory/stats")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Statistics retrieved")
            print(f"   - Total nodes: {data.get('total_nodes', 0)}")
            print(f"   - Total relationships: {data.get('total_relationships', 0)}")
            print(f"   - Cache hit rate: {data.get('cache_hit_rate', 0):.1f}%")
            return True
        else:
            print(f"   ✗ Stats failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ✗ Error getting stats: {e}")
        return False

def test_legacy_chat():
    """Test the legacy /chat endpoint"""
    print("\n5. Testing Legacy Chat Endpoint...")
    
    chat_data = {
        "prompt": "Remember this: The system is working correctly."
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/chat",
            json=chat_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Legacy chat endpoint working")
            response_text = data.get('response', '')
            if response_text:
                print(f"   - Response preview: {response_text[:100]}...")
            return True
        else:
            print(f"   ✗ Chat failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ✗ Error with chat: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("ECE Memory Management System - Test Suite")
    print("=" * 60)
    
    # Check if server is running
    print("\nChecking server connection...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✓ Server is running at {BASE_URL}")
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to server at {BASE_URL}")
        print("\nPlease start the server first:")
        print("  ./start_memory_system.sh")
        sys.exit(1)
    
    # Run tests
    results = []
    results.append(("Health Check", test_health()))
    results.append(("Store Memory", test_store_memory()))
    results.append(("Query Memory", test_query_memory()))
    results.append(("Statistics", test_stats()))
    results.append(("Legacy Chat", test_legacy_chat()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary:")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! The Memory Management System is working correctly.")
    else:
        print(f"\n⚠ {total - passed} test(s) failed. Please check the logs.")
    
    print("\n" + "=" * 60)
    print("Next Steps:")
    print("=" * 60)
    print("1. Access the API documentation: http://localhost:8000/docs")
    print("2. View Neo4j Browser: http://localhost:7474")
    print("3. Monitor logs: docker-compose logs -f")
    print("4. Store some memories using the /memory/store endpoint")
    print("5. Query memories using the /memory/query endpoint")

if __name__ == "__main__":
    main()
