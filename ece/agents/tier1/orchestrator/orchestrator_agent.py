# chimaera-multi-modal-agent/external-context-engine-ece/chimaera-multi-modal-agent-External-Context-Engine-ECE-5350fdcd697ef19de30a88acf572d9cfa56e536e/ece/agents/tier1/orchestrator/orchestrator_agent.py
"""
Orchestrator Agent for the External Context Engine (ECE) v2.0 (Async).

This module implements the core logic for the Orchestrator agent using a fully
asynchronous model to align with the FastAPI server and enable non-blocking I/O.
"""

import os
import httpx
import asyncio
import yaml
from typing import Optional, Dict, Any, List
from xml.etree import ElementTree as ET

from ece.agents.tier2.conversational_agent import ConversationalAgent
from ece.agents.tier2.explorer_agent import ExplorerAgent
from ece.agents.tier2.critique_agent import CritiqueAgent
from ece.agents.tier2.web_search_agent import WebSearchAgent
from ece.common.sandbox import run_code_in_sandbox

class BaseThinker:
    def __init__(self, name="Default", model=None):
        self.name = name
        self.model = model
        self.ollama_endpoint = "http://host.docker.internal:11434/api/chat"
        self.system_prompt = f"You are a helpful AI assistant acting as the '{self.name}' Thinker. Provide a concise analysis from this specific perspective."

    async def think(self, prompt: str) -> str:
        print(f"  -> {self.name} Thinker processing with model {self.model}...")
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt}
            ],
            "stream": False
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(self.ollama_endpoint, json=payload)
                response.raise_for_status()
                
                data = response.json()
                content = data.get('message', {}).get('content', '')
                
                # Wrap the response in POML format
                return f"<poml><perspective thinker='{self.name}'><analysis>{content}</analysis></perspective>"

        except httpx.RequestError as e:
            error_message = f"HTTP request failed: {e.__class__.__name__} - {e}"
            print(f"Error in {self.name} Thinker: {error_message}")
            return f"<poml><perspective thinker='{self.name}'><analysis>Error: {error_message}</analysis></perspective>"
        except Exception as e:
            error_message = f"An unexpected error occurred: {e}"
            print(f"Error in {self.name} Thinker: {error_message}")
            return f"<poml><perspective thinker='{self.name}'><analysis>Error: {error_message}</analysis></perspective>"


class SynthesisThinker(BaseThinker):
    def __init__(self, name="Synthesis", model=None):
        super().__init__(name, model)
        self.system_prompt = "You are a master synthesizer. Your job is to take multiple, diverse perspectives on a topic and combine them into a single, coherent, and easy-to-read final analysis."

    async def think(self, prompt: str) -> str:
        print(f"  -> {self.name} Thinker processing with model {self.model}...")
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt}
            ],
            "stream": False
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(self.ollama_endpoint, json=payload)
                response.raise_for_status()
                
                data = response.json()
                # The final synthesis does not need to be wrapped in POML
                return data.get('message', {}).get('content', '')

        except httpx.RequestError as e:
            error_message = f"HTTP request failed: {e.__class__.__name__} - {e}"
            print(f"Error in {self.name} Thinker: {error_message}")
            return f"Error during synthesis: {error_message}"
        except Exception as e:
            error_message = f"An unexpected error occurred: {e}"
            print(f"Error in {self.name} Thinker: {error_message}")
            return f"An unexpected error occurred during synthesis: {e}"

def get_all_thinkers(config):
    model = config['agents']['ThinkerAgent']['default_model']
    return [BaseThinker(name, model=model) for name in ["Optimist", "Pessimist", "Creative", "Analytical", "Pragmatic"]]


