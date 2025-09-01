# tools/ece_tools.py
# This file contains the implementation of the core tools for the
# External Context Engine (ECE), used by the OrchestraAgent.

from youtu_agent.tool import Tool
from pydantic import BaseModel, Field

# === Input Schemas for Tools ===
# Using Pydantic models to define clear, validated input schemas for each tool.

class DistillInput(BaseModel):
    """Input schema for the DistillerAgent tool."""
    raw_text: str = Field(description="The raw, unstructured text from a session log or document to be distilled.")

# === Tool Implementations ===

class DistillerAgent(Tool):
    """
    A tool that embodies the DistillerAgent. It takes a large block of raw text
    and uses an LLM to distill it into a structured summary of high-coherency
    insights and key conceptual relationships.
    """
    def __init__(self, llm):
        super().__init__()
        self.llm = llm  # The tool is initialized with an LLM instance by the framework
        self.name = "DistillerAgent"
        self.description = (
            "Analyzes raw text (e.g., session logs) to identify and summarize key insights, "
            "decisions, and conceptual relationships. Use this to process unstructured data."
        )
        self.input_model = DistillInput

    def _run(self, tool_input: DistillInput) -> str:
        """
        The core logic for the DistillerAgent tool.
        This function will be executed when the OrchestraAgent calls this tool.
        """
        print(f"🕵️  DistillerAgent activated. Analyzing text...")

        # A simple, direct prompt to the LLM to perform the distillation.
        # This can be replaced with a more complex chain or prompt template later.
        prompt = f"""
        You are an expert data distiller. Analyze the following text and extract the most
        critical insights, key decisions, and conceptual relationships.
        Present the output as a concise, structured summary.

        Raw Text:
        ---
        {tool_input.raw_text}
        ---

        Distilled Summary:
        """

        try:
            response = self.llm.invoke(prompt)
            print("✅ Distillation complete.")
            return response
        except Exception as e:
            print(f"❌ ERROR in DistillerAgent: {e}")
            return f"An error occurred during distillation: {e}"

# We will add the ArchivistAgent, ExtractorAgent, and InjectorAgent classes here
# in subsequent steps.