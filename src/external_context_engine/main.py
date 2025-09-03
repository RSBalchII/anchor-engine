# src/external_context_engine/main.py
# Main entrypoint for the Chimaera External Context Engine (ECE).

from dotenv import load_dotenv
load_dotenv() # Load environment variables from .env

import yaml
import os
from .orchestrator import Orchestrator
from fastapi import FastAPI
from pydantic import BaseModel

# --- API Data Models ---
class ChatRequest(BaseModel):
    prompt: str

# --- FastAPI App Initialization ---
app = FastAPI(
    title="External Context Engine (ECE)",
    description="An agentic system with a persistent memory.",
    version="1.0.0"
)

# --- Orchestrator Singleton ---
# Load the configuration and initialize the orchestrator once at startup
def find_config_path():
    """Finds the correct path for config.yaml."""
    # This handles running from the project root (e.g. docker-compose)
    if os.path.exists('config.yaml'):
        return 'config.yaml'
    # This handles running from within the src/external_context_engine dir
    elif os.path.exists('../../../config.yaml'):
        return '../../../config.yaml'
    else:
        return None

config_path = find_config_path()
if not config_path:
    raise RuntimeError("Could not find config.yaml")

with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

orchestrator = Orchestrator(config=config['OrchestraAgent'])
print("✅ Orchestrator initialized and ready.")


# --- API Endpoints ---
@app.post("/chat", response_model=dict)
async def chat_with_orchestrator(request: ChatRequest):
    """
    Receives a user prompt and returns the orchestrator's response.
    """
    print(f"Received request for /chat: {request.prompt}")
    response = orchestrator.run(request.prompt)
    return {"response": response}

@app.get("/", response_model=dict)
async def root():
    return {"message": "ECE is online and awaiting POST requests to /chat"}