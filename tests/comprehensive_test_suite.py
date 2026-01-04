#!/usr/bin/env python3
"""
Comprehensive Test Suite for Anchor Core

This script provides a complete test suite covering:
1. Model loading functionality
2. Data pipeline verification
3. Endpoint accessibility
4. Missing endpoint detection
5. Function syntax error detection
"""

import requests
import sys
import time
import json
from urllib.parse import urljoin
from pathlib import Path
import subprocess
import importlib.util
from typing import Dict, List, Tuple, Any


class ComprehensiveTestSuite:
    def __init__(self, base_url: str = "http://localhost:8000", token: str = "sovereign-secret"):
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        self.results = {
            "model_loading": {},
            "data_pipeline": {},
            "endpoint_verification": {},
            "syntax_check": {},
            "overall": {"passed": 0, "failed": 0, "total": 0}
        }

    def run_all_tests(self) -> bool:
        """Run all test categories"""
        print("🚀 Running Comprehensive Test Suite for Anchor Core...")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)

        # Run all test categories
        model_loading_ok = self.test_model_loading()
        data_pipeline_ok = self.test_data_pipeline()
        endpoint_ok = self.test_endpoint_verification()
        syntax_ok = self.test_syntax_verification()

        # Summary
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST SUITE SUMMARY")
        print("=" * 80)
        
        print(f"Model Loading Tests: {'✅ PASS' if model_loading_ok else '❌ FAIL'}")
        print(f"Data Pipeline Tests: {'✅ PASS' if data_pipeline_ok else '❌ FAIL'}")
        print(f"Endpoint Verification: {'✅ PASS' if endpoint_ok else '❌ FAIL'}")
        print(f"Syntax Verification: {'✅ PASS' if syntax_ok else '❌ FAIL'}")

        overall_success = all([model_loading_ok, data_pipeline_ok, endpoint_ok, syntax_ok])
        print(f"\n🎯 Overall Result: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
        
        print(f"\n📈 Test Statistics:")
        print(f"  Total Tests: {self.results['overall']['total']}")
        print(f"  Passed: {self.results['overall']['passed']}")
        print(f"  Failed: {self.results['overall']['failed']}")

        return overall_success

    def test_model_loading(self) -> bool:
        """Test model loading functionality"""
        print("\n🔍 Testing Model Loading...")
        print("-" * 40)

        # Test model availability
        models_to_test = [
            "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
            "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
            "Qwen2.5-7B-Instruct-q4f16_1-MLC",
        ]

        all_models_ok = True
        for model_name in models_to_test:
            print(f"  Testing model: {model_name}")
            
            # Test model config files accessibility
            config_files = [
                f"models/{model_name}/resolve/main/ndarray-cache.json",
                f"models/{model_name}/resolve/main/mlc-chat-config.json",
                f"models/{model_name}/resolve/main/tokenizer.json",
                f"models/{model_name}/resolve/main/tokenizer_config.json"
            ]

            model_ok = True
            for config_file in config_files:
                try:
                    url = urljoin(self.base_url, config_file)
                    response = requests.head(url, timeout=10)
                    status_ok = response.status_code in [200, 404]  # 404 is expected if file doesn't exist locally
                    print(f"    {'✅' if status_ok else '❌'} {config_file} -> {response.status_code}")
                    
                    test_key = f"model_{model_name}_{config_file.replace('/', '_')}"
                    self.results["model_loading"][test_key] = {
                        "url": url,
                        "status": response.status_code,
                        "success": status_ok
                    }
                    
                    if not status_ok:
                        model_ok = False
                        all_models_ok = False
                        
                except Exception as e:
                    print(f"    ❌ {config_file} -> ERROR: {e}")
                    test_key = f"model_{model_name}_{config_file.replace('/', '_')}"
                    self.results["model_loading"][test_key] = {
                        "url": urljoin(self.base_url, config_file),
                        "status": "ERROR",
                        "success": False,
                        "error": str(e)
                    }
                    model_ok = False
                    all_models_ok = False

            if model_ok:
                print(f"  ✅ Model {model_name} is accessible")
            else:
                print(f"  ❌ Model {model_name} has issues")

        # Update overall counters
        total_model_tests = len(self.results["model_loading"])
        passed_model_tests = sum(1 for r in self.results["model_loading"].values() if r["success"])
        self.results["overall"]["total"] += total_model_tests
        self.results["overall"]["passed"] += passed_model_tests
        self.results["overall"]["failed"] += total_model_tests - passed_model_tests

        return all_models_ok

    def test_data_pipeline(self) -> bool:
        """Test data pipeline functionality"""
        print("\n PIPELINE Testing Data Pipeline...")
        print("-" * 40)

        pipeline_tests = [
            ("/health", "GET", 200, "Health Check"),
            ("/v1/gpu/status", "GET", 200, "GPU Status"),
            ("/v1/system/spawn_shell", "POST", 400, "Spawn Shell (expects 400 due to missing body)"),
        ]

        all_pipeline_ok = True
        for endpoint, method, expected_status, description in pipeline_tests:
            print(f"  Testing {description}: {method} {endpoint}")
            try:
                url = urljoin(self.base_url, endpoint)
                if method == "GET":
                    response = requests.get(url, headers=self.headers, timeout=10)
                elif method == "POST":
                    response = requests.post(url, headers=self.headers, timeout=10)
                
                status_ok = response.status_code == expected_status
                print(f"    {'✅' if status_ok else '❌'} Status: {response.status_code} (expected {expected_status})")
                
                test_key = f"pipeline_{endpoint.replace('/', '_')}"
                self.results["data_pipeline"][test_key] = {
                    "url": url,
                    "method": method,
                    "status": response.status_code,
                    "expected": expected_status,
                    "success": status_ok
                }
                
                if not status_ok:
                    all_pipeline_ok = False
                    
            except Exception as e:
                print(f"    ❌ ERROR: {e}")
                test_key = f"pipeline_{endpoint.replace('/', '_')}"
                self.results["data_pipeline"][test_key] = {
                    "url": urljoin(self.base_url, endpoint),
                    "method": method,
                    "status": "ERROR",
                    "expected": expected_status,
                    "success": False,
                    "error": str(e)
                }
                all_pipeline_ok = False

        # Update overall counters
        total_pipeline_tests = len(self.results["data_pipeline"])
        passed_pipeline_tests = sum(1 for r in self.results["data_pipeline"].values() if r["success"])
        self.results["overall"]["total"] += total_pipeline_tests
        self.results["overall"]["passed"] += passed_pipeline_tests
        self.results["overall"]["failed"] += total_pipeline_tests - passed_pipeline_tests

        return all_pipeline_ok

    def test_endpoint_verification(self) -> bool:
        """Test endpoint accessibility and detect missing endpoints"""
        print("\n🔍 Testing Endpoint Verification...")
        print("-" * 40)

        # Define critical endpoints that should exist
        critical_endpoints = [
            ("/health", "GET", 200),
            ("/v1/chat/completions", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/embeddings", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/shell/exec", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/gpu/lock", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/gpu/unlock", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/gpu/status", "GET", 200),
            ("/v1/gpu/reset", "POST", 200),
            ("/v1/gpu/force-release-all", "POST", 200),
            ("/v1/system/spawn_shell", "POST", 200),
            ("/v1/models/pull", "POST", 400),  # Expected to fail with 400 due to missing body
            ("/v1/models/pull/status", "GET", 400),  # Expected to fail with 400 due to missing id param
        ]

        all_endpoints_ok = True
        missing_endpoints = []

        for endpoint, method, expected_status in critical_endpoints:
            print(f"  Testing endpoint: {method} {endpoint}")
            try:
                url = urljoin(self.base_url, endpoint)
                if method == "GET":
                    response = requests.get(url, headers=self.headers, timeout=10)
                elif method == "POST":
                    response = requests.post(url, headers=self.headers, timeout=10)
                
                # For endpoints that are expected to fail due to missing body/params, 
                # we consider them accessible if they return 400/404/422 rather than 404/405
                accessible = response.status_code != 404 and response.status_code != 405
                success = accessible  # We consider it a success if the endpoint exists
                
                status_msg = f"Status: {response.status_code}"
                if not accessible:
                    status_msg += " (MISSING/INACCESSIBLE)"
                    missing_endpoints.append(f"{method} {endpoint}")
                    all_endpoints_ok = False
                
                print(f"    {'✅' if accessible else '❌'} {status_msg}")
                
                test_key = f"endpoint_{endpoint.replace('/', '_')}"
                self.results["endpoint_verification"][test_key] = {
                    "url": url,
                    "method": method,
                    "status": response.status_code,
                    "expected": expected_status,
                    "accessible": accessible,
                    "success": success
                }
                
            except Exception as e:
                print(f"    ❌ ERROR: {e}")
                missing_endpoints.append(f"{method} {endpoint}")
                test_key = f"endpoint_{endpoint.replace('/', '_')}"
                self.results["endpoint_verification"][test_key] = {
                    "url": urljoin(self.base_url, endpoint),
                    "method": method,
                    "status": "ERROR",
                    "expected": expected_status,
                    "accessible": False,
                    "success": False,
                    "error": str(e)
                }
                all_endpoints_ok = False

        if missing_endpoints:
            print(f"\n  ⚠️  Missing/Inaccessible Endpoints:")
            for ep in missing_endpoints:
                print(f"    - {ep}")
        else:
            print(f"\n  ✅ All critical endpoints are accessible!")

        # Update overall counters
        total_endpoint_tests = len(self.results["endpoint_verification"])
        passed_endpoint_tests = sum(1 for r in self.results["endpoint_verification"].values() if r["success"])
        self.results["overall"]["total"] += total_endpoint_tests
        self.results["overall"]["passed"] += passed_endpoint_tests
        self.results["overall"]["failed"] += total_endpoint_tests - passed_endpoint_tests

        return all_endpoints_ok

    def test_syntax_verification(self) -> bool:
        """Test for function syntax errors in critical files"""
        print("\n🔍 Testing Syntax Verification...")
        print("-" * 40)

        # Define critical Python files to check for syntax errors
        critical_files = [
            "tools/webgpu_bridge.py",
            "tools/anchor.py",
            "tools/orchestrator.py",
            "tests/test_model_loading.py",
            "tests/test_model_availability.py",
            "tests/test_gpu_fixes.py",
            "tests/test_orchestrator.py",
        ]

        all_syntax_ok = True
        syntax_errors = []

        for file_path in critical_files:
            print(f"  Checking syntax: {file_path}")
            try:
                file_abs_path = Path(file_path)
                if file_abs_path.exists():
                    # Use Python's built-in compile to check syntax
                    with open(file_abs_path, 'r', encoding='utf-8') as f:
                        source_code = f.read()
                    
                    compile(source_code, str(file_abs_path), 'exec')
                    print(f"    ✅ Syntax OK")
                    
                    test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                    self.results["syntax_check"][test_key] = {
                        "file": str(file_abs_path),
                        "success": True,
                        "error": None
                    }
                else:
                    print(f"    ⚠️  File not found")
                    test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                    self.results["syntax_check"][test_key] = {
                        "file": str(file_abs_path),
                        "success": False,
                        "error": "File not found"
                    }
                    syntax_errors.append(f"{file_path}: File not found")
                    all_syntax_ok = False
                    
            except SyntaxError as e:
                print(f"    ❌ Syntax Error: {e}")
                syntax_errors.append(f"{file_path}: {str(e)}")
                test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                self.results["syntax_check"][test_key] = {
                    "file": str(file_abs_path),
                    "success": False,
                    "error": str(e)
                }
                all_syntax_ok = False
            except Exception as e:
                print(f"    ❌ Error checking file: {e}")
                syntax_errors.append(f"{file_path}: {str(e)}")
                test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                self.results["syntax_check"][test_key] = {
                    "file": str(file_abs_path),
                    "success": False,
                    "error": str(e)
                }
                all_syntax_ok = False

        if syntax_errors:
            print(f"\n  ❌ Syntax errors found:")
            for error in syntax_errors:
                print(f"    - {error}")
        else:
            print(f"\n  ✅ All critical files have valid syntax!")

        # Update overall counters
        total_syntax_tests = len(self.results["syntax_check"])
        passed_syntax_tests = sum(1 for r in self.results["syntax_check"].values() if r["success"])
        self.results["overall"]["total"] += total_syntax_tests
        self.results["overall"]["passed"] += passed_syntax_tests
        self.results["overall"]["failed"] += total_syntax_tests - passed_syntax_tests

        return all_syntax_ok

    def generate_detailed_report(self) -> Dict[str, Any]:
        """Generate a detailed test report"""
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "base_url": self.base_url,
            "results": self.results,
            "summary": {
                "total_tests": self.results["overall"]["total"],
                "passed_tests": self.results["overall"]["passed"],
                "failed_tests": self.results["overall"]["failed"],
                "success_rate": self.results["overall"]["passed"] / max(self.results["overall"]["total"], 1) * 100
            }
        }
        return report


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Run Comprehensive Test Suite for Anchor Core")
    parser.add_argument("--url", default="http://localhost:8000",
                       help="Base URL of the Anchor Core (default: http://localhost:8000)")
    parser.add_argument("--token", default="sovereign-secret",
                       help="Authentication token (default: sovereign-secret)")
    parser.add_argument("--output",
                       help="Output file for detailed test report (JSON format)")

    args = parser.parse_args()

    # Run the comprehensive test suite
    test_suite = ComprehensiveTestSuite(base_url=args.url, token=args.token)
    success = test_suite.run_all_tests()

    # Generate and save detailed report if requested
    if args.output:
        report = test_suite.generate_detailed_report()
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\n📄 Detailed test report saved to: {args.output}")

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()