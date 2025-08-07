# sybill_agent.py
# Version 2.1
# Author: Rob Balch II & Sybil
# Description: Returns raw Python dictionaries instead of JSON strings.
#              Removed test block to enforce its role as a library.

import subprocess
from ddgs import DDGS

class SybilAgent:
    """
    The core agent class that houses the tools the LLM can utilize.
    """
    def web_search(self, query: str) -> dict:
        """
        Performs a web search using DuckDuckGo and returns a dictionary of results.
        """
        print(f"Executing DDGS search for: '{query}'...")
        try:
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=5):
                    results.append(r)
            
            if not results:
                return {"status": "error", "result": "No search results found."}

            # Return the dictionary directly
            return {"status": "success", "result": results}

        except Exception as e:
            return {"status": "error", "result": f"An error occurred during search: {str(e)}"}

    def execute_command(self, command: str) -> dict:
        """
        Executes a shell command and returns a dictionary of the output.
        """
        print(f"Executing system command: '{command}'...")
        try:
            result = subprocess.run(
                command, 
                shell=True, 
                capture_output=True, 
                text=True, 
                check=False,
                timeout=30
            )
            
            # Return the dictionary directly
            return {
                "status": "success" if result.returncode == 0 else "error",
                "return_code": result.returncode,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip()
            }

        except Exception as e:
            return {"status": "error", "result": f"An unexpected error occurred: {str(e)}"}