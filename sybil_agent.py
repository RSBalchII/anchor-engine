# sybil_agent.py

# Import all tool functions
from tools.file_io import list_project_files, read_multiple_files
from tools.web_search import web_search
from tools.code_analyzer import analyze_code
from tools.memory_tool import store_memory, retrieve_similar_memories

class SybilAgent:
    """The agent responsible for managing and executing tools."""
    def __init__(self):
        # The central registry of all available tool functions
        self._TOOL_REGISTRY = {
            "list_project_files": list_project_files,
            "read_multiple_files": read_multiple_files,
            "analyze_code": analyze_code,
            "web_search": web_search,
            "store_memory": store_memory,
            "retrieve_similar_memories": retrieve_similar_memories,
        }

    def execute_tool(self, tool_name: str, tool_args: dict):
        """Looks up and executes a tool from the registry."""
        if tool_name not in self._TOOL_REGISTRY:
            return {"status": "error", "result": f"Unknown tool: {tool_name}"}
        
        tool_function = self._TOOL_REGISTRY[tool_name]
        
        try:
            # Handle tools that take no arguments, like list_project_files
            if not tool_args:
                return tool_function()
            else:
                return tool_function(**tool_args)
        except Exception as e:
            return {"status": "error", "result": f"Error executing tool '{tool_name}': {e}"}