# chimaera-multi-modal-agent/external-context-engine-ece/chimaera-multi-modal-agent-External-Context-Engine-ECE-5350fdcd697ef19de30a88acf572d9cfa56e536e/ece/agents/tier1/orchestrator/main.py
"""
Main entry point for the ECE Orchestrator Agent's FastAPI server.
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from xml.etree import ElementTree as ET
import json

# --- CRITICAL CHANGE: Use a relative import to find the agent file ---
from .orchestrator_agent import OrchestratorAgent

# Initialize the FastAPI app
app = FastAPI(
    title="ECE Orchestrator Agent",
    description="The central cognitive unit for the External Context Engine v2.0",
    version="2.0.0"
)

# Create a singleton instance of the OrchestratorAgent
orchestrator = OrchestratorAgent()

@app.on_event("startup")
async def startup_event():
    """
    Event handler for application startup.
    """
    print("Orchestrator agent (ECE v2.0) initializing...")
    print("Orchestrator initialized and ready to receive requests.")

@app.post("/process_prompt", response_class=PlainTextResponse)
async def process_prompt_endpoint(request: Request):
    """
    The primary endpoint for processing user prompts.
    """
    try:
        body = await request.body()
        poml_string = body.decode('utf-8')
        
        try:
            root = ET.fromstring(poml_string)
            prompt_element = root.find('.//prompt')
            if prompt_element is None or not prompt_element.text:
                raise ValueError("Prompt not found in POML payload")
            user_prompt = prompt_element.text.strip()
        except ET.ParseError:
            try:
                data = json.loads(poml_string)
                user_prompt = data.get("prompt")
                if not user_prompt:
                    raise ValueError("Prompt not found in JSON payload")
            except json.JSONDecodeError:
                raise ValueError("Invalid POML or JSON payload")

        final_response = await orchestrator.process_prompt(user_prompt)
        
        return PlainTextResponse(content=final_response)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Bad Request: {str(e)}")
    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/health")
def health_check():
    return JSONResponse(content={"status": "ok"})