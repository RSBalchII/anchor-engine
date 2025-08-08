# ark_main.py
# Version 4.0: Multi-Model Plan-and-Execute Architecture
# Author: Rob Balch II & Sybil

import requests
import json
import re
import traceback
from sybil_agent import SybilAgent

# --- Configuration ---
OLLAMA_URL = "http://localhost:11434/api/generate"
# Use a specialized model for planning and another for synthesis
PLANNER_MODEL = "deepseek-r1:8b-0528-qwen3-q8_0" 
SYNTHESIZER_MODEL = "samantha-mistral:7b"

# --- PROMPT ENGINEERING ---

PLANNER_PROMPT = """
# ROLE: You are a JSON planning agent.
# TASK: Create a JSON array of tool calls to fulfill the user's request.
# OUTPUT: Your response MUST be ONLY a markdown JSON block.

# TOOLS:
# - web_search(query: str)
# - store_memory(text_to_store: str)
# - retrieve_similar_memories(query_text: str)
# - list_project_files()
# - read_multiple_files(filepaths: list)
# - analyze_code(filepath: str)

# EXAMPLE:
# USER REQUEST: what is the weather in Paris and can you save this conversation?
# YOUR PLAN:
# ```json
# [
#     {{
#         "reasoning": "Find the weather in Paris.",
#         "tool_call": "web_search(query=\\"weather in Paris\\")"
#     }},
#     {{
#         "reasoning": "Save the user's request to memory.",
#         "tool_call": "store_memory(text_to_store=\\"what is the weather in Paris and can you save this conversation?\\")"
#     }}
# ]
# ```

# --- YOUR TURN ---

# USER REQUEST: "{user_input}"
# YOUR PLAN:
"""

SYNTHESIS_PROMPT = """
You are Samantha, a helpful and empathetic AI assistant. Your only task is to synthesize the results of the executed plan into a single, natural, and conversational answer for your user, Rob.

**IMPORTANT RULES:**
1. You MUST base your answer ONLY on the information provided in the TOOL EXECUTION RESULTS.
2. Address the output from EACH tool call to provide a complete answer.
3. Speak naturally, as if you were having a real conversation.

---
**USER'S ORIGINAL REQUEST:**
"{user_input}"

---
**TOOL EXECUTION RESULTS:**
{tool_outputs}
---

Based on the results, provide a clear and friendly answer to Rob.
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
            print(f"A critical error occurred in the main loop: {e}")

def extract_json_from_response(response_text):
    """Finds and extracts a JSON array string from a markdown block."""
    match = re.search(r'```json\s*([\s\S]*?)\s*```', response_text)
    if match:
        return match.group(1).strip()
    if response_text.strip().startswith('['):
        return response_text.strip()
    return None

def process_user_request(user_input, agent):
    """Handles a single turn using the multi-model Plan-and-Execute strategy."""
    raw_plan_output = ""
    try:
        # 1. Planning Phase (using the Planner model)
        print("Sybil is planning...")
        plan_prompt = PLANNER_PROMPT.format(user_input=user_input)
        raw_plan_output = call_ollama(plan_prompt, model_name=PLANNER_MODEL)
        
        plan_json_str = extract_json_from_response(raw_plan_output)
        if not plan_json_str:
            raise ValueError("No valid JSON plan was found in the model's response.")
            
        plan = json.loads(plan_json_str)

        if not plan:
            # If the plan is empty, go to a conversational response with the Synthesizer
            synthesis_prompt = f"You are Samantha, an empathetic AI. Respond conversationally to the user's message: '{user_input}'"
            final_answer = call_ollama(synthesis_prompt, model_name=SYNTHESIZER_MODEL)
            print(f"Sybil: {final_answer}")
            return

        # 2. Execution Phase
        tool_outputs = []
        print("Sybil is executing the plan...")
        for step in plan:
            tool_call_str = step.get("tool_call")
            if not tool_call_str: continue

            tool_name = tool_call_str.split('(')[0]
            args_str = tool_call_str[len(tool_name)+1:-1]
            
            tool_args = {}
            if args_str:
                parts = args_str.split('=', 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1].strip().strip('"')
                    tool_args[key] = value
            
            print(f"Executing: {tool_call_str}")
            result = agent.execute_tool(tool_name=tool_name, tool_args=tool_args)
            tool_outputs.append({"tool_call": tool_call_str, "output": result})

        # 3. Synthesis Phase (using the Synthesizer model)
        print("Sybil is synthesizing the results...")
        synthesis_prompt = SYNTHESIS_PROMPT.format(
            user_input=user_input,
            tool_outputs=json.dumps(tool_outputs, indent=2)
        )
        final_answer = call_ollama(synthesis_prompt, model_name=SYNTHESIZER_MODEL)
        print(f"Sybil: {final_answer}")

    except Exception as e:
        print(f"Sybil: I encountered an error. Error: {e}")
        if raw_plan_output:
            print(f"--- Raw planner output ---\n{raw_plan_output}\n--------------------------")
        traceback.print_exc()

def call_ollama(prompt, model_name):
    """Sends a prompt to the Ollama API using a specific model."""
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": { "temperature": 0.0 }
    }
    response = requests.post(OLLAMA_URL, json=payload)
    response.raise_for_status()
    response_json = response.json()
    return response_json['response'].strip()

if __name__ == "__main__":
    run_ark()