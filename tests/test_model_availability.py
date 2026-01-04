#!/usr/bin/env python3
"""
Model Availability Test Suite for Anchor Core

This script tests model availability by checking if required model files exist
locally before attempting to load them into the MLC-LLM engine.
"""

import requests
import sys
import time
from urllib.parse import urljoin
import json
from pathlib import Path


class ModelAvailabilityTester:
    def __init__(self, base_url="http://localhost:8000", token="sovereign-secret"):
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        self.results = {}

    def test_model_availability(self, model_name):
        """Test if a model is available for loading by checking required files"""
        print(f"Testing model availability: {model_name}")

        # Define the required model files for MLC-LLM using the resolve/main pattern
        # This matches how the MLC-LLM library actually accesses files
        required_files = [
            f"models/{model_name}/resolve/main/ndarray-cache.json",
            f"models/{model_name}/resolve/main/tokenizer.json",
            f"models/{model_name}/resolve/main/mlc-chat-config.json",
            f"models/{model_name}/resolve/main/tokenizer_config.json"
        ]

        # Note: MLC-LLM models use sharded parameter files (params_shard_*.bin) instead of params.json
        # So we don't check for params.json which doesn't exist for these models

        model_result = {
            "model_name": model_name,
            "available": True,
            "files": {},
            "download_required": False
        }

        missing_files = []

        for file_path in required_files:
            try:
                url = urljoin(self.base_url, file_path)
                response = requests.head(url, timeout=10)  # Short timeout for availability check

                file_status = {
                    "url": url,
                    "status_code": response.status_code,
                    "exists": response.status_code == 200,
                    "checked_at": time.time()
                }

                model_result["files"][file_path] = file_status

                if response.status_code == 200:
                    print(f"  OK {file_path}")
                elif response.status_code == 404:
                    print(f"  MISSING {file_path} - NOT FOUND")
                    missing_files.append(file_path)
                    model_result["available"] = False
                    model_result["download_required"] = True
                else:
                    print(f"  WARNING {file_path} - Status {response.status_code}")
                    model_result["available"] = False

            except requests.exceptions.RequestException as e:
                file_status = {
                    "url": urljoin(self.base_url, file_path),
                    "status_code": "ERROR",
                    "exists": False,
                    "error": str(e),
                    "checked_at": time.time()
                }
                model_result["files"][file_path] = file_status
                print(f"  ❌ {file_path} - ERROR: {e}")
                model_result["available"] = False

        if missing_files:
            print(f"  INFO Missing files: {len(missing_files)} required files not found")
        else:
            print(f"  SUCCESS Model {model_name} is fully available for loading!")

        self.results[model_name] = model_result
        return model_result["available"]

    def test_model_download_capability(self, model_id):
        """Test if the model download endpoint works for a given model"""
        print(f"\nTesting download capability for: {model_id}")
        
        try:
            url = urljoin(self.base_url, "/v1/models/pull")
            payload = {
                "model_id": model_id,
                "url": f"https://huggingface.co/{model_id}"
            }
            
            # Make a quick test request without waiting for full download
            response = requests.post(url, json=payload, headers=self.headers, timeout=5)
            
            if response.status_code in [200, 409, 400]:  # 409=already exists, 400=bad request (but endpoint works)
                print(f"  OK Download endpoint accessible for {model_id}")
                return True
            else:
                print(f"  FAILED Download endpoint failed for {model_id}: {response.status_code}")
                return False

        except requests.exceptions.RequestException as e:
            print(f"  FAILED Download endpoint error for {model_id}: {e}")
            return False

    def run_model_availability_tests(self, model_list):
        """Run availability tests for a list of models"""
        print(f"Running Model Availability Tests against: {self.base_url}")
        print("-" * 70)
        
        available_models = []
        unavailable_models = []
        
        for model_name in model_list:
            print(f"\nINFO Testing: {model_name}")
            is_available = self.test_model_availability(model_name)

            if is_available:
                available_models.append(model_name)
                print(f"  RESULT: AVAILABLE for loading")
            else:
                unavailable_models.append(model_name)
                print(f"  RESULT: NOT AVAILABLE (download required)")
                
                # Test if download is possible
                huggingface_id = f"mlc-ai/{model_name}"
                self.test_model_download_capability(huggingface_id)
        
        print("\n" + "="*70)
        print("TEST SUMMARY:")
        print(f"  Available Models: {len(available_models)}")
        for model in available_models:
            print(f"    OK {model}")

        print(f"  Unavailable Models: {len(unavailable_models)}")
        for model in unavailable_models:
            print(f"    MISSING {model}")

        print("\nRECOMMENDATION:")
        if unavailable_models:
            print("  - Download required models using the /v1/models/pull endpoint")
            print("  - Or ensure models are pre-loaded in the models/ directory")
        else:
            print("  - All models are ready for immediate loading!")
            
        return available_models, unavailable_models

    def generate_report(self):
        """Generate a detailed test report"""
        report = {
            "base_url": self.base_url,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "results": self.results,
            "summary": {
                "total_models": len(self.results),
                "available": len([r for r in self.results.values() if r["available"]]),
                "unavailable": len([r for r in self.results.values() if not r["available"]])
            }
        }
        return report


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Test Model Availability for Anchor Core")
    parser.add_argument("--url", default="http://localhost:8000", 
                       help="Base URL of the Anchor Core (default: http://localhost:8000)")
    parser.add_argument("--token", default="sovereign-secret", 
                       help="Authentication token (default: sovereign-secret)")
    parser.add_argument("--models", nargs="+", 
                       help="Specific models to test (default: predefined list)")
    parser.add_argument("--output", 
                       help="Output file for test report (JSON format)")

    args = parser.parse_args()

    tester = ModelAvailabilityTester(base_url=args.url, token=args.token)
    
    # Default model list if none provided
    default_models = [
        "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
        "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC", 
        "Qwen2.5-7B-Instruct-q4f16_1-MLC",
        "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
        "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
        "Phi-3.5-mini-instruct-q4f16_1-MLC",
        "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
    ]
    
    models_to_test = args.models if args.models else default_models
    
    available, unavailable = tester.run_model_availability_tests(models_to_test)
    
    if args.output:
        report = tester.generate_report()
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nTest report saved to: {args.output}")

    # Exit with error code if no models are available
    if not available:
        print("\nERROR: No models are currently available for loading!")
        sys.exit(1)
    else:
        print(f"\nSUCCESS: {len(available)} model(s) are ready for loading!")
        sys.exit(0)


if __name__ == "__main__":
    main()