# ece_client.py

import httpx
from rich.console import Console
from rich.markdown import Markdown
import configparser
import os
import json
import asyncio

# Initialize rich console for better output
console = Console()

def get_orchestrator_url():
    """
    Get the Orchestrator URL from environment variables or a config file.
    """
    url = os.getenv('ECE_ORCHESTRATOR_URL')
    if url:
        return url
    
    config = configparser.ConfigParser()
    if os.path.exists('config.ini'):
        config.read('config.ini')
        if 'client' in config and 'orchestrator_url' in config['client']:
            return config['client']['orchestrator_url']
            
    return "http://localhost:8000/process_prompt"

async def main():
    """
    Main asynchronous function to run the ECE client.
    """
    orchestrator_url = get_orchestrator_url()
    console.print(f"[bold green]Connecting to ECE Orchestrator at:[/bold green] {orchestrator_url}")
    console.print("Type 'exit' or 'quit' to terminate the client.")

    async with httpx.AsyncClient(timeout=None) as client:
        while True:
            try:
                # --- CRITICAL CHANGE: REMOVED 'await' ---
                # console.input() is a synchronous function and does not need to be awaited.
                prompt_text = console.input("[bold cyan]ECE>[/bold cyan] ")

                if prompt_text.lower() in ['exit', 'quit']:
                    break
                
                if not prompt_text:
                    continue

                payload = {"prompt": prompt_text}
                
                console.print("\n[yellow]Sending request to Orchestrator...[/yellow]")
                
                async with client.stream("POST", orchestrator_url, json=payload) as response:
                    if response.status_code != 200:
                        error_detail = await response.aread()
                        console.print(f"[bold red]HTTP Error: {response.status_code} - {error_detail.decode()}[/bold red]")
                        continue

                    console.print("[bold green]Response from Orchestrator:[/bold green]")
                    async for chunk in response.aiter_text():
                        print(chunk, end="", flush=True)
                    print("\n")

            except httpx.RequestError as e:
                console.print(f"\n[bold red]Connection Error:[/bold red] Could not connect to the ECE Orchestrator. Please ensure the ECE is running.")
            except KeyboardInterrupt:
                break
            except Exception as e:
                console.print(f"\n[bold red]An unexpected error occurred:[/bold red] {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nClient terminated.")