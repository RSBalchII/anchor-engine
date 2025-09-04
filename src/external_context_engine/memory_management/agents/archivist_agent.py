"""
Enhanced Archivist Agent Implementation

This agent is responsible for managing memory storage and retrieval operations,
coordinating with the Q-Learning agent for optimal path finding, and building
context-aware summaries for the main LLM.
"""

import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import numpy as np
from pydantic import BaseModel, Field

from ..models import MemoryContext, MemoryPath, QueryPlan
from ..services import CacheManager, GPUAccelerator


logger = logging.getLogger(__name__)


class EnhancedArchivistAgent:
    """
    Enhanced Archivist Agent with async support and intelligent memory retrieval.
    
    This agent acts as the memory librarian of the ECE, working with the Q-Learning
    powered graph traversal system to find optimal paths through stored knowledge.
    """
    
    def __init__(
        self,
        llm,
        neo4j_manager,
        q_learning_agent=None,
        cache_manager: Optional[CacheManager] = None,
        gpu_accelerator: Optional[GPUAccelerator] = None,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the Enhanced Archivist Agent.
        
        Args:
            llm: Language model instance for NLP operations
            neo4j_manager: Neo4j database manager for graph operations
            q_learning_agent: Q-Learning agent for path optimization
            cache_manager: Cache manager for performance optimization
            gpu_accelerator: GPU accelerator for embedding operations
            config: Configuration dictionary
        """
        self.llm = llm
        self.graph_db = neo4j_manager
        self.qla = q_learning_agent
        self.cache = cache_manager or CacheManager()
        self.gpu = gpu_accelerator or GPUAccelerator()
        
        # Configuration
        self.config = config or {}
        self.max_tokens = self.config.get("max_tokens", 4096)
        self.max_hops = self.config.get("max_hops", 5)
        self.embedding_model = self.config.get("embedding_model", "all-MiniLM-L6-v2")
        
        # Initialize embedder (will be lazy-loaded with GPU support)
        self._embedder = None
        
        logger.info("Enhanced Archivist Agent initialized with async support")
    
    @property
    def embedder(self):
        """Lazy-load the embedding model with GPU support"""
        if self._embedder is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._embedder = SentenceTransformer(self.embedding_model)
                if self.gpu and self.gpu.cuda_available:
                    self._embedder = self._embedder.cuda()
                logger.info(f"Embedder initialized: {self.embedding_model}")
            except ImportError:
                logger.error("sentence-transformers not installed")
                raise ImportError("Please install sentence-transformers: pip install sentence-transformers")
        return self._embedder
    
    async def process_query(self, query: str, context: Optional[Dict[str, Any]] = None) -> MemoryContext:
        """
        Process a memory retrieval query and return relevant context.
        
        Args:
            query: Natural language query
            context: Optional additional context
            
        Returns:
            MemoryContext object with retrieved memories and metadata
        """
        start_time = datetime.utcnow()
        
        # Check cache first
        cache_key = f"query:{hash(query)}"
        cached_result = await self.cache.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for query: {query[:50]}...")
            return cached_result
        
        try:
            # Step 1: Parse query and extract concepts
            query_plan = await self._extract_concepts(query)
            logger.debug(f"Extracted concepts: {query_plan.concepts}")
            
            # Step 2: Generate embeddings (GPU accelerated)
            embeddings = await self._generate_embeddings(query_plan.concepts)
            
            # Step 3: Find relevant nodes in graph
            relevant_nodes = await self._semantic_search(embeddings)
            logger.debug(f"Found {len(relevant_nodes)} relevant nodes")
            
            # Step 4: Task Q-Learning Agent for optimal paths (if available)
            if self.qla:
                paths = await self.qla.find_paths(
                    start_nodes=relevant_nodes[:5],  # Top 5 most relevant
                    max_hops=self.max_hops
                )
            else:
                # Fallback to simple graph traversal
                paths = await self._simple_traversal(relevant_nodes)
            
            # Step 5: Build context from paths
            memory_context = await self._build_context(paths, query)
            
            # Calculate processing time
            memory_context.processing_time_ms = (
                datetime.utcnow() - start_time
            ).total_seconds() * 1000
            
            # Cache the result
            await self.cache.set(cache_key, memory_context, ttl=3600)
            
            logger.info(
                f"Query processed in {memory_context.processing_time_ms:.2f}ms, "
                f"found {len(paths)} paths"
            )
            
            return memory_context
            
        except Exception as e:
            logger.error(f"Error processing query: {str(e)}", exc_info=True)
            # Return empty context on error
            return MemoryContext(
                query=query,
                summary="Unable to retrieve memories due to an error.",
                paths=[],
                relevance_score=0.0,
                token_count=0,
                processing_time_ms=0
            )
    
    async def store_memory(self, structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store structured memory data in the knowledge graph.
        
        Args:
            structured_data: Structured memory data (typically from Distiller)
            
        Returns:
            Dictionary with created node and relationship IDs
        """
        try:
            result = {"nodes": [], "relationships": []}
            
            # Extract concepts and relationships
            concepts = structured_data.get("key_concepts", [])
            relationships = structured_data.get("relationships", [])
            metadata = structured_data.get("metadata", {})
            
            # Create concept nodes
            for concept in concepts:
                node_query = """
                MERGE (c:Concept {name: $name})
                SET c.updated_at = datetime(),
                    c.frequency = COALESCE(c.frequency, 0) + 1
                RETURN id(c) as node_id
                """
                node_result = await self._execute_cypher(node_query, {"name": concept})
                if node_result:
                    result["nodes"].append(node_result[0]["node_id"])
            
            # Create relationships
            for rel in relationships:
                rel_query = """
                MATCH (a:Concept {name: $from})
                MATCH (b:Concept {name: $to})
                MERGE (a)-[r:RELATES_TO {type: $type}]->(b)
                SET r.strength = COALESCE(r.strength, 0.0) + $strength,
                    r.updated_at = datetime()
                RETURN id(r) as rel_id
                """
                params = {
                    "from": rel.get("from"),
                    "to": rel.get("to"),
                    "type": rel.get("type", "RELATES_TO"),
                    "strength": rel.get("strength", 0.1)
                }
                rel_result = await self._execute_cypher(rel_query, params)
                if rel_result:
                    result["relationships"].append(rel_result[0]["rel_id"])
            
            # Update Q-Learning agent if available
            if self.qla:
                await self.qla.update_q_values(result["nodes"], reward=1.0)
            
            logger.info(
                f"Stored memory: {len(result['nodes'])} nodes, "
                f"{len(result['relationships'])} relationships"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error storing memory: {str(e)}", exc_info=True)
            raise
    
    async def _extract_concepts(self, query: str) -> QueryPlan:
        """
        Extract concepts and intent from natural language query.
        
        Uses LLM for Named Entity Recognition and query understanding.
        """
        prompt = f"""
        Extract key concepts and query intent from the following question.
        Return as JSON with 'concepts' (list of key terms) and 'intent' 
        (one of: factual, exploratory, temporal, relationship).
        
        Query: {query}
        
        JSON Response:
        """
        
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            data = json.loads(response)
            
            return QueryPlan(
                concepts=data.get("concepts", []),
                intent=data.get("intent", "factual"),
                original_query=query
            )
        except (json.JSONDecodeError, KeyError) as e:
            # Fallback to simple keyword extraction
            logger.warning(f"LLM concept extraction failed, using fallback: {e}")
            keywords = [w for w in query.split() if len(w) > 3]
            return QueryPlan(
                concepts=keywords,
                intent="factual",
                original_query=query
            )
    
    async def _generate_embeddings(self, concepts: List[str]) -> np.ndarray:
        """
        Generate embeddings for concepts using GPU acceleration.
        """
        if not concepts:
            return np.array([])
        
        # Use GPU accelerator for batch processing
        embeddings = await self.gpu.batch_embeddings(
            texts=concepts,
            model=self.embedder,
            batch_size=32
        )
        
        return embeddings
    
    async def _semantic_search(self, embeddings: np.ndarray) -> List[Dict[str, Any]]:
        """
        Perform semantic search in the knowledge graph using embeddings.
        """
        # For now, return a simple text search as embeddings aren't stored yet
        # This will be enhanced when vector indices are added to Neo4j
        
        nodes = []
        for i, embedding in enumerate(embeddings):
            # Temporary: Use text search instead of vector similarity
            query = """
            MATCH (c:Concept)
            WHERE c.name CONTAINS $search_term
            RETURN c.name as name, id(c) as id, c.frequency as frequency
            ORDER BY c.frequency DESC
            LIMIT 10
            """
            # Use the corresponding concept text for search
            # This is a placeholder until vector search is implemented
            results = await self._execute_cypher(query, {"search_term": ""})
            nodes.extend(results or [])
        
        return nodes
    
    async def _simple_traversal(self, start_nodes: List[Dict[str, Any]]) -> List[MemoryPath]:
        """
        Perform simple graph traversal when Q-Learning agent is not available.
        """
        paths = []
        
        for node in start_nodes[:3]:  # Limit to top 3 nodes
            query = """
            MATCH path = (start:Concept {name: $name})-[*1..3]-(related:Concept)
            RETURN path, length(path) as path_length
            ORDER BY path_length
            LIMIT 5
            """
            results = await self._execute_cypher(query, {"name": node.get("name")})
            
            for result in (results or []):
                # Convert Neo4j path to MemoryPath object
                memory_path = MemoryPath(
                    nodes=[node.get("name", "Unknown")],  # Simplified for now
                    relationships=[],
                    score=1.0 / (result.get("path_length", 1) + 1),
                    length=result.get("path_length", 0)
                )
                paths.append(memory_path)
        
        return paths
    
    async def _build_context(self, paths: List[MemoryPath], query: str) -> MemoryContext:
        """
        Build coherent context from retrieved memory paths.
        """
        if not paths:
            return MemoryContext(
                query=query,
                summary="No relevant memories found.",
                paths=[],
                relevance_score=0.0,
                token_count=0,
                processing_time_ms=0
            )
        
        # Extract information from paths
        all_concepts = set()
        for path in paths:
            all_concepts.update(path.nodes)
        
        # Build summary (simplified for now)
        summary = f"Found {len(paths)} memory paths related to your query. "
        summary += f"Key concepts: {', '.join(list(all_concepts)[:10])}"
        
        # Calculate relevance score
        avg_score = sum(p.score for p in paths) / len(paths) if paths else 0.0
        
        # Estimate token count (rough estimate)
        token_count = len(summary.split()) * 1.3  # Rough token estimation
        
        return MemoryContext(
            query=query,
            summary=summary,
            paths=paths,
            relevance_score=avg_score,
            token_count=int(token_count),
            processing_time_ms=0  # Will be set by caller
        )
    
    async def _execute_cypher(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Execute a Cypher query asynchronously.
        """
        try:
            # Run in thread pool to avoid blocking
            result = await asyncio.to_thread(
                self.graph_db.execute_query,
                query,
                parameters or {}
            )
            return result
        except Exception as e:
            logger.error(f"Cypher query failed: {str(e)}")
            return []
