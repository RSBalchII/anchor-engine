# ECE Test Suite

This directory contains the comprehensive test suite for the External Context Engine (ECE).

## Test Organization

### Core Test Files
- `suite.js` - Original integration tests for core API functionality
- `unit_tests.js` - Tests individual service functions in isolation
- `integration_tests.js` - Tests the full data pipeline from file ingestion to search
- `error_tests.js` - Tests error handling and edge cases
- `comprehensive_suite.js` - Runs all test suites together
- `context_experiments.js` - Experiments to determine optimal context window size and search strategies
- `benchmark.js` - "Needle in a Haystack" test for context retrieval accuracy

### Archived Test Files
Located in `tests/archive/`:
- `context_experiments_simple.js` - Simplified version of context experiments
- `test_search*.js` - Various search-specific test implementations
- `test_semantic_search.js` - Semantic search tests
- `test_temporal_fold.js` - Temporal folding tests
- `test_cozo_fts.js` - CozoDB FTS specific tests

### Test Utilities
- `README.md` - This file
- Additional test utilities and helpers

## Running Tests

```bash
# Run comprehensive test suite (all tests in one)
npm test

# Run comprehensive test suite (alternative command)
npm run test:all

# Run benchmark tests
npm run benchmark

# Run context experiments
node tests/context_experiments.js
```

## Test Policy

The ECE project follows a comprehensive testing policy where all testing is performed through the single comprehensive suite. This ensures that all paths and data flows are tested correctly in a coordinated manner.

The comprehensive suite includes:
- Unit tests for individual service functions
- Integration tests for the full data pipeline
- Error scenario tests for robustness validation
- Performance tests for retrieval accuracy
- Context experiments for optimization research

## Test Categories

### 1. Unit Tests (`unit_tests.js`)
- Tests individual service functions in isolation
- Uses manual mocking to avoid external dependencies
- Covers core functionality: ingestion, search, scribe services
- Fast execution, no server required

### 2. Integration Tests (`integration_tests.js`)
- Tests the full data pipeline from file ingestion to search
- Requires a running ECE server
- Validates end-to-end functionality
- Tests context aggregation and file watcher integration

### 3. Error Scenario Tests (`error_tests.js`)
- Tests error handling and edge cases
- Validates graceful degradation
- Tests API validation and error responses
- Ensures robustness under failure conditions

### 4. Context Assembly Experiments (`context_experiments.js`)
- Determines optimal context window size and search strategy
- Tests different combinations of keyword, semantic, and targeted search
- Evaluates temporal folding effectiveness
- Measures retrieval speed, source diversity, and token efficiency

### 5. Benchmark Tests (`benchmark.js`)
- "Needle in a Haystack" test for context retrieval accuracy
- Measures how well the model can extract specific information from varying context sizes
- Tests retrieval performance across different context lengths

## Quality Assurance Goals

The enhanced test suite addresses these quality assurance needs:

1. **Isolation**: Unit tests run without external dependencies
2. **Coverage**: Tests for all major functionality paths
3. **Error Handling**: Validation of error scenarios and graceful degradation
4. **Integration**: End-to-end pipeline validation
5. **Performance**: Benchmarks for retrieval accuracy and speed
6. **Optimization**: Context assembly experiments for optimal configuration

## Adding New Tests

When adding new functionality:
1. Add unit tests to `unit_tests.js` for isolated component testing
2. Add integration tests to `integration_tests.js` for end-to-end validation
3. Add error scenario tests to `error_tests.js` for robustness validation
4. Update the comprehensive suite if needed
5. Consider adding specific experiments to `context_experiments.js` if relevant to context assembly

## Archive Policy

Specialized or redundant test files that are no longer actively used but may be referenced in standards or documentation are kept in the `archive/` directory. This ensures that historical test cases remain available for reference while keeping the active test suite focused and organized.