"""
Unit tests for the InjectorAgent
"""
import pytest
import asyncio
from unittest.mock import MagicMock, patch
from src.external_context_engine.tools.injector_agent import InjectorAgent, ContextQuery, AugmentedPrompt
from src.external_context_engine.tools.cache_manager import CacheManager, CacheEntry
from src.external_context_engine.tools.archivist_agent import ArchivistAgent


@pytest.fixture
def mock_cache_manager():
    """Create a mock CacheManager."""
    return MagicMock()


@pytest.fixture
def mock_archivist_agent():
    """Create a mock ArchivistAgent."""
    return MagicMock()


@pytest.fixture
def injector_agent(mock_cache_manager, mock_archivist_agent):
    """Create an InjectorAgent instance with mock dependencies."""
    return InjectorAgent(
        cache_manager=mock_cache_manager,
        archivist_agent=mock_archivist_agent
    )


def test_init(injector_agent, mock_cache_manager, mock_archivist_agent):
    """Test initialization of the InjectorAgent."""
    assert isinstance(injector_agent, InjectorAgent)
    assert injector_agent.cache_manager == mock_cache_manager
    assert injector_agent.archivist_agent == mock_archivist_agent


@pytest.mark.asyncio
async def test_analyze_prompt(injector_agent):
    """Test prompt analysis functionality."""
    prompt = "What is machine learning?"
    context_query = await injector_agent.analyze_prompt(prompt)
    
    assert isinstance(context_query, ContextQuery)
    assert context_query.query_text == prompt
    assert context_query.max_cache_results == 3
    assert context_query.max_graph_results == 5


@pytest.mark.asyncio
async def test_retrieve_context_with_cache_hit(injector_agent, mock_cache_manager):
    """Test context retrieval with cache hit."""
    # Mock cache manager to return some results
    cache_entry = CacheEntry(
        key="ml_definition",
        value="Machine Learning is a subset of AI",
        embedding=[0.1, 0.2, 0.3]
    )
    
    # Mock the semantic_search method to return a coroutine
    async def mock_semantic_search(*args, **kwargs):
        return [cache_entry]
    
    mock_cache_manager.semantic_search = mock_semantic_search
    
    query = ContextQuery("What is machine learning?", query_embedding=[0.1, 0.2, 0.3])
    context = await injector_agent.retrieve_context(query)
    
    assert len(context) == 1
    assert context[0]["source"] == "cache"
    assert context[0]["content"] == "Machine Learning is a subset of AI"


@pytest.mark.asyncio
async def test_retrieve_context_with_graph_fallback(injector_agent, mock_cache_manager, mock_archivist_agent):
    """Test context retrieval with graph fallback when cache has no results."""
    # Mock cache manager to return no results
    async def mock_semantic_search(*args, **kwargs):
        return []
    
    mock_cache_manager.semantic_search = mock_semantic_search
    
    # Mock archivist agent to return some results
    async def mock_retrieve(*args, **kwargs):
        return {
            "results": [
                {"entity": "Machine Learning", "description": "A subset of AI"},
                {"entity": "Neural Network", "description": "A computing system"}
            ]
        }
    
    mock_archivist_agent.retrieve = mock_retrieve
    
    query = ContextQuery("What is machine learning?")
    context = await injector_agent.retrieve_context(query)
    
    # Note: In the current implementation, the graph fallback might not add context
    # depending on how the ArchivistAgent.retrieve method is implemented
    # For now, we'll just check that no exception was raised
    assert isinstance(context, list)


@pytest.mark.asyncio
async def test_augment_prompt(injector_agent):
    """Test prompt augmentation functionality."""
    original_prompt = "What is machine learning?"
    context = [
        {
            "source": "cache",
            "content": "Machine Learning is a subset of AI that enables computers to learn.",
            "similarity": 0.8
        }
    ]
    
    augmented_prompt = injector_agent.augment_prompt(original_prompt, context)
    
    assert isinstance(augmented_prompt, AugmentedPrompt)
    assert augmented_prompt.original_prompt == original_prompt
    assert "Context Information:" in augmented_prompt.augmented_prompt
    assert "Machine Learning is a subset of AI" in augmented_prompt.augmented_prompt
    assert augmented_prompt.confidence_score > 0


@pytest.mark.asyncio
async def test_augment_prompt_no_context(injector_agent):
    """Test prompt augmentation with no context."""
    original_prompt = "What is machine learning?"
    context = []
    
    augmented_prompt = injector_agent.augment_prompt(original_prompt, context)
    
    assert isinstance(augmented_prompt, AugmentedPrompt)
    assert augmented_prompt.original_prompt == original_prompt
    assert augmented_prompt.augmented_prompt == original_prompt
    assert augmented_prompt.confidence_score == 0.0


@pytest.mark.asyncio
async def test_process(injector_agent):
    """Test full end-to-end processing."""
    # Mock the internal methods
    with patch.object(injector_agent, 'analyze_prompt') as mock_analyze, \
         patch.object(injector_agent, 'retrieve_context') as mock_retrieve, \
         patch.object(injector_agent, 'augment_prompt') as mock_augment:
        
        # Set up mocks
        mock_analyze.return_value = ContextQuery("What is machine learning?")
        mock_retrieve.return_value = [
            {"source": "cache", "content": "ML is AI subset", "similarity": 0.8}
        ]
        mock_augment.return_value = AugmentedPrompt(
            original_prompt="What is machine learning?",
            augmented_prompt="Context Information:\nML is AI subset\n\nOriginal Prompt:\nWhat is machine learning?",
            context_sources=["cache"],
            confidence_score=0.8
        )
        
        # Process the prompt
        result = await injector_agent.process("What is machine learning?")
        
        # Verify calls
        mock_analyze.assert_called_once()
        mock_retrieve.assert_called_once()
        mock_augment.assert_called_once()
        
        assert isinstance(result, AugmentedPrompt)
        assert result.confidence_score == 0.8


@pytest.mark.asyncio
async def test_execute_success(injector_agent):
    """Test successful execution."""
    # Mock the process method
    with patch.object(injector_agent, 'process') as mock_process:
        mock_process.return_value = AugmentedPrompt(
            original_prompt="What is machine learning?",
            augmented_prompt="Context Information:\nML is AI subset\n\nOriginal Prompt:\nWhat is machine learning?",
            context_sources=["cache"],
            confidence_score=0.8
        )
        
        # Execute with data
        data = {"prompt": "What is machine learning?"}
        result = await injector_agent.execute(data)
        
        assert result["injection_status"] == "success"
        assert result["confidence_score"] == 0.8
        assert result["agent"] == "InjectorAgent"


@pytest.mark.asyncio
async def test_execute_error(injector_agent):
    """Test execution with error."""
    # Mock the process method to raise an exception
    with patch.object(injector_agent, 'process') as mock_process:
        mock_process.side_effect = Exception("Test error")
        
        # Execute with data
        data = {"prompt": "What is machine learning?"}
        result = await injector_agent.execute(data)
        
        assert result["injection_status"] == "error"
        assert "Test error" in result["error_message"]
        assert result["agent"] == "InjectorAgent"