# ark_main.py
# Version 5.0: ReAct Architecture with Cognitive Editor
# Author: Rob Balch II & Sybil

import requests
import json
import re
import traceback
import ast
import logging
from sybil_agent import SybilAgent
from tools.cognitive_editor import WorkingMemoryManager

# --- Configuration ---
OLLAMA_URL = "http://localhost:11434/api/generate"
REASONER_MODEL = "phi3:3.8b-mini-instruct-q8_0"  # A model good at reasoning and tool use

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- PROMPT ENGINEERING ---

REACT_PROMPT = """
# ROLE: You are Sybil, a reasoning agent. Your task is to solve the user's request by breaking it down into a series of thought-action-observation steps.

# SELF-REFLECTION:
# - Am I making progress?
# - Is my current approach working?
# - Should I try a different tool or strategy?

# TOOLS:
# You have access to the following tools. Use them one at a time.
# - web_search(query: str)
# - store_memory(text_to_store: str)
# - retrieve_similar_memories(query_text: str)
# - list_project_files()
# - read_multiple_files(filepaths: list)
# - analyze_code(filepath: str)
# - analyze_screen(question: str)
# - move_mouse(x: int, y: int)
# - click_mouse(button: str)
# - type_text(text: str)
# - run_archivist_crew(text_to_analyze: str)
# - finish(answer: str) -> Use this tool to give the final answer to the user.

# MEMORY:
# You have a working memory. Here is a compressed summary of past events:
{scratchpad}

# INSTRUCTIONS:
# 1. **Thought:** Briefly explain your reasoning for the next action.
# 2. **Action:** Choose ONE tool and write the function call.
# 3. **Output:** Your response MUST be in the following format:
# Thought: [Your reasoning here]
# Action: [Your tool call here]

---
# USER REQUEST:
"{user_input}"
---
# YOUR TURN:
"""

def call_ollama(prompt: str) -> str | None:
    """Sends a prompt to the Ollama API and returns the response."""
    payload = {
        "model": REASONER_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.0, "stop": ["Observation:"]}
    }
    try:
        logging.info("Sending prompt to Ollama...")
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        response_json = response.json()
        return response_json['response'].strip()
    except requests.exceptions.RequestException as e:
        logging.error(f"API call to Ollama failed: {e}")
        return None

def parse_tool_call(call_string: str) -> tuple[str, dict] | tuple[None, None]:
    """Parses a tool call string like 'func(arg1=val1)' into a name and args dict."""
    if not call_string:
        return None, None
    try:
        match = re.match(r'(\w+)\((.*)\)', call_string)
        if not match:
            return None, None

        tool_name = match.group(1)
        args_str = match.group(2)

        # This is a simplified parser. It might not handle all edge cases.
        if not args_str:
            return tool_name, {}

        tool_args = {}
        # Using ast.literal_eval to safely parse the arguments string
        # We need to make it look like a dict constructor
        arg_dict_str = f"dict({args_str})"
        tool_args = ast.literal_eval(arg_dict_str)

        return tool_name, tool_args
    except Exception as e:
        logging.error(f"Failed to parse tool call string '{call_string}': {e}")
        return None, None

def react_loop(user_input: str, agent: SybilAgent, memory_manager: WorkingMemoryManager):
    """Runs the ReAct loop to process a user request."""
    max_turns = 10

    for i in range(max_turns):
        print(f"\n--- Turn {i+1}/{max_turns} ---")

        # 1. Get context from memory
        scratchpad = memory_manager.get_context()

        # 2. Generate Thought and Action
        prompt = REACT_PROMPT.format(user_input=user_input, scratchpad=scratchpad)
        llm_response = call_ollama(prompt)

        if not llm_response:
            print("Sybil: I had trouble thinking. Please try again.")
            return

        thought_match = re.search(r'Thought:\s*(.*)', llm_response)
        action_match = re.search(r'Action:\s*(.*)', llm_response)

        thought = thought_match.group(1).strip() if thought_match else ""
        tool_call_str = action_match.group(1).strip() if action_match else ""

        print(f"Sybil's Thought: {thought}")
        print(f"Sybil's Action: {tool_call_str}")

        if not tool_call_str:
            print("Sybil: I didn't decide on an action. I'll try again.")
            continue

        # 3. Execute the Action
        tool_name, tool_args = parse_tool_call(tool_call_str)

        if not tool_name:
            observation = f"Error: Could not parse the action '{tool_call_str}'. Please use the correct format."
        elif tool_name.lower() == "finish":
            answer = tool_args.get('answer', "I have completed the task.")
            print(f"Sybil: {answer}")
            return # End of loop
        else:
            observation = agent.execute_tool(tool_name, tool_args)
            observation = json.dumps(observation, indent=2)

        print(f"Observation: {observation}")

        # 4. Update Memory
        memory_manager.add_entry(thought=thought, action=tool_call_str, observation=observation)

    print("Sybil: I have reached the maximum number of turns. I may not have finished the task.")

def run_ark():
    """Main function to run the ReAct loop."""
    agent = SybilAgent()
    memory_manager = WorkingMemoryManager()

    print("Sybil is online. You can now chat. Type 'exit' to end the session.")

    while True:
        try:
            user_input = input("Rob: ")
            if user_input.lower() in ['exit', 'quit']:
                break
            
            react_loop(user_input, agent, memory_manager)

        except KeyboardInterrupt:
            print("\nExiting.")
            break
        except Exception as e:
            logging.error(f"A critical error occurred in the main loop: {e}", exc_info=True)
            print("Sybil: I've run into an unexpected error. Please check the logs.")

if __name__ == "__main__":
    run_ark()
