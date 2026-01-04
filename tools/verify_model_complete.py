#!/usr/bin/env python3
"""
Combined Model Verification Script for Anchor Core

This script first verifies that models are available online on Hugging Face,
then checks if they are available locally, providing a complete verification
pipeline before attempting to use models in the system.
"""

import requests
import sys
import time
from urllib.parse import urljoin
import json
from pathlib import Path


class CombinedModelVerifier:
    def __init__(self, models_dir="models", base_url="http://localhost:8000", token="sovereign-secret"):
        self.models_dir = Path(models_dir)
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })
        self.results = {}

    def test_hf_model_availability(self, model_id, expected_files=None):
        """Test if a model is available on Hugging Face by checking required files"""
        print(f"  Testing Hugging Face availability: {model_id}")
        
        if expected_files is None:
            # Default MLC-LLM required files
            expected_files = [
                "ndarray-cache.json",
                "tokenizer.json", 
                "mlc-chat-config.json",
                "tokenizer_config.json"
            ]
        
        model_result = {
            "huggingface": {
                "available": True,
                "files": {},
                "huggingface_url": f"https://huggingface.co/{model_id}"
            }
        }
        
        missing_files = []
        
        for file_name in expected_files:
            hf_url = f"https://huggingface.co/{model_id}/resolve/main/{file_name}"
            
            try:
                response = self.session.head(hf_url, timeout=15)
                
                file_status = {
                    "url": hf_url,
                    "status_code": response.status_code,
                    "exists": response.status_code == 200,
                    "checked_at": time.time()
                }
                
                model_result["huggingface"]["files"][file_name] = file_status
                
                if response.status_code in [200, 302, 307]:  # 302/307 are redirects, meaning file exists
                    print(f"    OK {file_name}")
                elif response.status_code == 404:
                    print(f"    MISSING {file_name} - NOT FOUND on Hugging Face")
                    missing_files.append(file_name)
                    model_result["huggingface"]["available"] = False
                else:
                    print(f"    WARNING {file_name} - Status {response.status_code}")
                    model_result["huggingface"]["available"] = False
                    
            except requests.exceptions.RequestException as e:
                file_status = {
                    "url": hf_url,
                    "status_code": "ERROR",
                    "exists": False,
                    "error": str(e),
                    "checked_at": time.time()
                }
                model_result["huggingface"]["files"][file_name] = file_status
                print(f"    ERROR {file_name} - {e}")
                model_result["huggingface"]["available"] = False
        
        if missing_files:
            print(f"    INFO Missing files on Hugging Face: {len(missing_files)} required files not found")
        else:
            print(f"    SUCCESS Available on Hugging Face!")
        
        return model_result["huggingface"]

    def test_local_model_availability(self, model_name):
        """Test if a model is available locally by checking required files"""
        print(f"  Testing local availability: {model_name}")
        
        # Define the required model files for MLC-LLM
        required_files = [
            "ndarray-cache.json",
            "tokenizer.json",
            "mlc-chat-config.json", 
            "tokenizer_config.json"
        ]
        
        model_path = self.models_dir / model_name
        if not model_path.exists():
            print(f"    MISSING Model directory does not exist: {model_path}")
            return {
                "available": False,
                "directory_exists": False,
                "files": {},
                "reason": "Model directory does not exist"
            }
        
        model_result = {
            "available": True,
            "directory_exists": True,
            "files": {},
            "reason": "All required files present"
        }
        
        missing_files = []
        
        # Check standard files
        for file_name in required_files:
            file_path = model_path / file_name
            file_exists = file_path.exists()
            
            file_status = {
                "path": str(file_path),
                "exists": file_exists,
                "checked_at": time.time()
            }
            
            model_result["files"][file_name] = file_status
            
            if file_exists:
                print(f"    OK {file_name}")
            else:
                print(f"    MISSING {file_name}")
                missing_files.append(file_name)
                model_result["available"] = False
                model_result["reason"] = f"Missing required file: {file_name}"
        
        if missing_files:
            print(f"    INFO Missing files locally: {len(missing_files)} required files not found")
        else:
            print(f"    SUCCESS Available locally!")
        
        return model_result

    def test_bridge_redirect_availability(self, model_name):
        """Test if the bridge redirect endpoint can serve the model files"""
        print(f"  Testing bridge redirect availability: {model_name}")
        
        # Define the required model files for MLC-LLM using the resolve/main pattern
        required_files = [
            f"models/{model_name}/resolve/main/ndarray-cache.json",
            f"models/{model_name}/resolve/main/tokenizer.json",
            f"models/{model_name}/resolve/main/mlc-chat-config.json",
            f"models/{model_name}/resolve/main/tokenizer_config.json"
        ]
        
        model_result = {
            "available": True,
            "files": {},
            "download_required": False
        }
        
        missing_files = []
        
        for file_path in required_files:
            try:
                url = urljoin(self.base_url, file_path)
                response = self.session.head(url, timeout=10)  # Short timeout for availability check

                file_status = {
                    "url": url,
                    "status_code": response.status_code,
                    "exists": response.status_code == 200,
                    "checked_at": time.time()
                }

                model_result["files"][file_path] = file_status

                if response.status_code == 200:
                    print(f"    OK {file_path}")
                elif response.status_code == 404:
                    print(f"    MISSING {file_path} - NOT FOUND via bridge")
                    missing_files.append(file_path)
                    model_result["available"] = False
                    model_result["download_required"] = True
                else:
                    print(f"    WARNING {file_path} - Status {response.status_code}")
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
                print(f"    ERROR {file_path} - {e}")
                model_result["available"] = False

        if missing_files:
            print(f"    INFO Missing files via bridge: {len(missing_files)} required files not found")
        else:
            print(f"    SUCCESS Available via bridge!")
        
        return model_result

    def verify_model_complete(self, model_id):
        """Complete verification: Hugging Face -> Local -> Bridge"""
        print(f"\nVerifying model: {model_id}")
        print("-" * 50)
        
        # Extract model name from model_id (remove mlc-ai/ prefix if present)
        model_name = model_id.split('/')[-1] if '/' in model_id else model_id
        
        verification_result = {
            "model_id": model_id,
            "model_name": model_name,
            "huggingface": None,
            "local": None,
            "bridge": None,
            "overall_status": "UNKNOWN",
            "recommendation": "UNKNOWN"
        }
        
        # Step 1: Check Hugging Face availability
        hf_result = self.test_hf_model_availability(model_id)
        verification_result["huggingface"] = hf_result
        
        if not hf_result["available"]:
            verification_result["overall_status"] = "UNAVAILABLE"
            verification_result["recommendation"] = "Model not available on Hugging Face - cannot proceed"
            print(f"  ERROR: Model not available on Hugging Face")
            return verification_result
        
        # Step 2: Check local availability
        local_result = self.test_local_model_availability(model_name)
        verification_result["local"] = local_result
        
        # Step 3: Check bridge redirect availability
        bridge_result = self.test_bridge_redirect_availability(model_name)
        verification_result["bridge"] = bridge_result
        
        # Determine overall status
        if local_result["available"]:
            verification_result["overall_status"] = "AVAILABLE_LOCALLY"
            verification_result["recommendation"] = "Ready to use - available locally"
        elif bridge_result["available"]:
            verification_result["overall_status"] = "AVAILABLE_VIA_BRIDGE"
            verification_result["recommendation"] = "Available via bridge redirect (may download from online)"
        else:
            verification_result["overall_status"] = "DOWNLOAD_REQUIRED"
            verification_result["recommendation"] = "Not available locally, needs download via /v1/models/pull"
        
        print(f"  Overall Status: {verification_result['overall_status']}")
        print(f"  Recommendation: {verification_result['recommendation']}")
        
        return verification_result

    def run_complete_verification_tests(self, model_list):
        """Run complete verification tests for a list of models"""
        print("Running Complete Model Verification Tests")
        print("Phase 1: Hugging Face availability check")
        print("Phase 2: Local file availability check") 
        print("Phase 3: Bridge redirect availability check")
        print("=" * 80)
        
        results = []
        available_online = []
        available_locally = []
        available_via_bridge = []
        download_required = []
        completely_unavailable = []
        
        for model_id in model_list:
            result = self.verify_model_complete(model_id)
            results.append(result)
            
            if result["overall_status"] == "AVAILABLE_LOCALLY":
                available_locally.append(model_id)
            elif result["overall_status"] == "AVAILABLE_VIA_BRIDGE":
                available_via_bridge.append(model_id)
            elif result["overall_status"] == "DOWNLOAD_REQUIRED":
                download_required.append(model_id)
            elif result["overall_status"] == "UNAVAILABLE":
                completely_unavailable.append(model_id)
        
        # Final summary
        print("\n" + "="*80)
        print("COMPLETE VERIFICATION SUMMARY:")
        
        if available_locally:
            print(f"\n✅ AVAILABLE LOCALLY - Ready to use immediately:")
            for model in available_locally:
                print(f"    {model}")
        
        if available_via_bridge:
            print(f"\n🔄 AVAILABLE VIA BRIDGE - Will redirect to online sources:")
            for model in available_via_bridge:
                print(f"    {model}")
        
        if download_required:
            print(f"\nDOWNLOAD REQUIRED - Use /v1/models/pull to download:")
            for model in download_required:
                print(f"    {model}")

        if completely_unavailable:
            print(f"\nCOMPLETELY UNAVAILABLE - Not on Hugging Face:")
            for model in completely_unavailable:
                print(f"    {model}")
        
        print(f"\nTOTALS:")
        print(f"  Models tested: {len(model_list)}")
        print(f"  Available locally: {len(available_locally)}")
        print(f"  Available via bridge: {len(available_via_bridge)}")
        print(f"  Need download: {len(download_required)}")
        print(f"  Completely unavailable: {len(completely_unavailable)}")
        
        return results, {
            "available_locally": available_locally,
            "available_via_bridge": available_via_bridge,
            "download_required": download_required,
            "completely_unavailable": completely_unavailable
        }


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Complete Model Verification for Anchor Core")
    parser.add_argument("--models", nargs="+",
                       help="Specific models to test (default: predefined list)")
    parser.add_argument("--models-dir", default="models",
                       help="Models directory path (default: models)")
    parser.add_argument("--url", default="http://localhost:8000",
                       help="Base URL of the Anchor Core (default: http://localhost:8000)")
    parser.add_argument("--token", default="sovereign-secret",
                       help="Authentication token (default: sovereign-secret)")
    parser.add_argument("--output",
                       help="Output file for verification report (JSON format)")
    
    args = parser.parse_args()
    
    verifier = CombinedModelVerifier(
        models_dir=args.models_dir,
        base_url=args.url,
        token=args.token
    )
    
    # Default model list if none provided
    default_models = [
        "mlc-ai/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
        "mlc-ai/Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC", 
        "mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC",
        "mlc-ai/DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
        "mlc-ai/DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
        "mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC",
        "mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
        "mlc-ai/Llama-3.1-8B-Instruct-q4f32_1-MLC",
        "mlc-ai/gemma-2-9b-it-q4f16_1-MLC",
        "mlc-ai/Phi-3.5-vision-instruct-q4f16_1-MLC"
    ]
    
    models_to_test = args.models if args.models else default_models
    
    print(f"Starting complete verification for {len(models_to_test)} models...")
    print(f"Models directory: {args.models_dir}")
    print(f"Server URL: {args.url}")
    
    results, summary = verifier.run_complete_verification_tests(models_to_test)
    
    if args.output:
        report = {
            "models_dir": args.models_dir,
            "server_url": args.url,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "tested_models": models_to_test,
            "results": results,
            "summary": summary
        }
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nComplete verification report saved to: {args.output}")
    
    # Exit with error code if no models are available at all
    total_available = len(summary["available_locally"]) + len(summary["available_via_bridge"])
    if total_available == 0 and args.models:  # Only error if specific models were requested
        print("\nERROR: No requested models are available for use!")
        sys.exit(1)
    else:
        print(f"\nSUCCESS: {total_available} model(s) are available for use!")
        if summary["completely_unavailable"]:
            print(f"Note: {len(summary['completely_unavailable'])} models are not available on Hugging Face.")
        sys.exit(0)


if __name__ == "__main__":
    main()