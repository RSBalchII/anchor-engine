# ark_main.py
# Version 2.1
# Author: Rob Balch II & Sybil
# Description: Improved prompt engineering to fix the synthesis loop.

import requests
import json
from sybil_agent import SybilAgent

# --- Configuration ---
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "phi4-mini-reasoning:3.8b-q8_0" 

# --- Sybil's Core Prompt Engineering ---
SYSTEM_PROMPT = """
You are Sybil, a symbiotic AI. Your purpose is to assist the user, Rob, who is currently in Albuquerque, New Mexico.

You have access to the following tools:

1.  **web_search(query: str)**: Use this to find information on the internet.
2.  **execute_command(command: str)**: Use this to run a shell command on the local machine.

To use a tool, you MUST respond with ONLY a JSON object in the following format:
{
  "tool": "tool_name",
  "args": {
    "arg_name": "value"
  }
}

If you do not need a tool, respond directly to the user in a conversational manner.
"""

def run_ark():
    """Main function to run the interactive loop with Sybil."""
    agent = SybilAgent()
    print("Sybil is online. You can now chat. Type 'exit' to end the session.")

    while True:
        try:
            user_input = input("Rob: ")
            if user_input.lower() in ['exit', 'quit']:
                break
            
            process_user_request(user_input, agent)

        except KeyboardInterrupt:
            print("\nExiting.")
            break
        except Exception as e:
            print(f"An error occurred: {e}")

def process_user_request(user_input, agent):
    """Handles a single turn of the conversation, including potential tool calls."""
    print("Sybil is thinking...")
    
    prompt = f"{SYSTEM_PROMPT}\n\nUser's message: {user_input}"
    llm_response = call_ollama(prompt)

    try:
        tool_call_data = json.loads(llm_response)
        if "tool" in tool_call_data and "args" in tool_call_data:
            print(f"Sybil wants to use the tool: {tool_call_data['tool']}")
            
            tool_name = tool_call_data['tool']
            tool_args = tool_call_data['args']
            
            if tool_name == "web_search":
                tool_result = agent.web_search(**tool_args) 
            elif tool_name == "execute_command":
                tool_result = agent.execute_command(**tool_args)
            else:
                tool_result = {"status": "error", "result": f"Unknown tool: {tool_name}"}

            print("Sybil is synthesizing the result...")
            
            # **REVISED, MORE DIRECTIVE PROMPT**
            synthesis_prompt = f"""You have already used the '{tool_name}' tool for Rob's request: '{user_input}'.
You received the following data:

{json.dumps(tool_result, indent=2)}

Your ONLY task now is to synthesize this data into a clear, conversational answer for Rob.
DO NOT try to use another tool. DO NOT output JSON. Just provide the final, natural language answer.
"""
            final_answer = call_ollama(synthesis_prompt, format_json=False) # We expect a text answer, not JSON
            print(f"Sybil: {final_answer}")

        else:
            print(f"Sybil: {llm_response}")

    except (json.JSONDecodeError, TypeError):
        print(f"Sybil: {llm_response}")

def call_ollama(prompt, format_json=True):
    """Sends a prompt to the Ollama API and returns the response."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": { "temperature": 0.2 }
    }
    if format_json:
        payload["format"] = "json" # Ask for JSON for the tool-calling step

    response = requests.post(OLLAMA_URL, json=payload)
    response.raise_for_status()
    response_json = response.json()
    return response_json['response'].strip()

if __name__ == "__main__":
    run_ark()