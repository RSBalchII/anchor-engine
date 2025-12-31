#!/usr/bin/env python3
"""
Endpoint and Syntax Verification Tests for Anchor Core

This script specifically tests for:
1. Missing endpoints
2. Function syntax errors
3. API endpoint accessibility
4. System health verification
"""

import requests
import sys
import json
import subprocess
import ast
from urllib.parse import urljoin
from pathlib import Path
from typing import Dict, List, Tuple


class EndpointAndSyntaxTester:
    def __init__(self, base_url: str = "http://localhost:8000", token: str = "sovereign-secret"):
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        self.results = {
            "endpoints": {},
            "syntax": {},
            "system_health": {}
        }

    def test_all_endpoints(self) -> Dict[str, bool]:
        """Test all defined endpoints for accessibility"""
        print("🔍 Testing All Endpoints for Accessibility...")
        print("-" * 50)

        # Define all expected endpoints with their methods and expected status codes
        endpoints = [
            # Core endpoints
            ("/", "GET", [200, 404]),  # Root may serve UI or return 404
            ("/health", "GET", [200]),
            
            # API endpoints
            ("/v1/chat/completions", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            ("/v1/embeddings", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            ("/v1/shell/exec", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            
            # GPU management endpoints
            ("/v1/gpu/lock", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            ("/v1/gpu/unlock", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            ("/v1/gpu/status", "GET", [200]),
            ("/v1/gpu/reset", "POST", [200, 401]),
            ("/v1/gpu/force-release-all", "POST", [200, 401]),
            
            # System endpoints
            ("/v1/system/spawn_shell", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            
            # Model endpoints
            ("/v1/models/pull", "POST", [400, 401, 422]),  # Expected to fail with 400 due to missing body
            ("/v1/models/pull/status", "GET", [400, 401, 404]),  # Expected to fail with 400 due to missing id param
            
            # Model file endpoints (these should return 404 if files don't exist locally, but endpoint should be accessible)
            ("/models/test-model/resolve/main/ndarray-cache.json", "GET", [200, 404]),
            ("/models/test-model/resolve/main/mlc-chat-config.json", "GET", [200, 404]),
            ("/models/test-model/resolve/main/tokenizer.json", "GET", [200, 404]),
        ]

        missing_endpoints = []
        accessible_endpoints = []

        for endpoint, method, expected_statuses in endpoints:
            print(f"  Testing: {method} {endpoint}")
            
            try:
                url = urljoin(self.base_url, endpoint)
                
                if method == "GET":
                    response = requests.get(url, headers=self.headers, timeout=10)
                elif method == "POST":
                    # Send minimal payload to avoid 400 errors due to missing body
                    if endpoint in ["/v1/chat/completions", "/v1/embeddings", "/v1/shell/exec"]:
                        response = requests.post(url, headers=self.headers, timeout=10, json={})
                    else:
                        response = requests.post(url, headers=self.headers, timeout=10)
                else:
                    response = requests.request(method, url, headers=self.headers, timeout=10)
                
                status_ok = response.status_code in expected_statuses
                accessible = response.status_code != 404 and response.status_code != 405  # 404 = not found, 405 = method not allowed
                
                status_icon = "✅" if status_ok else "❌"
                print(f"    {status_icon} Status: {response.status_code} (expected: {expected_statuses})")
                
                test_key = f"endpoint_{endpoint.replace('/', '_').replace('-', '_')}"
                self.results["endpoints"][test_key] = {
                    "url": url,
                    "method": method,
                    "status": response.status_code,
                    "expected": expected_statuses,
                    "accessible": accessible,
                    "status_ok": status_ok,
                    "success": accessible  # Endpoint exists if not 404/405
                }
                
                if accessible:
                    accessible_endpoints.append(f"{method} {endpoint}")
                else:
                    missing_endpoints.append(f"{method} {endpoint}")
                    
            except requests.exceptions.ConnectionError:
                print(f"    ❌ Connection Error - Server may not be running")
                test_key = f"endpoint_{endpoint.replace('/', '_').replace('-', '_')}"
                self.results["endpoints"][test_key] = {
                    "url": url,
                    "method": method,
                    "status": "CONNECTION_ERROR",
                    "expected": expected_statuses,
                    "accessible": False,
                    "status_ok": False,
                    "success": False
                }
                missing_endpoints.append(f"{method} {endpoint}")
            except Exception as e:
                print(f"    ❌ Error: {e}")
                test_key = f"endpoint_{endpoint.replace('/', '_').replace('-', '_')}"
                self.results["endpoints"][test_key] = {
                    "url": urljoin(self.base_url, endpoint),
                    "method": method,
                    "status": "ERROR",
                    "expected": expected_statuses,
                    "accessible": False,
                    "status_ok": False,
                    "success": False,
                    "error": str(e)
                }
                missing_endpoints.append(f"{method} {endpoint}")

        print(f"\n  Summary:")
        print(f"    ✅ Accessible Endpoints: {len(accessible_endpoints)}")
        print(f"    ❌ Missing/Inaccessible: {len(missing_endpoints)}")
        
        if missing_endpoints:
            print(f"\n  Missing Endpoints:")
            for ep in missing_endpoints:
                print(f"    - {ep}")
        
        endpoint_success = len(missing_endpoints) == 0
        return {"success": endpoint_success, "missing": missing_endpoints, "accessible": accessible_endpoints}

    def test_syntax_in_files(self) -> Dict[str, bool]:
        """Test syntax in critical Python files"""
        print("\n🔍 Testing Syntax in Critical Files...")
        print("-" * 50)

        # Define critical files to check for syntax errors
        critical_files = [
            "tools/webgpu_bridge.py",
            "tools/anchor.py", 
            "tools/orchestrator.py",
            "tests/comprehensive_test_suite.py",
            "tests/test_model_loading.py",
            "tests/test_model_availability.py",
            "tests/test_gpu_fixes.py",
            "tests/test_orchestrator.py",
        ]

        syntax_errors = []
        valid_files = []

        for file_path in critical_files:
            print(f"  Checking: {file_path}")
            
            try:
                path_obj = Path(file_path)
                if not path_obj.exists():
                    print(f"    ⚠️  File not found")
                    test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                    self.results["syntax"][test_key] = {
                        "file": str(path_obj),
                        "exists": False,
                        "valid_syntax": False,
                        "success": False,
                        "error": "File not found"
                    }
                    syntax_errors.append(f"{file_path}: File not found")
                    continue

                # Read and parse the file to check for syntax errors
                with open(path_obj, 'r', encoding='utf-8') as f:
                    source_code = f.read()
                
                # Parse the AST to check for syntax errors
                ast.parse(source_code)
                
                print(f"    ✅ Valid syntax")
                test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                self.results["syntax"][test_key] = {
                    "file": str(path_obj),
                    "exists": True,
                    "valid_syntax": True,
                    "success": True,
                    "error": None
                }
                valid_files.append(file_path)
                
            except SyntaxError as e:
                print(f"    ❌ Syntax Error: {e}")
                test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                self.results["syntax"][test_key] = {
                    "file": str(path_obj),
                    "exists": True,
                    "valid_syntax": False,
                    "success": False,
                    "error": str(e)
                }
                syntax_errors.append(f"{file_path}: {str(e)}")
            except Exception as e:
                print(f"    ❌ Error: {e}")
                test_key = f"syntax_{file_path.replace('/', '_').replace('.', '_')}"
                self.results["syntax"][test_key] = {
                    "file": str(path_obj),
                    "exists": True,
                    "valid_syntax": False,
                    "success": False,
                    "error": str(e)
                }
                syntax_errors.append(f"{file_path}: {str(e)}")

        print(f"\n  Summary:")
        print(f"    ✅ Valid Syntax: {len(valid_files)}")
        print(f"    ❌ Syntax Errors: {len(syntax_errors)}")
        
        if syntax_errors:
            print(f"\n  Files with Syntax Errors:")
            for error in syntax_errors:
                print(f"    - {error}")
        
        syntax_success = len(syntax_errors) == 0
        return {"success": syntax_success, "errors": syntax_errors, "valid": valid_files}

    def test_system_health(self) -> Dict[str, bool]:
        """Test overall system health"""
        print("\n🔍 Testing System Health...")
        print("-" * 50)

        health_checks = []

        # Test health endpoint
        try:
            response = requests.get(urljoin(self.base_url, "/health"), timeout=10)
            health_ok = response.status_code == 200
            health_checks.append(("Health Endpoint", health_ok, response.status_code))
            print(f"  Health Endpoint: {'✅' if health_ok else '❌'} Status {response.status_code}")
        except Exception as e:
            health_checks.append(("Health Endpoint", False, str(e)))
            print(f"  Health Endpoint: ❌ Error {e}")

        # Test if server is responding
        try:
            response = requests.get(self.base_url, timeout=10)
            server_ok = response.status_code in [200, 404]  # 200 = UI served, 404 = no root handler
            health_checks.append(("Server Response", server_ok, response.status_code))
            print(f"  Server Response: {'✅' if server_ok else '❌'} Status {response.status_code}")
        except Exception as e:
            health_checks.append(("Server Response", False, str(e)))
            print(f"  Server Response: ❌ Error {e}")

        # Test authentication
        try:
            response = requests.get(urljoin(self.base_url, "/v1/gpu/status"), timeout=10)
            auth_ok = response.status_code in [200, 401, 403]  # 401/403 = auth required, 200 = success
            auth_msg = "Auth OK" if auth_ok else "Unexpected status"
            health_checks.append(("Authentication", auth_ok, auth_msg))
            print(f"  Authentication: {'✅' if auth_ok else '❌'} {auth_msg}")
        except Exception as e:
            health_checks.append(("Authentication", False, str(e)))
            print(f"  Authentication: ❌ Error {e}")

        all_healthy = all(check[1] for check in health_checks)
        return {"success": all_healthy, "checks": health_checks}

    def run_all_tests(self) -> bool:
        """Run all verification tests"""
        print("🚀 Running Endpoint and Syntax Verification Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)

        # Run all test categories
        endpoint_results = self.test_all_endpoints()
        syntax_results = self.test_syntax_in_files()
        health_results = self.test_system_health()

        # Summary
        print("\n" + "=" * 80)
        print("📊 VERIFICATION TEST RESULTS")
        print("=" * 80)
        
        print(f"Endpoint Accessibility: {'✅ PASS' if endpoint_results['success'] else '❌ FAIL'}")
        print(f"Syntax Verification: {'✅ PASS' if syntax_results['success'] else '❌ FAIL'}")
        print(f"System Health: {'✅ PASS' if health_results['success'] else '❌ FAIL'}")

        overall_success = all([
            endpoint_results['success'],
            syntax_results['success'],
            health_results['success']
        ])

        print(f"\n🎯 Overall Result: {'✅ ALL VERIFICATIONS PASSED' if overall_success else '❌ SOME VERIFICATIONS FAILED'}")

        if not endpoint_results['success']:
            print(f"\n  Missing Endpoints: {len(endpoint_results['missing'])}")
        
        if not syntax_results['success']:
            print(f"  Syntax Errors: {len(syntax_results['errors'])}")

        return overall_success

    def generate_report(self) -> Dict:
        """Generate a detailed verification report"""
        report = {
            "timestamp": __import__('datetime').datetime.now().isoformat(),
            "base_url": self.base_url,
            "results": self.results,
            "summary": {
                "endpoints": {
                    "total": len(self.results["endpoints"]),
                    "accessible": len([r for r in self.results["endpoints"].values() if r["success"]]),
                    "missing": len([r for r in self.results["endpoints"].values() if not r["success"]])
                },
                "syntax": {
                    "total": len(self.results["syntax"]),
                    "valid": len([r for r in self.results["syntax"].values() if r["success"]]),
                    "errors": len([r for r in self.results["syntax"].values() if not r["success"]])
                }
            }
        }
        return report


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Verify Endpoints and Syntax for Anchor Core")
    parser.add_argument("--url", default="http://localhost:8000",
                       help="Base URL of the Anchor Core (default: http://localhost:8000)")
    parser.add_argument("--token", default="sovereign-secret",
                       help="Authentication token (default: sovereign-secret)")
    parser.add_argument("--output",
                       help="Output file for verification report (JSON format)")

    args = parser.parse_args()

    # Run the verification tests
    tester = EndpointAndSyntaxTester(base_url=args.url, token=args.token)
    success = tester.run_all_tests()

    # Generate and save report if requested
    if args.output:
        report = tester.generate_report()
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\n📄 Verification report saved to: {args.output}")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()