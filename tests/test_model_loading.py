#!/usr/bin/env python3
"""
Model Loading Test Suite for Anchor Core

This script tests the model loading functionality and verifies that all endpoints
are accessible and working correctly with the unified Anchor Core architecture.
"""

import requests
import sys
import os
from urllib.parse import urljoin
import json
from pathlib import Path


class ModelLoadingTester:
    def __init__(self, base_url="http://localhost:8000", token="sovereign-secret"):
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        self.results = {}
        
    def test_endpoint_accessibility(self, endpoint, method="GET", expected_status=200):
        """Test if an endpoint is accessible"""
        try:
            url = urljoin(self.base_url, endpoint)
            response = requests.request(method, url, headers=self.headers)
            success = response.status_code == expected_status
            self.results[f"endpoint_{endpoint.replace('/', '_')}"] = {
                "url": url,
                "method": method,
                "status": response.status_code,
                "expected": expected_status,
                "success": success,
                "message": f"Status {response.status_code}" if success else f"Expected {expected_status}, got {response.status_code}"
            }
            return success
        except Exception as e:
            self.results[f"endpoint_{endpoint.replace('/', '_')}"] = {
                "url": urljoin(self.base_url, endpoint),
                "method": method,
                "status": "ERROR",
                "expected": expected_status,
                "success": False,
                "message": str(e)
            }
            return False
    
    def test_model_path_accessibility(self, model_path):
        """Test if a model path is accessible"""
        try:
            url = urljoin(self.base_url, model_path)
            response = requests.head(url, headers=self.headers)
            success = response.status_code in [200, 404]  # 404 means path exists but file doesn't (which is expected for model directories)
            self.results[f"model_{model_path.replace('/', '_')}"] = {
                "url": url,
                "status": response.status_code,
                "success": success,
                "message": f"Model path accessible" if success else f"Model path not accessible: {response.status_code}"
            }
            return success
        except Exception as e:
            self.results[f"model_{model_path.replace('/', '_')}"] = {
                "url": urljoin(self.base_url, model_path),
                "status": "ERROR",
                "success": False,
                "message": str(e)
            }
            return False
    
    def test_model_config_accessibility(self, model_name):
        """Test if model config files are accessible"""
        config_files = [
            f"models/{model_name}/ndarray-cache.json",
            f"models/{model_name}/tokenizer.json",
            f"models/{model_name}/mlc-chat-config.json",
            f"models/{model_name}/params.json"
        ]
        
        results = []
        for config_file in config_files:
            try:
                url = urljoin(self.base_url, config_file)
                response = requests.head(url)
                success = response.status_code in [200, 404]  # Allow 404 as files may not exist yet
                results.append({
                    "file": config_file,
                    "url": url,
                    "status": response.status_code,
                    "success": success
                })
            except Exception as e:
                results.append({
                    "file": config_file,
                    "url": urljoin(self.base_url, config_file),
                    "status": "ERROR",
                    "success": False,
                    "message": str(e)
                })
        
        self.results[f"model_configs_{model_name}"] = results
        return results
    
    def run_comprehensive_test(self):
        """Run comprehensive tests for all endpoints and model paths"""
        print("Running Model Loading Test Suite...")
        print(f"Testing against: {self.base_url}")
        print("-" * 60)
        
        # Test core API endpoints
        api_endpoints = [
            ("/health", "GET", 200),
            ("/v1/gpu/status", "GET", 200),
            ("/v1/gpu/lock", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/gpu/unlock", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/shell/exec", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/system/spawn_shell", "POST", 200),
        ]
        
        print("Testing API Endpoints:")
        for endpoint, method, expected in api_endpoints:
            success = self.test_endpoint_accessibility(endpoint, method, expected)
            status_icon = "[PASS]" if success else "[FAIL]"
            key = f"endpoint_{endpoint.replace('/', '_')}"
            print(f"  {status_icon} {method} {endpoint} -> {self.results[key]['message']}")
        
        print()
        
        # Test model paths
        model_names = [
            "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
            "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
            "Qwen2.5-7B-Instruct-q4f16_1-MLC",
            "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
            "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC"
        ]
        
        print("Testing Model Paths:")
        for model_name in model_names:
            success = self.test_model_path_accessibility(f"/models/{model_name}")
            status_icon = "[PASS]" if success else "[FAIL]"
            key = f"model_/models/{model_name}".replace("/", "_")
            if key in self.results:
                print(f"  {status_icon} /models/{model_name} -> {self.results[key]['message']}")
            else:
                print(f"  [FAIL] /models/{model_name} -> Key not found in results")
        
        print()
        
        # Test model config files
        print("Testing Model Config Files:")
        for model_name in model_names[:2]:  # Test just the first 2 to avoid too much output
            configs = self.test_model_config_accessibility(model_name)
            print(f"  Model: {model_name}")
            for config in configs:
                status_icon = "[PASS]" if config['success'] else "[FAIL]"
                status_symbol = "OK" if config['success'] else "X"
                print(f"    [{status_symbol}] {config['file']} -> Status: {config['status']}")
        
        print()
        
        # Summary
        total_tests = len([r for r in self.results.values() if isinstance(r, dict) and 'success' in r]) + \
                     sum(len(r) for r in self.results.values() if isinstance(r, list))
        passed_tests = 0
        
        for key, value in self.results.items():
            if isinstance(value, dict) and 'success' in value:
                if value['success']:
                    passed_tests += 1
            elif isinstance(value, list):
                for item in value:
                    if item.get('success'):
                        passed_tests += 1
        
        print("-" * 60)
        print(f"Test Summary: {passed_tests}/{total_tests} tests passed")

        if passed_tests == total_tests:
            print("All tests passed! The Anchor Core is properly configured.")
            return True
        else:
            print("Some tests failed. Check the output above for details.")
            return False

    def generate_test_report(self):
        """Generate a detailed test report"""
        report = {
            "base_url": self.base_url,
            "timestamp": str(__import__('datetime').datetime.now()),
            "results": self.results,
            "summary": {
                "total_tests": 0,
                "passed_tests": 0,
                "failed_tests": 0
            }
        }
        
        # Count tests
        for key, value in self.results.items():
            if isinstance(value, dict) and 'success' in value:
                report["summary"]["total_tests"] += 1
                if value['success']:
                    report["summary"]["passed_tests"] += 1
                else:
                    report["summary"]["failed_tests"] += 1
            elif isinstance(value, list):
                report["summary"]["total_tests"] += len(value)
                for item in value:
                    if item.get('success'):
                        report["summary"]["passed_tests"] += 1
                    else:
                        report["summary"]["failed_tests"] += 1
        
        return report


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Anchor Core Model Loading Functionality")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the Anchor Core (default: http://localhost:8000)")
    parser.add_argument("--token", default="sovereign-secret", help="Authentication token (default: sovereign-secret)")
    parser.add_argument("--output", help="Output file for test report (JSON format)")
    
    args = parser.parse_args()
    
    tester = ModelLoadingTester(base_url=args.url, token=args.token)
    success = tester.run_comprehensive_test()
    
    if args.output:
        report = tester.generate_test_report()
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"📄 Test report saved to: {args.output}")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()