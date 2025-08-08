# /tools/web_search.py

from duckduckgo_search import DDGS
import logging

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def web_search(query: str, num_results: int = 5) -> dict:
    """
    Performs a web search using the DuckDuckGo Search API.

    Args:
        query: The search query string.
        num_results: The maximum number of results to return.

    Returns:
        A dictionary with the status and a list of search results.
    """
    logging.info(f"Performing web search for: '{query}'")
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=num_results))
        
        if not results:
            return {"status": "success", "result": "No results found."}

        # Format the results for clarity
        formatted_results = [
            {
                "title": r.get("title"),
                "url": r.get("href"),
                "snippet": r.get("body"),
            }
            for r in results
        ]
        
        logging.info(f"Found {len(formatted_results)} results for query.")
        return {"status": "success", "result": formatted_results}
        
    except Exception as e:
        logging.error(f"An error occurred during web search: {e}")
        return {"status": "error", "result": f"An error occurred: {e}"}