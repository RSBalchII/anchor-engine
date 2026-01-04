#!/usr/bin/env python3
"""
Hugging Face Model URL Verification Script for Anchor Core

This script tests if model files are available on Hugging Face before attempting 
to download or use them locally. This helps ensure models are online before 
running local availability tests.
"""

import requests
import sys
import time
from urllib.parse import urljoin
import json
from pathlib import Path


class HuggingFaceModelVerifier:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })

    def test_hf_model_availability(self, model_id, expected_files=None):
        """Test if a model is available on Hugging Face by checking required files"""
        print(f"Testing Hugging Face model availability: {model_id}")
        
        if expected_files is None:
            # Default MLC-LLM required files
            expected_files = [
                "ndarray-cache.json",
                "tokenizer.json", 
                "mlc-chat-config.json",
                "tokenizer_config.json",
                "params_shard_0.safetensors"  # Common sharded parameter file
            ]
        
        model_result = {
            "model_id": model_id,
            "available": True,
            "files": {},
            "huggingface_url": f"https://huggingface.co/{model_id}"
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
                
                model_result["files"][file_name] = file_status
                
                if response.status_code == 200:
                    print(f"  OK {file_name}")
                elif response.status_code == 404:
                    print(f"  MISSING {file_name} - NOT FOUND on Hugging Face")
                    missing_files.append(file_name)
                    model_result["available"] = False
                else:
                    print(f"  WARNING {file_name} - Status {response.status_code}")
                    model_result["available"] = False
                    
            except requests.exceptions.RequestException as e:
                file_status = {
                    "url": hf_url,
                    "status_code": "ERROR",
                    "exists": False,
                    "error": str(e),
                    "checked_at": time.time()
                }
                model_result["files"][file_name] = file_status
                print(f"  ERROR {file_name} - {e}")
                model_result["available"] = False
        
        if missing_files:
            print(f"  INFO Missing files on Hugging Face: {len(missing_files)} required files not found")
        else:
            print(f"  SUCCESS Model {model_id} is fully available on Hugging Face!")
        
        return model_result

    def get_model_info(self, model_id):
        """Get model information from Hugging Face API"""
        info_url = f"https://huggingface.co/api/models/{model_id}"
        
        try:
            response = self.session.get(info_url, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"  WARNING Could not fetch model info for {model_id} - Status: {response.status_code}")
                return None
        except Exception as e:
            print(f"  ERROR Could not fetch model info for {model_id} - {e}")
            return None

    def test_model_files_list(self, model_id):
        """Get list of files in the model repository"""
        files_url = f"https://huggingface.co/api/models/{model_id}/tree/main"
        
        try:
            response = self.session.get(files_url, timeout=10)
            if response.status_code == 200:
                files_data = response.json()
                file_names = [f["path"] for f in files_data if f["type"] == "file"]
                return file_names
            else:
                print(f"  WARNING Could not fetch file list for {model_id} - Status: {response.status_code}")
                return []
        except Exception as e:
            print(f"  ERROR Could not fetch file list for {model_id} - {e}")
            return []

    def run_hf_verification_tests(self, model_list):
        """Run Hugging Face availability tests for a list of models"""
        print("Running Hugging Face Model Availability Tests")
        print("=" * 60)
        
        available_models = []
        unavailable_models = []
        
        for model_id in model_list:
            print(f"\nTesting: {model_id}")
            
            # First, try to get model info
            model_info = self.get_model_info(model_id)
            if model_info:
                print(f"  INFO Model name: {model_info.get('modelId', 'Unknown')}")
                print(f"  INFO Downloads: {model_info.get('downloads', 'Unknown')}")
                print(f"  INFO Likes: {model_info.get('likes', 'Unknown')}")
            
            # Check specific files we need for MLC-LLM
            result = self.test_hf_model_availability(model_id)
            
            if result["available"]:
                available_models.append(model_id)
                print(f"  RESULT: AVAILABLE on Hugging Face")
            else:
                unavailable_models.append(model_id)
                print(f"  RESULT: NOT AVAILABLE on Hugging Face")
                
                # Show what files are actually available as fallback
                available_files = self.test_model_files_list(model_id)
                if available_files:
                    mlc_files = [f for f in available_files if any(req in f for req in ['config', 'tokenizer', 'params', 'ndarray'])]
                    if mlc_files:
                        print(f"  INFO Some MLC-LLM files available: {mlc_files[:5]}...")  # Show first 5
        
        print("\n" + "="*60)
        print("HUGGING FACE VERIFICATION SUMMARY:")
        print(f"  Available Models: {len(available_models)}")
        for model in available_models:
            print(f"    OK {model}")
        
        print(f"  Unavailable Models: {len(unavailable_models)}")
        for model in unavailable_models:
            print(f"    MISSING {model}")
        
        print("\nRECOMMENDATION:")
        if unavailable_models:
            print("  - Avoid using models that are not available on Hugging Face")
            print("  - Consider alternative model IDs for unavailable models")
        else:
            print("  - All models are available on Hugging Face for download!")
        
        return available_models, unavailable_models


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Verify Hugging Face Model Availability for Anchor Core")
    parser.add_argument("--models", nargs="+",
                       help="Specific models to test (default: predefined list)")
    parser.add_argument("--output",
                       help="Output file for verification report (JSON format)")
    
    args = parser.parse_args()
    
    verifier = HuggingFaceModelVerifier()
    
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
    
    available, unavailable = verifier.run_hf_verification_tests(models_to_test)
    
    if args.output:
        # Generate a simple report
        report = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "tested_models": models_to_test,
            "available_models": available,
            "unavailable_models": unavailable,
            "summary": {
                "total": len(models_to_test),
                "available": len(available),
                "unavailable": len(unavailable)
            }
        }
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nTest report saved to: {args.output}")
    
    # Exit with error code if no models are available
    if not available:
        print("\nERROR: No models are available on Hugging Face!")
        sys.exit(1)
    else:
        print(f"\nSUCCESS: {len(available)} model(s) are available on Hugging Face!")
        sys.exit(0)


if __name__ == "__main__":
    main()