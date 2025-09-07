"""
Injector Agent for the External Context Engine
"""
from typing import Dict, Any, Optional, List
import logging
import json
from src.external_context_engine.tools.cache_manager import CacheManager
from src.external_context_engine.tools.archivist_agent import ArchivistAgent

logger = logging.getLogger(__name__)


class ContextQuery:
    """Data model for a context query."""
    def __init__(self, query_text: str, query_embedding: Optional[List[float]] = None, 
                 max_cache_results: int = 3, max_graph_results: int = 5):
        self.query_text = query_text
        self.query_embedding = query_embedding
        self.max_cache_results = max_cache_results
        self.max_graph_results = max_graph_results


class AugmentedPrompt:
    """Data model for an augmented prompt."""
    def __init__(self, original_prompt: str, augmented_prompt: str, 
                 context_sources: List[str], confidence_score: float = 0.0):
        self.original_prompt = original_prompt
        self.augmented_prompt = augmented_prompt
        self.context_sources = context_sources
        self.confidence_score = confidence_score


class InjectorAgent:
    """
    Agent responsible for injecting processed context and information 
    into the appropriate systems or workflows.
    
    The InjectorAgent intelligently queries both the short-term (Redis) 
    and long-term (Neo4j) memory to augment user prompts before they 
    are sent to the final LLM.
    """
    
    def __init__(self, cache_manager: CacheManager, archivist_agent: ArchivistAgent, 
                 config: Optional[Dict[str, Any]] = None):
        """
        Initialize the InjectorAgent.
        
        Args:
            cache_manager: CacheManager instance for Redis operations
            archivist_agent: ArchivistAgent instance for Neo4j operations
            config: Configuration dictionary for the agent
        """
        self.config = config or {}
        self.cache_manager = cache_manager
        self.archivist_agent = archivist_agent
        self.name = "InjectorAgent"
        self.description = "Injects processed context and information into appropriate systems or workflows"
        
    async def analyze_prompt(self, prompt: str) -> ContextQuery:
        """
        Analyze a prompt to determine context needs.
        
        Args:
            prompt: The user prompt to analyze
            
        Returns:
            ContextQuery object with analysis results
        """
        logger.info(f"Analyzing prompt: {prompt}")
        
        # For now, we'll create a simple context query
        # In a more advanced implementation, this would use NLP to extract entities and keywords
        context_query = ContextQuery(
            query_text=prompt,
            query_embedding=None,  # Would be generated with an embedding model in a full implementation
            max_cache_results=self.config.get("max_cache_results", 3),
            max_graph_results=self.config.get("max_graph_results", 5)
        )
        
        return context_query
    
    async def retrieve_context(self, query: ContextQuery) -> List[Dict]:
        """
        Retrieve context from memory layers.
        
        First checks the Redis cache, then queries the Neo4j graph if needed.
        
        Args:
            query: ContextQuery object with query parameters
            
        Returns:
            List of context dictionaries
        """
        context_results = []
        context_sources = []
        
        try:
            # First, try to get context from Redis cache
            logger.info("Querying Redis cache for context")
            
            if query.query_embedding:
                # Semantic search in cache
                cache_results = await self.cache_manager.semantic_search(
                    query.query_embedding, 
                    threshold=0.7  # Configurable threshold
                )
                
                # Limit results
                cache_results = cache_results[:query.max_cache_results]
                
                for entry in cache_results:
                    context_results.append({
                        "source": "cache",
                        "content": entry.value,
                        "key": entry.key,
                        "similarity": 0.8  # Would be actual similarity score in full implementation
                    })
                    context_sources.append(f"cache:{entry.key}")
            else:
                # For now, we'll do a simple keyword-based search
                # In a full implementation, this would be more sophisticated
                logger.info("Performing keyword-based cache search")
                
                # This is a simplified approach - in practice, you might want to implement
                # a more sophisticated keyword matching or use a search engine
                stats = await self.cache_manager.get_stats()
                if stats.size > 0:
                    # Just get some recent entries as examples
                    # In a real implementation, this would be a proper search
                    pass
            
            # If we didn't get enough context from cache, query the graph
            if len(context_results) < query.max_cache_results:
                logger.info("Querying Neo4j graph for additional context")
                
                # Create a simple query for the archivist
                # In a full implementation, this would be more sophisticated
                try:
                    # This is a simplified example - in practice, you'd want to create
                    # a proper query based on the analysis of the prompt
                    graph_context = await self.archivist_agent.retrieve({
                        "query_type": "keyword_search",
                        "keywords": query.query_text.split(),
                        "limit": query.max_graph_results
                    })
                    
                    if graph_context and "results" in graph_context:
                        for item in graph_context["results"][:query.max_graph_results]:
                            context_results.append({
                                "source": "graph",
                                "content": str(item),
                                "similarity": 0.6  # Lower confidence for graph results
                            })
                            context_sources.append("graph")
                except Exception as e:
                    logger.warning(f"Failed to retrieve context from graph: {e}")
            
            logger.info(f"Retrieved {len(context_results)} context items")
            return context_results
            
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return []
    
    def augment_prompt(self, original_prompt: str, context: List[Dict]) -> AugmentedPrompt:
        """
        Augment a prompt with retrieved context.
        
        Args:
            original_prompt: The original user prompt
            context: List of context dictionaries
            
        Returns:
            AugmentedPrompt object with the enhanced prompt
        """
        if not context:
            # No context to add, return original prompt
            return AugmentedPrompt(
                original_prompt=original_prompt,
                augmented_prompt=original_prompt,
                context_sources=[],
                confidence_score=0.0
            )
        
        # Calculate overall confidence score
        total_similarity = sum(item.get("similarity", 0) for item in context)
        confidence_score = min(total_similarity / len(context), 1.0) if context else 0.0
        
        # Extract context sources
        context_sources = list(set(item.get("source", "unknown") for item in context))
        
        # Create context section
        context_texts = [item.get("content", "") for item in context if item.get("content")]
        context_section = "\n".join(context_texts)
        
        # Augment the prompt
        if context_section:
            augmented_prompt = f"""Context Information:
{context_section}

Original Prompt:
{original_prompt}

Please consider the provided context information when responding to the original prompt."""
        else:
            augmented_prompt = original_prompt
        
        logger.info(f"Augmented prompt with {len(context)} context items")
        
        return AugmentedPrompt(
            original_prompt=original_prompt,
            augmented_prompt=augmented_prompt,
            context_sources=context_sources,
            confidence_score=confidence_score
        )
    
    async def process(self, user_prompt: str) -> AugmentedPrompt:
        """
        Full end-to-end processing of a user prompt.
        
        Args:
            user_prompt: The original user prompt
            
        Returns:
            AugmentedPrompt object with the enhanced prompt
        """
        logger.info(f"Processing user prompt: {user_prompt}")
        
        # Analyze the prompt to determine context needs
        context_query = await self.analyze_prompt(user_prompt)
        
        # Retrieve context from memory layers
        context = await self.retrieve_context(context_query)
        
        # Augment the prompt with retrieved context
        augmented_prompt = self.augment_prompt(user_prompt, context)
        
        return augmented_prompt
    
    async def execute(self, data: Dict[str, Any], target_system: str = "llm", **kwargs) -> Dict[str, Any]:
        """
        Inject data into the specified target system.
        
        For the InjectorAgent, this typically means processing a user prompt
        and preparing it for the final LLM.
        
        Args:
            data: The data to inject (expected to contain a 'prompt' key)
            target_system: The target system (default: "llm")
            **kwargs: Additional parameters for the injection
            
        Returns:
            Dictionary containing injection results
        """
        logger.info(f"Injecting data into {target_system} with InjectorAgent")
        
        try:
            # Extract the prompt from data
            user_prompt = data.get("prompt", "")
            if not user_prompt:
                # Try to get from message field
                user_prompt = data.get("message", "")
            
            if not user_prompt:
                raise ValueError("No prompt or message found in data")
            
            # Process the prompt to add context
            augmented_prompt = await self.process(user_prompt)
            
            # Prepare results
            results = {
                "original_prompt": augmented_prompt.original_prompt,
                "augmented_prompt": augmented_prompt.augmented_prompt,
                "context_sources": augmented_prompt.context_sources,
                "confidence_score": augmented_prompt.confidence_score,
                "target_system": target_system,
                "injection_status": "success",
                "agent": self.name
            }
            
            logger.info(f"Successfully processed and augmented prompt with confidence score: {augmented_prompt.confidence_score}")
            return results
            
        except Exception as e:
            logger.error(f"Error processing prompt with InjectorAgent: {e}")
            return {
                "original_data": data,
                "target_system": target_system,
                "injection_status": "error",
                "error_message": str(e),
                "agent": self.name
            }