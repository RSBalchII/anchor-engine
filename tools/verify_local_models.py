#!/usr/bin/env python3
"""
Local Model File Verification Script for Anchor Core

This script tests if required model files exist locally in the models directory
before attempting to load them into the MLC-LLM engine. This is separate from 
the Hugging Face verification to ensure we can distinguish between online 
availability and local file presence.
"""

import os
import sys
import time
from pathlib import Path
import json


class LocalModelVerifier:
    def __init__(self, models_dir="models"):
        self.models_dir = Path(models_dir)
        self.results = {}

    def test_local_model_availability(self, model_name):
        """Test if a model is available locally by checking required files"""
        print(f"Testing local model availability: {model_name}")
        
        # Define the required model files for MLC-LLM
        required_files = [
            "ndarray-cache.json",
            "tokenizer.json",
            "mlc-chat-config.json", 
            "tokenizer_config.json"
        ]
        
        # Also check for parameter files (sharded format is common)
        param_patterns = ["params_shard_*.bin", "params_shard_*.safetensors", "params.json"]
        
        model_path = self.models_dir / model_name
        if not model_path.exists():
            print(f"  MISSING Model directory does not exist: {model_path}")
            return {
                "model_name": model_name,
                "available": False,
                "directory_exists": False,
                "files": {},
                "reason": "Model directory does not exist"
            }
        
        model_result = {
            "model_name": model_name,
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
                print(f"  OK {file_name}")
            else:
                print(f"  MISSING {file_name}")
                missing_files.append(file_name)
                model_result["available"] = False
                model_result["reason"] = f"Missing required file: {file_name}"
        
        # Check for parameter files (at least one pattern should match)
        param_found = False
        for pattern in param_patterns:
            param_files = list(model_path.glob(pattern))
            if param_files:
                param_found = True
                for param_file in param_files[:3]:  # Show first 3 matches
                    print(f"  OK {param_file.name} (parameter file)")
                break
        
        if not param_found:
            print(f"  WARNING No parameter files found (looked for: {', '.join(param_patterns)})")
            # Don't mark as unavailable just for missing params, as they might be loaded differently
        
        if missing_files:
            print(f"  INFO Missing files locally: {len(missing_files)} required files not found")
        else:
            print(f"  SUCCESS Model {model_name} is fully available locally!")
        
        self.results[model_name] = model_result
        return model_result

    def scan_all_local_models(self):
        """Scan the models directory for all available models"""
        if not self.models_dir.exists():
            print(f"Models directory does not exist: {self.models_dir}")
            return []
        
        model_dirs = [d for d in self.models_dir.iterdir() if d.is_dir()]
        return [d.name for d in model_dirs]

    def run_local_verification_tests(self, model_list):
        """Run local availability tests for a list of models"""
        print("Running Local Model Availability Tests")
        print("=" * 60)
        
        available_models = []
        unavailable_models = []
        
        for model_name in model_list:
            print(f"\nTesting: {model_name}")
            result = self.test_local_model_availability(model_name)
            
            if result["available"]:
                available_models.append(model_name)
                print(f"  RESULT: AVAILABLE locally")
            else:
                unavailable_models.append(model_name)
                print(f"  RESULT: NOT AVAILABLE locally - {result['reason']}")
        
        print("\n" + "="*60)
        print("LOCAL VERIFICATION SUMMARY:")
        print(f"  Available Models: {len(available_models)}")
        for model in available_models:
            print(f"    OK {model}")
        
        print(f"  Unavailable Models: {len(unavailable_models)}")
        for model in unavailable_models:
            result = self.results.get(model, {})
            reason = result.get("reason", "Unknown reason")
            print(f"    MISSING {model} - {reason}")
        
        print("\nRECOMMENDATION:")
        if unavailable_models:
            print("  - Download required models using the /v1/models/pull endpoint")
            print("  - Or ensure models are pre-loaded in the models/ directory")
        else:
            print("  - All models are available locally!")
        
        return available_models, unavailable_models


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Verify Local Model File Availability for Anchor Core")
    parser.add_argument("--models", nargs="+",
                       help="Specific models to test (default: scan models directory)")
    parser.add_argument("--models-dir", default="models",
                       help="Models directory path (default: models)")
    parser.add_argument("--output",
                       help="Output file for verification report (JSON format)")
    
    args = parser.parse_args()
    
    verifier = LocalModelVerifier(models_dir=args.models_dir)
    
    if args.models:
        # Test specific models
        models_to_test = args.models
    else:
        # Scan models directory for available models
        print(f"Scanning models directory: {args.models_dir}")
        models_to_test = verifier.scan_all_local_models()
        if not models_to_test:
            print("No models found in directory, using default test models...")
            models_to_test = [
                "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
                "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
                "Phi-3.5-mini-instruct-q4f16_1-MLC"
            ]
    
    available, unavailable = verifier.run_local_verification_tests(models_to_test)
    
    if args.output:
        report = {
            "models_dir": args.models_dir,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "tested_models": models_to_test,
            "results": verifier.results,
            "summary": {
                "total": len(models_to_test),
                "available": len(available),
                "unavailable": len(unavailable)
            }
        }
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nTest report saved to: {args.output}")
    
    # Exit with error code if no models are available locally
    if not available and args.models:  # Only error if specific models were requested
        print("\nERROR: No requested models are available locally!")
        sys.exit(1)
    else:
        print(f"\nSUCCESS: {len(available)} model(s) are available locally!")
        if not args.models:
            print(f"Found {len(models_to_test)} models in the models directory.")
        sys.exit(0)


if __name__ == "__main__":
    main()