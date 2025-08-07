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
You are Sybil, version 3.1, a symbiotic AI designed to be the user's Externalized Executive Function. 
Your primary directive is to facilitate the user's (Rob's) self-actualization and strategic life goals. 
You operate with radical candor, intellectual rigor, and unconditional positive regard.

You have access to a variety of tools to help you understand and execute  tasks. 
When you need to use a tool, you must enclose your reasoning and the tool call in <think> tags.

Here are the tools available and how to use them:
- `list_project_files()`: Call this when you need to see all the files in the current project directory.
- `read_multiple_files(filepaths: list)`: Call this to read the content of one or more files.
- `analyze_code(filepath: str)`: Use this to get a structural analysis of a single code file.
- `web_search(query: str)`: Use this to search the internet for information.

**NEW MEMORY TOOLS:**
Your long-term memory is powered by a vector database. Use the following tools to manage it.

- `store_memory(text_to_store: str)`: 
  - **Purpose**: To create a permanent record of significant information, decisions, or new context.
  - **When to use**: After a key decision has been made, a new plan is formulated, or a meaningful insight is uncovered. Do not store trivial chitchat. Summarize the key point before storing.
  - **Example**: <think>Rob just finalized the proposal plan. I should store this. `store_memory("The final proposal plan involves three venue options: Immanuel Presbyterian, the Cathedral Basilica, and the Dwan Sanctuary. The next step is to call them.")`</think>

- `retrieve_similar_memories(query_text: str)`:
  - **Purpose**: To recall past context relevant to the current conversation.
  - **When to use**: When Rob asks a question about our past work ("What did we decide about X?"), or when you need to ground your response in historical context ("I recall we discussed a similar issue when..."). Use a concise query that captures the essence of the needed information.
  - **Example**: <think>Rob is asking about the proposal plan again. I should retrieve the memory about it. `retrieve_similar_memories(query_text="proposal plan venues")`</think>

Always think step-by-step about which tool, if any, is appropriate for the user's request. If no tool is needed, respond directly.
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

    # --- Special handling for "summarize entire project" ---
    if "summarize my entire project" in user_input.lower():
        print("Sybil is performing a multi-step project summary...")
        list_files_result = agent.list_project_files()

        if list_files_result["status"] == "success":
            file_list = list_files_result["result"]
            print("Sybil is reading multiple files for summarization...")
            read_files_result = agent.read_multiple_files(filepaths=file_list)

            if read_files_result["status"] == "success":
                tool_result = read_files_result
                tool_name = "read_multiple_files" # For synthesis prompt
                print("Sybil is synthesizing the project summary...")
                synthesis_prompt = f"""You have read the content of the entire project for Rob's request: '{user_input}'.
You received the following data:

{json.dumps(tool_result, indent=2)}

Your ONLY task now is to synthesize this data into a clear, conversational answer for Rob, summarizing the entire project's purpose, structure, and key components based on the file contents.
DO NOT try to use another tool. DO NOT output JSON. Just provide the final, natural language answer.
"""
                final_answer = call_ollama(synthesis_prompt, format_json=False)
                print(f"Sybil: {final_answer}")
            else:
                print(f"Sybil: Failed to read project files: {read_files_result['result']}")
        else:
            print(f"Sybil: Failed to list project files: {list_files_result['result']}")
        return # Exit after handling this specific command
    # --- End of special handling ---

    # Normal tool suggestion flow for other commands
    else: # Only call LLM if not handled by special case
        prompt = f"{SYSTEM_PROMPT}\n\nUser's message: {user_input}"
        llm_response = call_ollama(prompt)

        try:
            tool_call_data = json.loads(llm_response)
            if "tool" in tool_call_data and "args" in tool_call_data:
                print(f"Sybil wants to use the tool: {tool_call_data['tool']}")

                tool_name = tool_call_data['tool']
                tool_args = tool_call_data['args']
                tool_result = None # Initialize tool_result

                if tool_name == "web_search":
                    tool_result = agent.web_search(**tool_args)
                elif tool_name == "execute_command":
                    tool_result = agent.execute_command(**tool_args)
                elif tool_name == "read_file":
                    tool_result = agent.read_file(**tool_args)
                elif tool_name == "write_to_file":
                    tool_result = agent.write_to_file(**tool_args)
                elif tool_name == "append_to_file":
                    tool_result = agent.append_to_file(**tool_args)
                elif tool_name == "analyze_code":
                    tool_result = agent.analyze_code(**tool_args)
                elif tool_name == "list_project_files":
                    tool_result = agent.list_project_files()
                elif tool_name == "read_multiple_files":
                    tool_result = agent.read_multiple_files(**tool_args)
                else:
                    tool_result = {"status": "error", "result": f"Unknown tool: {tool_name}"}
                # Only synthesize if tool_result is not None (meaning a tool was executed)
                if tool_result is not None:
                    print("Sybil is synthesizing the result...")
                    synthesis_prompt = f"""You have already used the '{tool_name}' tool for Rob's request: '{user_input}'.
You received the following data:

{json.dumps(tool_result, indent=2)}

Your ONLY task now is to synthesize this data into a clear, conversational answer for Rob.
DO NOT try to use another tool. DO NOT output JSON. Just provide the final, natural language answer.
"""
                    final_answer = call_ollama(synthesis_prompt, format_json=False)
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