class OrchestratorAgent:
    """
    The main async class for the Orchestrator agent.
    """
    def __init__(self):
        with open('config.yaml', 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.client = httpx.AsyncClient(timeout=60.0)
        self.thinkers = get_all_thinkers(self.config)
        # --- CRITICAL ADDITION: A dedicated thinker for the final synthesis ---
        synthesis_model = self.config['agents']['SynthesisThinker']['default_model']
        self.synthesis_thinker = SynthesisThinker(model=synthesis_model)

        # Initialize agents for routing
        self.conversational_agent = ConversationalAgent(model=self.config['agents']['ThinkerAgent']['default_model'])
        
        explorer_model = self.config['agents']['ExplorerAgent']['default_model']
        self.explorer_agent = ExplorerAgent(model=explorer_model)

        critique_model = self.config['agents']['CritiqueAgent']['default_model']
        critique_threshold = self.config['agents']['CritiqueAgent']['success_threshold']
        self.critique_agent = CritiqueAgent(model=critique_model, success_threshold=critique_threshold)

        self.web_search_agent = WebSearchAgent()

        # Add other agents here as they are implemented and configured
        self.agents = {
            "ConversationalAgent": self.conversational_agent,
            "ExploratoryAgent": self.explorer_agent, # Add ExploratoryAgent to the agents dictionary
            "WebSearchAgent": self.web_search_agent,
            # "MultiModalIngestionAgent": MultiModalIngestionAgent(), # Example for future
            # ...
        }

    async def _execute_parallel_thinking(self, prompt: str) -> List[str]:
        print("Executing parallel thinking...")
        tasks = [thinker.think(prompt) for thinker in self.thinkers]
        perspectives = await asyncio.gather(*tasks, return_exceptions=True)
        
        processed_perspectives = []
        for i, p in enumerate(perspectives):
            thinker_name = self.thinkers[i].name
            if isinstance(p, Exception):
                print(f"Error getting perspective from {thinker_name} Thinker: {p}")
                processed_perspectives.append(f"<poml><perspective thinker='{thinker_name}'><analysis>Error: Could not generate perspective.</analysis></perspective></poml>")
            else:
                print(f"Received perspective from {thinker_name} Thinker")
                processed_perspectives.append(p)
        return processed_perspectives

    async def _synthesize_parallel_response(self, prompt: str, parallel_results: List[str]) -> str:
        """
        --- CRITICAL CHANGE ---
        This now constructs a final prompt and calls the SynthesisThinker.
        """
        print("Synthesizing parallel responses with a final LLM call...")
        
        # 1. Construct a new prompt for the synthesis agent
        synthesis_prompt = f"""Synthesize the following diverse perspectives into a single, final analysis. The original user query was: '{prompt}'.

--- Perspectives ---
"""
        for perspective_poml in parallel_results:
            try:
                root = ET.fromstring(perspective_poml)
                thinker_name = root.find('.//perspective').get('thinker', 'Unknown')
                analysis = root.find('.//analysis')
                if analysis is not None and analysis.text:
                    synthesis_prompt += f"\n* {thinker_name}'s View: {analysis.text.strip()}"
            except ET.ParseError:
                continue # Skip unparseable perspectives
        
        # 2. Call the synthesis thinker with the combined prompt
        final_answer = await self.synthesis_thinker.think(synthesis_prompt)
        return final_answer

    async def _execute_exploratory_problem_solving(self, prompt: str, max_iterations: int = 5) -> str:
        print(f"Executing exploratory problem-solving for prompt: '{prompt}'")
        iteration_history = []
        current_solution = ""

        for i in range(max_iterations):
            print(f"Exploratory Loop - Iteration {i + 1}/{max_iterations}")

            # 1. Call the ExplorerAgent to propose a solution
            explorer_response = await self.explorer_agent.explore(prompt, current_solution, iteration_history)
            
            # Extract code from the explorer's response (assuming it's in a specific format)
            # For now, let's assume the explorer returns a string that might contain code blocks.
            # A more robust solution would involve a structured output from ExplorerAgent.
            code_to_execute = self._extract_code_from_explorer_response(explorer_response)

            execution_result = ""
            if code_to_execute:
                # 2. Execute code safely using the run_code_in_sandbox function
                print("Executing code in sandbox...")
                execution_result = await run_code_in_sandbox(code_to_execute)
                print(f"Sandbox execution result: {execution_result}")
            else:
                execution_result = "No executable code found in explorer's response."
                print(execution_result)

            # 3. Call the CritiqueAgent to score the result of the execution
            critique_response = await self.critique_agent.critique(prompt, explorer_response, execution_result)
            score = self._extract_score_from_critique(critique_response) # Assuming critique returns a score

            print(f"Critique score: {score}")

            # 4. Check if the score meets the success threshold. If so, break the loop.
            if score >= self.critique_agent.success_threshold:
                print(f"Success! Score {score} meets threshold {self.critique_agent.success_threshold}.")
                return f"Exploratory problem-solving successful. Final solution: {explorer_response}\nExecution Result: {execution_result}"
            else:
                print(f"Score {score} below threshold. Refining solution...")
                # 5. Feed the critique back into the ExplorerAgent to generate a refined proposal
                iteration_history.append({
                    "iteration": i + 1,
                    "explorer_response": explorer_response,
                    "execution_result": execution_result,
                    "critique_response": critique_response,
                    "score": score
                })
                current_solution = explorer_response # Or a more refined way to feed back critique

        print("Exploratory problem-solving reached maximum iterations without success.")
        return f"Exploratory problem-solving failed after {max_iterations} iterations. Last solution: {current_solution}\nLast Execution Result: {execution_result}"

    def _extract_code_from_explorer_response(self, response: str) -> str:
        # This is a placeholder. A real implementation would parse the explorer's output
        # to find code blocks, e.g., using regex or a more structured output format.
        # For now, let's assume code is enclosed in ```python ... ```
        import re
        match = re.search(r"```python\n(.*?)```", response, re.DOTALL)
        if match:
            return match.group(1).strip()
        return ""

    def _extract_score_from_critique(self, critique_response: str) -> float:
        # This is a placeholder. A real implementation would parse the critique's output
        # to find the score. For now, let's assume the critique returns "SCORE: 0.X"
        import re
        match = re.search(r"SCORE:\s*(\d+\.?\d*)", critique_response)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        return 0.0 # Default to 0 if score not found or unparseable
    
    def _route_prompt(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        intents = self.config['orchestrator']['decision_tree']['intents']

        # Prioritize parallel_thinking intent
        parallel_thinking_intent = intents.get('parallel_thinking')
        if parallel_thinking_intent:
            for keyword in parallel_thinking_intent['keywords']:
                if keyword.lower() in prompt_lower:
                    return parallel_thinking_intent['agent']

        # Prioritize exploratory_problem_solving intent
        exploratory_intent = intents.get('exploratory_problem_solving')
        if exploratory_intent:
            for keyword in exploratory_intent['keywords']:
                if keyword.lower() in prompt_lower:
                    return exploratory_intent['agent']

        # Check other intents
        for intent_name, intent_data in intents.items():
            if intent_name in ['parallel_thinking', 'exploratory_problem_solving']: # Skip, already checked
                continue
            for keyword in intent_data['keywords']:
                if keyword.lower() in prompt_lower:
                    return intent_data['agent']
        
        return self.config['orchestrator']['decision_tree']['default_agent']

    async def process_prompt(self, prompt: str) -> str:
        print(f"Orchestrator processing prompt: '{prompt}'")

        target_agent_name = self._route_prompt(prompt)
        print(f"Routing to: {target_agent_name}")

        if target_agent_name == "ConversationalAgent":
            return await self.conversational_agent.respond(prompt)
        elif target_agent_name == "ThinkerAgent": # This implies parallel thinking
            parallel_results = await self._execute_parallel_thinking(prompt)
            final_response = await self._synthesize_parallel_response(prompt, parallel_results)
            return final_response
        elif target_agent_name == "ExploratoryAgent":
            return await self._execute_exploratory_problem_solving(prompt)
        elif target_agent_name == "WebSearchAgent":
            return await self.web_search_agent.search(prompt)
        else:
            # Handle other agents as they are implemented
            return f"Query received: '{prompt}'. Routed to {target_agent_name}. This agent is not yet fully integrated."
