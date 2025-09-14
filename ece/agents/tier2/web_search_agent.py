import os
from tavily import TavilyClient

class WebSearchAgent:
    def __init__(self):
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        if not self.tavily_api_key:
            raise ValueError("TAVILY_API_KEY environment variable not set.")
        self.tavily_client = TavilyClient(api_key=self.tavily_api_key)

    async def search(self, query: str) -> str:
        print(f"  -> WebSearchAgent performing Tavily search for query: '{query}'...")
        try:
            response = self.tavily_client.search(query=query, search_depth="advanced")
            # Assuming the response object has a 'results' attribute with a list of dictionaries
            # and each dictionary has a 'content' key.
            search_results = "\n".join([f"Source: {result['url']}\nContent: {result['content']}\n" for result in response['results']])
            return search_results
        except Exception as e:
            error_message = f"An error occurred during Tavily search: {e}"
            print(f"Error in WebSearchAgent: {error_message}")
            return f"Error: {error_message}"