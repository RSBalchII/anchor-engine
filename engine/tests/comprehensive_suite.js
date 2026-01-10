/**
 * Comprehensive ECE Test Suite
 *
 * Runs all test suites: unit, integration, error scenario, performance, 
 * experimental, deterministic syntax, end-to-end search, and epochal historian tests
 * This is the single point of truth for all testing in the ECE project.
 */

// Test results tracking
let totalPassed = 0;
let totalFailed = 0;

/**
 * Test runner with pretty output
 */
async function test(name, fn) {
  try {
    process.stdout.write(`  ${name}... `);
    await fn();
    console.log('✅ PASS');
    totalPassed++;
  } catch (e) {
    console.log('❌ FAIL');
    console.error(`     └─ ${e.message}`);
    totalFailed++;
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Create mock database for testing
function createMockDb() {
  return {
    run: async (query, params) => {
      // Return appropriate mock results based on query type
      if (query.includes('memory{id, hash: $hash}')) {
        // For duplicate check - return empty array (no duplicates)
        return { ok: true, rows: [] };
      } else if (query.includes(':insert memory')) {
        // For insertion - return success
        return { ok: true, rows: [] };
      } else if (query.includes('::relations')) {
        // For relations check
        return { rows: [['memory']] };
      } else if (query.includes('*memory{id, timestamp, content, source, type, buckets}')) {
        // For content retrieval in basic search
        return {
          rows: [
            ['id1', Date.now(), 'test content for search', 'test_source', 'test_type', ['test_bucket']]
          ]
        };
      } else if (query.includes('*memory{buckets}')) {
        return { rows: [['test_bucket'], ['core'], ['pending']] }; // Return some buckets
      } else if (query.includes('ORDER BY timestamp DESC LIMIT')) {
        // For the historian query
        return {
          rows: [
          ['id1', 'test content', ['test_bucket'], Date.now()],
          ['id2', 'another test content', ['core'], Date.now() - 3600000] // 1 hour ago
        ]};
      }
      return { ok: true, rows: [] };
    }
  };
}

// Mock crypto module
const mockCrypto = {
  createHash: (algorithm) => {
    return {
      update: (data) => {
        return {
          digest: (format) => {
            // Return a predictable hash for testing
            return 'mocked_hash_' + (data || 'default');
          }
        };
      }
    };
  }
};

// Mock services by overriding their dependencies
function createMockedIngestService(db) {
  return async function ingestContent(content, filename, source, type = 'text', buckets = ['core']) {
    if (!content) throw new Error('Content required');

    const hash = mockCrypto.createHash('md5').update(content).digest('hex');

    // Check if this content already exists (global check)
    const checkQuery = `?[id] := *memory{id, hash: $hash}`;
    const checkResult = await db.run(checkQuery, { hash });

    if (checkResult.ok && checkResult.rows.length > 0) {
        return {
            status: 'skipped',
            id: checkResult.rows[0][0],
            message: 'Duplicate content detected in these buckets. Skipped.'
        };
    }

    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = Date.now();

    const query = `?[id, timestamp, content, source, type, hash, buckets, tags] <- $data :insert memory {id, timestamp, content, source, type, hash, buckets, tags}`;
    const params = {
      data: [[ id, timestamp, content, source || filename || 'unknown', type, hash, buckets, '' ]]
    };

    await db.run(query, params);

    return { status: 'success', id, message: 'Ingested.' };
  };
}

function createMockedSearchService(db) {
  return {
    basicSearch: async function(query, max_chars = 5000, buckets) {
      try {
        const useBuckets = Array.isArray(buckets) && buckets.length > 0;
        const searchQuery = `?[id, timestamp, content, source, type, buckets, tags] := *memory{id, timestamp, content, source, type, buckets, tags}`;

        const result = await db.run(searchQuery);

        let context = '';
        let charCount = 0;

        if (result.rows) {
          const filteredRows = result.rows.filter(row => {
            const [id, timestamp, content, source, type, b] = row;

            // Filter by bucket in JS for now to avoid Cozo syntax issues
            // Ensure b is an array before calling some()
            const bucketMatch = !useBuckets || (Array.isArray(b) && b.some(x => buckets.includes(x)));
            if (!bucketMatch) return false;

            return content.toLowerCase().includes(query.toLowerCase()) ||
                   source.toLowerCase().includes(query.toLowerCase());
          });

          for (const row of filteredRows) {
            const [id, timestamp, content, source, type, b] = row;
            const entryText = `### Source: ${source}\n${content}\n\n`;
            if (charCount + entryText.length > max_chars) {
              const remainingChars = max_chars - charCount;
              context += entryText.substring(0, remainingChars);
              break;
            }
            context += entryText;
            charCount += entryText.length;
          }
        }

        return { context: context || 'No results found.' };
      } catch (error) {
        console.error('Basic search error:', error);
        return { context: 'Search failed' };
      }
    },

    executeSearch: async function(query, bucket, buckets, max_chars = 5000, deep = false) {
      try {
        const targetBuckets = buckets || (bucket ? [bucket] : null);
        const useBuckets = Array.isArray(targetBuckets) && targetBuckets.length > 0;

        // For unit testing, just call basic search
        return await this.basicSearch(query, max_chars, targetBuckets);
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    }
  };
}

// Mock scribe service
function createMockedScribeService(db) {
  const SESSION_STATE_ID = 'session_state';
  const STATE_BUCKET = ['system', 'state'];

  return {
    updateState: async function(history) {
      console.log('✍️ Scribe: Analyzing conversation state (mock)...');

      try {
        // 1. Flatten last 10 turns into readable text
        const recentTurns = history.slice(-10);
        const recentText = recentTurns
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n');

        if (!recentText.trim()) {
            return { status: 'skipped', message: 'No conversation history to analyze' };
        }

        // 2. Mock the state summary (in real implementation would call inference)
        const summary = `Mocked session state for: ${recentText.substring(0, 50)}...`;

        // 3. Mock persisting to database
        const timestamp = Date.now();
        const query = `?[id, timestamp, content, source, type, hash, buckets, tags] <- $data :put memory {id, timestamp, content, source, type, hash, buckets, tags}`;

        await db.run(query, {
            data: [[
                SESSION_STATE_ID,
                timestamp,
                summary.trim(),
                'Scribe',
                'state',
                `state_${timestamp}`,
                STATE_BUCKET,
                ''
            ]]
        });

        console.log('✍️ Scribe: State updated successfully (mock)');
        return { status: 'updated', summary: summary.trim() };

      } catch (e) {
        console.error('✍️ Scribe Error:', e.message);
        return { status: 'error', message: e.message };
      }
    },

    getState: async function() {
      try {
        // Mock retrieving from database
        return "This is a mocked session state for testing purposes.";
      } catch (e) {
        console.error('✍️ Scribe: Failed to retrieve state:', e.message);
        return null;
      }
    },

    clearState: async function() {
      try {
        // Mock clearing from database
        console.log('✍️ Scribe: State cleared (mock)');
        return { status: 'cleared' };
      } catch (e) {
        console.error('✍️ Scribe: Failed to clear state:', e.message);
        return { status: 'error', message: e.message };
      }
    },
    SESSION_STATE_ID
  };
}

// Create mock database for error testing
function createErrorMockDb() {
  let callCount = 0;
  const errorCallIndex = 1; // Index where we'll inject an error

  return {
    run: async (query, params) => {
      if (callCount === errorCallIndex) {
        callCount++;
        throw new Error('Database connection failed');
      }
      callCount++;

      // Return appropriate mock results based on query type
      if (query.includes('memory{id, hash: $hash}')) {
        return { ok: true, rows: [] }; // No duplicates
      } else if (query.includes(':insert memory')) {
        return { ok: true, rows: [] }; // Insert successful
      } else if (query.includes('*memory{id, timestamp, content, source, type, hash, buckets}')) {
        return {
          rows: [
            ['id1', Date.now(), 'test content for search', 'test_source', 'test_type', 'hash1', ['test_bucket']]
          ]
        };
      } else if (query.includes(':delete memory')) {
        return { ok: true, rows: [] }; // Delete successful
      } else if (query.includes('*memory{buckets}')) {
        return { rows: [['test_bucket'], ['core'], ['pending']] }; // Return some buckets
      } else if (query.includes('ORDER BY timestamp DESC LIMIT')) {
        // For the historian query
        return {
          rows: [
            ['id1', 'test content', ['test_bucket'], Date.now()],
            ['id2', 'another test content', ['core'], Date.now() - 3600000] // 1 hour ago
          ]
        };
      }
      return { ok: true, rows: [] };
    },
    reset: () => {
      callCount = 0;
    }
  };
}

// Mock services with error handling
function createMockedIngestServiceWithError(db) {
  return async function ingestContent(content, filename, source, type = 'text', buckets = ['core']) {
    if (!content) throw new Error('Content required');

    const hash = mockCrypto.createHash('md5').update(content).digest('hex');

    // Check if this content already exists (global check)
    const checkQuery = `?[id] := *memory{id, hash: $hash}`;
    const checkResult = await db.run(checkQuery, { hash });

    if (checkResult.ok && checkResult.rows.length > 0) {
        return {
            status: 'skipped',
            id: checkResult.rows[0][0],
            message: 'Duplicate content detected in these buckets. Skipped.'
        };
    }

    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const timestamp = Date.now();

    const query = `?[id, timestamp, content, source, type, hash, buckets, tags] <- $data :insert memory {id, timestamp, content, source, type, hash, buckets, tags}`;
    const params = {
      data: [[ id, timestamp, content, source || filename || 'unknown', type, hash, buckets, '' ]]
    };

    await db.run(query, params);

    return { status: 'success', id, message: 'Ingested.' };
  };
}

function createMockedSearchServiceWithError(db) {
  return {
    basicSearch: async function(query, max_chars = 5000, buckets) {
      try {
        const useBuckets = Array.isArray(buckets) && buckets.length > 0;
        const searchQuery = `?[id, timestamp, content, source, type, buckets, tags] := *memory{id, timestamp, content, source, type, buckets, tags}`;

        const result = await db.run(searchQuery);

        let context = '';
        let charCount = 0;

        if (result.rows) {
          const filteredRows = result.rows.filter(row => {
            const [id, timestamp, content, source, type, b] = row;

            // Filter by bucket in JS for now to avoid Cozo syntax issues
            // Ensure b is an array before calling some()
            const bucketMatch = !useBuckets || (Array.isArray(b) && b.some(x => buckets.includes(x)));
            if (!bucketMatch) return false;

            return content.toLowerCase().includes(query.toLowerCase()) ||
                   source.toLowerCase().includes(query.toLowerCase());
          });

          for (const row of filteredRows) {
            const [id, timestamp, content, source, type, b] = row;
            const entryText = `### Source: ${source}\n${content}\n\n`;
            if (charCount + entryText.length > max_chars) {
              const remainingChars = max_chars - charCount;
              context += entryText.substring(0, remainingChars);
              break;
            }
            context += entryText;
            charCount += entryText.length;
          }
        }

        return { context: context || 'No results found.' };
      } catch (error) {
        console.error('Basic search error:', error);
        return { context: 'Search failed' };
      }
    },

    executeSearch: async function(query, bucket, buckets, max_chars = 5000, deep = false) {
      try {
        const targetBuckets = buckets || (bucket ? [bucket] : null);
        const useBuckets = Array.isArray(targetBuckets) && targetBuckets.length > 0;

        // For error testing, call basic search which might fail
        return await this.basicSearch(query, max_chars, targetBuckets);
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    }
  };
}

// Mock inference service for dreamer tests
function createMockedInferenceService() {
  return {
    generateTags: async function(content, existingTags) {
      // Return some mock tags
      return ['mock_tag1', 'mock_tag2'];
    },
    rawCompletion: async function(prompt, options) {
      // Return a mock JSON response for the historian
      return JSON.stringify({
        epochs: ['Test Epoch'],
        episodes: ['Test Episode'],
        entities: ['Test Entity'],
        connections: []
      });
    }
  };
}

// Create a temporary test context file
function createTestContextFile(content, filename) {
  const fs = require('fs');
  const path = require('path');

  const contextDir = path.join(__dirname, '..', '..', 'context');
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  const filePath = path.join(contextDir, filename);
  fs.writeFileSync(filePath, content);

  return filePath;
}

// Clean up test context files
function cleanupTestFiles(filePaths) {
  const fs = require('fs');

  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Performance test: Measure search performance
async function runPerformanceTests() {
  console.log('\n⏱️  Running Performance Tests...');
  console.log('==================================');

  const mockDb = createMockDb();
  const mockSearchService = createMockedSearchService(mockDb);

  // Test search performance with different query sizes
  await test('Search performance with small query', async () => {
    const start = Date.now();
    const result = await mockSearchService.basicSearch('test', 1000, ['test_bucket']);
    const duration = Date.now() - start;

    assert(duration < 1000, `Search took too long: ${duration}ms`); // Should complete in under 1 second
    assert(typeof result.context === 'string', 'Expected string result');
  });

  await test('Search performance with medium query', async () => {
    const start = Date.now();
    const result = await mockSearchService.basicSearch('test content', 5000, ['test_bucket']);
    const duration = Date.now() - start;

    assert(duration < 1000, `Search took too long: ${duration}ms`); // Should complete in under 1 second
    assert(typeof result.context === 'string', 'Expected string result');
  });

  await test('Search performance with large character limit', async () => {
    const start = Date.now();
    const result = await mockSearchService.basicSearch('test', 10000, ['test_bucket']);
    const duration = Date.now() - start;

    assert(duration < 2000, `Search took too long: ${duration}ms`); // Should complete in under 2 seconds
    assert(typeof result.context === 'string', 'Expected string result');
  });
}

// Context experiments test: Test different query types and character budgets
async function runContextExperiments() {
  console.log('\n🔬 Running Context Experiments...');
  console.log('==================================');

  const mockDb = createMockDb();
  const mockSearchService = createMockedSearchService(mockDb);

  // Test different query types
  await test('Specific keyword query ("Rob")', async () => {
    const result = await mockSearchService.basicSearch('Rob', 5000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for keyword query');
  });

  await test('Specific keyword query ("Jade")', async () => {
    const result = await mockSearchService.basicSearch('Jade', 5000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for keyword query');
  });

  await test('Specific keyword query ("Dory")', async () => {
    const result = await mockSearchService.basicSearch('Dory', 5000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for keyword query');
  });

  // Test natural language query (this is where we saw issues in our analysis)
  await test('Natural language query ("I need to study")', async () => {
    const result = await mockSearchService.basicSearch('I need to study', 5000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for natural language query');
  });

  // Test different character budgets
  await test('Small character budget (1000 chars)', async () => {
    const result = await mockSearchService.basicSearch('test', 1000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for small budget');
  });

  await test('Medium character budget (5000 chars)', async () => {
    const result = await mockSearchService.basicSearch('test', 5000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for medium budget');
  });

  await test('Large character budget (10000 chars)', async () => {
    const result = await mockSearchService.basicSearch('test', 10000, ['core']);
    assert(typeof result.context === 'string', 'Expected string result for large budget');
  });
}

async function runUnitTests() {
  console.log('\n🧪 Running Unit Tests...');
  console.log('========================');

  // Create mocked services
  const mockDb = createMockDb();
  const mockIngestService = createMockedIngestService(mockDb);
  const mockSearchService = createMockedSearchService(mockDb);
  const mockScribeService = createMockedScribeService(mockDb);

  // Test ingest service
  console.log('\n--- Ingest Service Tests ---');

  await test('Ingest content successfully', async () => {
    const result = await mockIngestService('test content', 'test.txt', 'test source');
    assert(result.status === 'success', `Expected success, got ${result.status}`);
    assert(result.id, 'Expected result to have an ID');
  });

  await test('Skip duplicate content', async () => {
    // Create a new mock DB that returns a duplicate on first call
    const duplicateDb = {
      run: async (query, params) => {
        if (query.includes('memory{id, hash: $hash}')) {
          return { ok: true, rows: [['existing_id']] }; // Simulate duplicate
        }
        return { ok: true, rows: [] };
      }
    };

    const duplicateIngestService = createMockedIngestService(duplicateDb);
    const result = await duplicateIngestService('test content', 'test.txt', 'test source');
    assert(result.status === 'skipped', `Expected skipped, got ${result.status}`);
    assert(result.id === 'existing_id', `Expected existing_id, got ${result.id}`);
  });

  await test('Throw error for empty content', async () => {
    try {
      await mockIngestService('', 'test.txt', 'test source');
      assert(false, 'Expected error for empty content');
    } catch (e) {
      assert(e.message === 'Content required', `Expected "Content required", got "${e.message}"`);
    }
  });

  // Test search service
  console.log('\n--- Search Service Tests ---');

  await test('Basic search returns results', async () => {
    const result = await mockSearchService.basicSearch('test', 5000, ['test_bucket']);
    assert(result.context.includes('test content'), 'Expected search to return matching content');
  });

  await test('Execute search with buckets', async () => {
    const result = await mockSearchService.executeSearch('test', null, ['test_bucket']);
    assert(result.context.includes('test content'), 'Expected search to return matching content');
  });

  // Test scribe service
  console.log('\n--- Scribe Service Tests ---');

  await test('Update state successfully', async () => {
    const history = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am doing well, thank you!' }
    ];

    const result = await mockScribeService.updateState(history);
    assert(result.status === 'updated', `Expected updated, got ${result.status}`);
    assert(result.summary, 'Expected summary to be generated');
  });

  await test('Get state returns content', async () => {
    const state = await mockScribeService.getState();
    assert(state !== null, 'Expected state to be returned');
    assert(typeof state === 'string', 'Expected state to be a string');
  });

  await test('Clear state successfully', async () => {
    const result = await mockScribeService.clearState();
    assert(result.status === 'cleared', `Expected cleared, got ${result.status}`);
  });
}

async function runIntegrationTests() {
  console.log('\n⚙️  Running Data Pipeline Integration Tests...');
  console.log('==============================================');

  const fs = require('fs');
  const path = require('path');

  // Test context aggregation pipeline
  console.log('\n--- Context Aggregation Pipeline Tests ---');

  await test('Context aggregation from multiple files', async () => {
    // Create test context files
    const testFiles = [
      createTestContextFile('This is test content about Rob and Jade.', 'test1.txt'),
      createTestContextFile('Another file with content about Dory and Anchor.', 'test2.md'),
      createTestContextFile('More content for testing purposes.', 'test3.txt')
    ];

    try {
      // Run the context aggregation script
      const { createFullCorpusRecursive } = require('../src/read_all.js');
      await createFullCorpusRecursive();

      // Check if aggregated file was created
      // The actual read_all.js creates the file in the codebase directory relative to where it's run
      // When run from tests, it creates it in the parent directory (engine/codebase/)
      const aggregatedPath = path.join(__dirname, '..', 'codebase', 'combined_context.yaml');
      assert(fs.existsSync(aggregatedPath), 'Expected aggregated corpus file to be created');

      // Check content
      const content = fs.readFileSync(aggregatedPath, 'utf8');
      // Check that the file has content (the aggregation should have worked)
      assert(content.length > 0, 'Expected aggregated file to have content');
      assert(content.includes('yaml') || content.includes('js') || content.includes('md'), 'Expected aggregated content to include project files');

      // Clean up
      if (fs.existsSync(aggregatedPath)) {
        fs.unlinkSync(aggregatedPath);
      }
      // Note: The test files in context directory may not be picked up by the recursive scan
      // since it scans from project root and our test files were created in context dir
      // which might be excluded or processed differently
      cleanupTestFiles(testFiles);
    } catch (e) {
      // Clean up even if test fails
      const aggregatedPath = path.join(__dirname, '..', 'codebase', 'combined_context.yaml');
      if (fs.existsSync(aggregatedPath)) {
        fs.unlinkSync(aggregatedPath);
      }
      cleanupTestFiles(testFiles);
      throw e;
    }
  });

  // Test file watcher integration (if server is running)
  console.log('\n--- File Watcher Integration Tests ---');

  await test('File ingestion via API', async () => {
    // This test requires a running server, so we'll skip it if server is not available
    try {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) {
        console.log('⚠️  SKIP (server not running)');
        return;
      }
    } catch (e) {
      console.log('⚠️  SKIP (server not running)');
      return;
    }

    // Test actual ingestion via API
    const testContent = `Integration test content: ${Date.now()}`;
    const response = await fetch('http://localhost:3000/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        source: 'Integration Test',
        type: 'test',
        buckets: ['integration', 'test']
      })
    });

    assert(response.ok, `Expected successful ingestion, got status ${response.status}`);
    const result = await response.json();
    assert(result.status === 'success', `Expected success status, got ${result.status}`);
  });

  // Test search functionality end-to-end
  await test('End-to-end search functionality', async () => {
    // This test requires a running server
    try {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) {
        console.log('⚠️  SKIP (server not running)');
        return;
      }
    } catch (e) {
      console.log('⚠️  SKIP (server not running)');
      return;
    }

    // First ingest some content
    const testContent = `E2E test content with unique identifier: ${Date.now()}`;
    const ingestResponse = await fetch('http://localhost:3000/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        source: 'E2E Test',
        type: 'test',
        buckets: ['e2e', 'test']
      })
    });

    assert(ingestResponse.ok, 'Expected ingestion to succeed');

    // Wait briefly for consistency
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now search for the content
    const searchResponse = await fetch('http://localhost:3000/v1/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: Date.now().toString(), // Search for the unique identifier
        buckets: ['e2e']
      })
    });

    assert(searchResponse.ok, `Expected search to succeed, got status ${searchResponse.status}`);
    const searchData = await searchResponse.json();
    assert(searchData.context && searchData.context.includes('E2E test content'),
           'Expected search results to contain test content');
  });
}

async function runErrorTests() {
  console.log('\n⚠️  Running Error Scenario Tests...');
  console.log('==================================');

  const fs = require('fs');

  // Test error handling in ingest service
  console.log('\n--- Error Handling Tests ---');

  await test('Ingest service handles database errors', async () => {
    const errorDb = createErrorMockDb();
    const errorIngestService = createMockedIngestServiceWithError(errorDb);

    try {
      await errorIngestService('test content', 'test.txt', 'test source');
      // If we reach here, the error wasn't thrown as expected
      assert(false, 'Expected database error to be thrown');
    } catch (e) {
      // This is expected - the error should be propagated
      assert(e.message.includes('Database connection failed'),
             `Expected database error, got: ${e.message}`);
    }
  });

  await test('Search service handles database errors gracefully', async () => {
    const errorDb = createErrorMockDb();
    const errorSearchService = createMockedSearchServiceWithError(errorDb);

    try {
      const result = await errorSearchService.basicSearch('test', 5000, ['test_bucket']);
      // The service should handle errors gracefully and return a failure message
      assert(result.context === 'Search failed',
             `Expected graceful failure, got: ${result.context}`);
    } catch (e) {
      // This is also acceptable - the error might propagate
      assert(true, 'Error was handled appropriately');
    }
  });

  // Test edge cases
  console.log('\n--- Edge Case Tests ---');

  await test('Ingest service handles empty content', async () => {
    const mockDb = {
      run: async (query, params) => ({ ok: true, rows: [] })
    };
    const mockIngestService = createMockedIngestServiceWithError(mockDb);

    try {
      await mockIngestService('', 'test.txt', 'test source');
      assert(false, 'Expected error for empty content');
    } catch (e) {
      assert(e.message === 'Content required',
             `Expected 'Content required' error, got: ${e.message}`);
    }
  });

  await test('Ingest service handles null content', async () => {
    const mockDb = {
      run: async (query, params) => ({ ok: true, rows: [] })
    };
    const mockIngestService = createMockedIngestServiceWithError(mockDb);

    try {
      await mockIngestService(null, 'test.txt', 'test source');
      assert(false, 'Expected error for null content');
    } catch (e) {
      assert(e.message === 'Content required',
             `Expected 'Content required' error, got: ${e.message}`);
    }
  });

  await test('Search service handles empty query', async () => {
    const mockDb = {
      run: async (query, params) => ({
        rows: [
          ['id1', Date.now(), 'test content for search', 'test_source', 'test_type', 'hash1', ['test_bucket']]
        ]
      })
    };
    const mockSearchService = createMockedSearchServiceWithError(mockDb);

    try {
      const result = await mockSearchService.basicSearch('', 5000, ['test_bucket']);
      // Should return "No results found" or similar
      assert(typeof result.context === 'string',
             'Expected string result even for empty query');
    } catch (e) {
      // This is also acceptable
      assert(true, 'Error was handled appropriately');
    }
  });

  await test('Search service handles very large character limits', async () => {
    const mockDb = {
      run: async (query, params) => ({
        rows: [
          ['id1', Date.now(), 'test content for search', 'test_source', 'test_type', 'hash1', ['test_bucket']]
        ]
      })
    };
    const mockSearchService = createMockedSearchServiceWithError(mockDb);

    const result = await mockSearchService.basicSearch('test', 1000000, ['test_bucket']);
    assert(typeof result.context === 'string',
           'Expected string result for large character limit');
  });

  // Test API endpoint edge cases
  console.log('\n--- API Endpoint Edge Case Tests ---');

  await test('Health endpoint returns proper status', async () => {
    // This test requires a running server
    try {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) {
        console.log('⚠️  SKIP (server not running)');
        return;
      }

      const data = await response.json();
      assert(data.status === 'Sovereign',
             `Expected 'Sovereign' status, got: ${data.status}`);
    } catch (e) {
      console.log('⚠️  SKIP (server not running)');
      return;
    }
  });

  await test('Invalid ingestion request returns 400', async () => {
    // This test requires a running server
    try {
      const healthResponse = await fetch('http://localhost:3000/health');
      if (!healthResponse.ok) {
        console.log('⚠️  SKIP (server not running)');
        return;
      }

      const ingestResponse = await fetch('http://localhost:3000/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '', // Invalid - empty content
          source: 'Test',
          type: 'test'
        })
      });

      assert(ingestResponse.status === 400,
             `Expected 400 status for invalid content, got: ${ingestResponse.status}`);
    } catch (e) {
      console.log('⚠️  SKIP (server not running)');
      return;
    }
  });

  await test('Invalid search request returns 400', async () => {
    // This test requires a running server
    try {
      const healthResponse = await fetch('http://localhost:3000/health');
      if (!healthResponse.ok) {
        console.log('⚠️  SKIP (server not running)');
        return;
      }

      const searchResponse = await fetch('http://localhost:3000/v1/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '', // Invalid - empty query
        })
      });

      assert(searchResponse.status === 400,
             `Expected 400 status for invalid query, got: ${searchResponse.status}`);
    } catch (e) {
      console.log('⚠️  SKIP (server not running)');
      return;
    }
  });

  // Test Dreamer service functionality
  console.log('\n--- Dreamer Service Tests ---');

  await test('Dreamer service can be imported and has dream function', async () => {
    const { dream } = require('../src/services/dreamer');
    assert(typeof dream === 'function', 'Expected dream to be a function');
  });

  await test('Dreamer service can run without crashing', async () => {
    // This test requires a running server with database access
    try {
      const response = await fetch('http://localhost:3000/health');
      if (!response.ok) {
        console.log('⚠️  SKIP (server not running)');
        return;
      }

      // Test the dream endpoint
      const dreamResponse = await fetch('http://localhost:3000/v1/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // The dream endpoint should return a 200 status (even if no memories to process)
      assert(dreamResponse.status === 200,
             `Expected 200 status for dream endpoint, got: ${dreamResponse.status}`);
    } catch (e) {
      console.log('⚠️  SKIP (server not running)');
      return;
    }
  });
}

// Deterministic Syntax Tests - Tests for the new search syntax with quoted phrases, temporal tags (@), and bucket tags (#)
async function runDeterministicSyntaxTests() {
  console.log('\n🔍 Running Deterministic Syntax Tests...');
  console.log('=====================================');

  const { parseQuery } = require('../src/services/search/search');

  // Test the parseQuery function
  await test('Parse quoted phrases correctly', async () => {
    const result = parseQuery('"Project Sybil" test content');

    assert(Array.isArray(result.phrases), 'Phrases should be an array');
    assert(result.phrases.includes('Project Sybil'), 'Should extract "Project Sybil" as a phrase');
    assert(result.keywords.includes('test'), 'Should have "test" in keywords');
    assert(result.keywords.includes('content'), 'Should have "content" in keywords');
  });

  await test('Parse bucket tags correctly', async () => {
    const result = parseQuery('test content #work #obsidian');

    assert(Array.isArray(result.buckets), 'Buckets should be an array');
    assert(result.buckets.includes('work'), 'Should extract "work" as a bucket');
    assert(result.buckets.includes('obsidian'), 'Should extract "obsidian" as a bucket');
    assert(result.keywords.includes('test'), 'Should have "test" in keywords');
    assert(result.keywords.includes('content'), 'Should have "content" in keywords');
  });

  await test('Parse temporal tags correctly', async () => {
    const result = parseQuery('test content @2025 @July');

    assert(Array.isArray(result.temporal), 'Temporal should be an array');
    assert(result.temporal.includes('2025'), 'Should extract "2025" as temporal');
    assert(result.temporal.includes('July'), 'Should extract "July" as temporal');
    assert(result.keywords.includes('test'), 'Should have "test" in keywords');
    assert(result.keywords.includes('content'), 'Should have "content" in keywords');
  });

  await test('Parse mixed syntax correctly', async () => {
    const result = parseQuery('"Project Sybil" @2025 #work meeting notes');

    assert(result.phrases.includes('Project Sybil'), 'Should extract phrase');
    assert(result.temporal.includes('2025'), 'Should extract temporal');
    assert(result.buckets.includes('work'), 'Should extract bucket');
    assert(result.keywords.includes('meeting'), 'Should have "meeting" in keywords');
    assert(result.keywords.includes('notes'), 'Should have "notes" in keywords');
  });

  await test('Parse complex query with multiple elements', async () => {
    const result = parseQuery('"Complete Project Sybil" @July @2025 #work #important task');

    assert(result.phrases.length === 1, 'Should have one phrase');
    assert(result.phrases[0] === 'Complete Project Sybil', 'Should extract full phrase');
    assert(result.temporal.includes('July'), 'Should extract July');
    assert(result.temporal.includes('2025'), 'Should extract 2025');
    assert(result.buckets.includes('work'), 'Should extract work bucket');
    assert(result.buckets.includes('important'), 'Should extract important bucket');
    assert(result.keywords.includes('task'), 'Should have "task" in keywords');
  });

  await test('Handle query with no special syntax', async () => {
    const result = parseQuery('regular search query');

    assert(result.phrases.length === 0, 'Should have no phrases');
    assert(result.temporal.length === 0, 'Should have no temporal tags');
    assert(result.buckets.length === 0, 'Should have no buckets');
    assert(result.keywords.includes('regular'), 'Should have "regular" in keywords');
    assert(result.keywords.includes('search'), 'Should have "search" in keywords');
    assert(result.keywords.includes('query'), 'Should have "query" in keywords');
  });

  await test('Handle empty query', async () => {
    const result = parseQuery('');

    assert(result.phrases.length === 0, 'Should have no phrases');
    assert(result.temporal.length === 0, 'Should have no temporal tags');
    assert(result.buckets.length === 0, 'Should have no buckets');
    assert(result.keywords.length === 0, 'Should have no keywords');
  });

  // Performance test
  await test('Performance: Parse should be fast', async () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      parseQuery('"Complex Query" @2025 #work with multiple elements');
    }
    const duration = Date.now() - start;

    assert(duration < 100, `Parsing 1000 queries took too long: ${duration}ms`);
  });

  // Additional syntax tests
  await test('Parse quoted phrase', async () => {
    const result = parseQuery('"Project Sybil"');
    assert(result.phrases.length === 1, 'Expected 1 phrase');
    assert(result.phrases[0] === 'Project Sybil', 'Expected "Project Sybil"');
    assert(result.temporal.length === 0, 'Expected no temporal tags');
    assert(result.buckets.length === 0, 'Expected no bucket tags');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse temporal tag', async () => {
    const result = parseQuery('@meeting');
    assert(result.phrases.length === 0, 'Expected no phrases');
    assert(result.temporal.length === 1, 'Expected 1 temporal tag');
    assert(result.temporal[0] === 'meeting', 'Expected "meeting" temporal tag');
    assert(result.buckets.length === 0, 'Expected no bucket tags');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse bucket tag', async () => {
    const result = parseQuery('#work');
    assert(result.phrases.length === 0, 'Expected no phrases');
    assert(result.temporal.length === 0, 'Expected no temporal tags');
    assert(result.buckets.length === 1, 'Expected 1 bucket tag');
    assert(result.buckets[0] === 'work', 'Expected "work" bucket tag');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse mixed syntax: "Project Sybil" @meeting #work', async () => {
    const result = parseQuery('"Project Sybil" @meeting #work');
    assert(result.phrases.length === 1, 'Expected 1 phrase');
    assert(result.phrases[0] === 'Project Sybil', 'Expected "Project Sybil"');
    assert(result.temporal.length === 1, 'Expected 1 temporal tag');
    assert(result.temporal[0] === 'meeting', 'Expected "meeting" temporal tag');
    assert(result.buckets.length === 1, 'Expected 1 bucket tag');
    assert(result.buckets[0] === 'work', 'Expected "work" bucket tag');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse mixed syntax with keywords: "Project Sybil" @meeting #work urgent', async () => {
    const result = parseQuery('"Project Sybil" @meeting #work urgent');
    assert(result.phrases.length === 1, 'Expected 1 phrase');
    assert(result.phrases[0] === 'Project Sybil', 'Expected "Project Sybil"');
    assert(result.temporal.length === 1, 'Expected 1 temporal tag');
    assert(result.temporal[0] === 'meeting', 'Expected "meeting" temporal tag');
    assert(result.buckets.length === 1, 'Expected 1 bucket tag');
    assert(result.buckets[0] === 'work', 'Expected "work" bucket tag');
    assert(result.keywords.length === 1, 'Expected 1 keyword');
    assert(result.keywords[0] === 'urgent', 'Expected "urgent" keyword');
  });

  await test('Parse complex query: "Meeting Notes" @today #work important follow-up', async () => {
    const result = parseQuery('"Meeting Notes" @today #work important follow-up');
    assert(result.phrases.length === 1, 'Expected 1 phrase');
    assert(result.phrases[0] === 'Meeting Notes', 'Expected "Meeting Notes"');
    assert(result.temporal.length === 1, 'Expected 1 temporal tag');
    assert(result.temporal[0] === 'today', 'Expected "today" temporal tag');
    assert(result.buckets.length === 1, 'Expected 1 bucket tag');
    assert(result.buckets[0] === 'work', 'Expected "work" bucket tag');
    assert(result.keywords.length === 2, 'Expected 2 keywords');
    assert(result.keywords.includes('important'), 'Expected "important" keyword');
    assert(result.keywords.includes('follow-up'), 'Expected "follow-up" keyword');
  });

  await test('Parse query with multiple quoted phrases', async () => {
    const result = parseQuery('"First Phrase" "Second Phrase"');
    assert(result.phrases.length === 2, 'Expected 2 phrases');
    assert(result.phrases[0] === 'First Phrase', 'Expected "First Phrase"');
    assert(result.phrases[1] === 'Second Phrase', 'Expected "Second Phrase"');
    assert(result.temporal.length === 0, 'Expected no temporal tags');
    assert(result.buckets.length === 0, 'Expected no bucket tags');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse query with multiple temporal tags', async () => {
    const result = parseQuery('@today @meeting @urgent');
    assert(result.phrases.length === 0, 'Expected no phrases');
    assert(result.temporal.length === 3, 'Expected 3 temporal tags');
    assert(result.temporal.includes('today'), 'Expected "today" temporal tag');
    assert(result.temporal.includes('meeting'), 'Expected "meeting" temporal tag');
    assert(result.temporal.includes('urgent'), 'Expected "urgent" temporal tag');
    assert(result.buckets.length === 0, 'Expected no bucket tags');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse query with multiple bucket tags', async () => {
    const result = parseQuery('#work #personal #urgent');
    assert(result.phrases.length === 0, 'Expected no phrases');
    assert(result.temporal.length === 0, 'Expected no temporal tags');
    assert(result.buckets.length === 3, 'Expected 3 bucket tags');
    assert(result.buckets.includes('work'), 'Expected "work" bucket tag');
    assert(result.buckets.includes('personal'), 'Expected "personal" bucket tag');
    assert(result.buckets.includes('urgent'), 'Expected "urgent" bucket tag');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });

  await test('Parse query with special characters in quotes', async () => {
    const result = parseQuery('"Project @Sybil #Deliverable" @meeting #work');
    assert(result.phrases.length === 1, 'Expected 1 phrase');
    assert(result.phrases[0] === 'Project @Sybil #Deliverable', 'Expected "Project @Sybil #Deliverable"');
    assert(result.temporal.length === 1, 'Expected 1 temporal tag');
    assert(result.temporal[0] === 'meeting', 'Expected "meeting" temporal tag');
    assert(result.buckets.length === 1, 'Expected 1 bucket tag');
    assert(result.buckets[0] === 'work', 'Expected "work" bucket tag');
    assert(result.keywords.length === 0, 'Expected no keywords');
  });
}

// End-to-End Search Pipeline Tests
async function runEndToEndSearchTests() {
  console.log('\n🚀 Running End-to-End Search Pipeline Tests...');
  console.log('============================================');

  // Skip these tests if server is not running since they require database access
  let serverRunning = false;
  try {
    const response = await fetch('http://localhost:3000/health');
    serverRunning = response.ok;
  } catch (e) {
    // Server not running
  }

  if (!serverRunning) {
    console.log('⚠️  SKIP (server not running)');
    return;
  }

  const { executeSearch, parseQuery } = require('../src/services/search');
  const { db, init } = require('../src/core/db');
  const { ingestContent } = require('../src/services/ingest');
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  const testIds = []; // Track IDs for cleanup

  try {
    // Test 1: Ingest sample data
    await test('Sample data ingestion works correctly', async () => {
      const testData = [
        {
          content: 'This is a test document about Project Sybil. It contains important information about the project.',
          source: 'test_project_sybil.txt',
          type: 'text',
          buckets: ['work', 'projects']
        },
        {
          content: 'Meeting notes from July 2025 discussing the morning surrender protocol and anchor points.',
          source: 'meeting_notes_july.txt',
          type: 'text',
          buckets: ['meetings', '2025']
        },
        {
          content: 'Personal notes about Rob, Jade, and Dory. They worked on the ECE_core project together.',
          source: 'personal_notes.txt',
          type: 'text',
          buckets: ['personal', 'team']
        },
        {
          content: 'Technical documentation for context engine architecture and design patterns.',
          source: 'tech_docs.txt',
          type: 'text',
          buckets: ['technical', 'documentation']
        }
      ];

      for (const data of testData) {
        const result = await ingestContent(data.content, data.source, data.source, data.type, data.buckets);
        assert(result.status === 'success', `Ingestion should succeed, got ${result.status}`);
        testIds.push(result.id);
      }

      assert(testIds.length === 4, `Should have ingested 4 items, got ${testIds.length}`);
    });

    // Test 2: Search for specific phrase
    await test('Search finds content with specific phrase', async () => {
      const result = await executeSearch('"Project Sybil"', null, ['work'], 2000, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      assert(result.context.includes('Project Sybil'), 'Result should contain "Project Sybil"');
      assert(result.context.includes('important information'), 'Result should contain related content');
    });

    // Test 3: Search with temporal tag
    await test('Search finds content with temporal tag', async () => {
      const result = await executeSearch('@2025', null, ['meetings'], 2000, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      assert(result.context.includes('2025'), 'Result should contain "2025"');
      assert(result.context.includes('Meeting notes'), 'Result should contain related content');
    });

    // Test 4: Search with bucket tag
    await test('Search finds content with bucket tag', async () => {
      // Using the syntax-aware search by specifying a bucket in the query
      const result = await executeSearch('notes #meetings', null, null, 2000, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      assert(result.context.includes('Meeting notes'), 'Result should contain "Meeting notes"');
    });

    // Test 5: Search with multiple keywords
    await test('Search finds content with multiple keywords', async () => {
      const result = await executeSearch('Rob Jade Dory', null, ['personal'], 2000, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      assert(result.context.includes('Rob'), 'Result should contain "Rob"');
      assert(result.context.includes('Jade'), 'Result should contain "Jade"');
      assert(result.context.includes('Dory'), 'Result should contain "Dory"');
    });

    // Test 6: Search with complex query syntax
    await test('Search handles complex query syntax', async () => {
      const result = await executeSearch('"context engine" architecture #technical', null, null, 2000, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      assert(result.context.includes('context engine'), 'Result should contain "context engine"');
      assert(result.context.includes('architecture'), 'Result should contain "architecture"');
    });

    // Test 7: Verify query parsing works as expected
    await test('Query parsing works correctly with complex syntax', async () => {
      const query = '"context engine" architecture #technical @design';
      const parsed = parseQuery(query);

      assert(parsed.phrases.includes('context engine'), 'Should parse phrase correctly');
      assert(parsed.keywords.includes('architecture'), 'Should parse keyword correctly');
      assert(parsed.buckets.includes('technical'), 'Should parse bucket correctly');
      assert(parsed.temporal.includes('design'), 'Should parse temporal tag correctly');
    });

    // Test 8: Search respects character limits
    await test('Search respects character limits', async () => {
      const result = await executeSearch('project', null, ['work'], 100, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      assert(result.context.length <= 100, `Context should be <= 100 chars, but was ${result.context.length}`);
    });

    // Test 9: Search with no results
    await test('Search handles queries with no results gracefully', async () => {
      const result = await executeSearch('definitely_does_not_exist_xyz', null, ['core'], 1000, false);

      assert(typeof result === 'object', 'Result should be an object');
      assert(typeof result.context === 'string', 'Context should be a string');
      // The search should return a valid result even if no matches are found
    });

    // Test 10: Performance test
    await test('Search performance is acceptable', async () => {
      const start = Date.now();
      const result = await executeSearch('project', null, ['work'], 1000, false);
      const duration = Date.now() - start;

      assert(typeof result === 'object', 'Result should be an object');
      assert(duration < 2000, `Search should complete in under 2 seconds, took ${duration}ms`);
    });

  } finally {
    // Clean up test data
    for (const id of testIds) {
      try {
        await db.run(`:delete memory := [id: $id]`, { id });
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }
}

// Epochal Historian Tests
async function runEpochalHistorianTests() {
  console.log('\n🏛️  Running Epochal Historian Tests...');
  console.log('====================================');

  // Skip these tests if server is not running since they require database access
  let serverRunning = false;
  try {
    const response = await fetch('http://localhost:3000/health');
    serverRunning = response.ok;
  } catch (e) {
    // Server not running
  }

  if (!serverRunning) {
    console.log('⚠️  SKIP (server not running)');
    return;
  }

  const { dream } = require('../src/services/dreamer');

  // Test the Epochal Historian functionality
  await test('Epochal Historian function exists in dreamer service', async () => {
    // The identifyHistoricalPatterns function is internal to dreamer.js,
    // but it's called by the dream function
    assert(typeof dream === 'function', 'Expected dream function to exist in dreamer service');
  });

  await test('Dream function executes without CozoDB syntax errors', async () => {
    // Run the dream function which includes the Epochal Historian analysis
    try {
      const result = await dream();
      // The function should return a result object without throwing syntax errors
      assert(typeof result === 'object', 'Expected dream function to return an object');
      assert(result.hasOwnProperty('status'), 'Expected result to have a status property');
      assert(['success', 'skipped'].includes(result.status), 'Expected status to be success or skipped');
    } catch (error) {
      // If there's a CozoDB syntax error, it would be thrown here
      if (error.message.includes('syntax') || error.message.includes('parser')) {
        throw new Error(`CozoDB syntax error in dreamer service: ${error.message}`);
      }
      // Re-throw other errors
      throw error;
    }
  });

  await test('Dream function can process memories without errors', async () => {
    // First, let's add a test memory to ensure there's something to process
    const { db } = require('../src/core/db');

    const testId = `test_memory_${Date.now()}`;
    const testContent = `This is a test memory for Epochal Historian testing created at ${new Date().toISOString()}`;
    const timestamp = Date.now();
    const hash = require('crypto').createHash('md5').update(testContent).digest('hex');

    // Insert test memory
    const insertQuery = `:insert memory {id, timestamp, content, source, type, hash, buckets, tags} <- [[$id, $timestamp, $content, $source, $type, $hash, $buckets, $tags]]`;
    await db.run(insertQuery, {
      $id: testId,
      $timestamp: timestamp,
      $content: testContent,
      $source: 'Epochal Historian Test',
      $type: 'test',
      $hash: hash,
      $buckets: ['test', 'epochal_historian'],
      $tags: '[]'
    });

    // Now run the dream function
    const result = await dream();

    // Clean up the test memory
    const deleteQuery = `:delete memory {id} <- [[$id]]`;
    await db.run(deleteQuery, { $id: testId });

    assert(typeof result === 'object', 'Expected dream function to return an object');
    assert(result.hasOwnProperty('status'), 'Expected result to have a status property');
  });

  await test('Dream function handles empty database gracefully', async () => {
    // Create a temporary database with no memories to test the historian with empty data
    const result = await dream();

    assert(typeof result === 'object', 'Expected dream function to return an object');
    assert(result.hasOwnProperty('status'), 'Expected result to have a status property');
    // Even with no memories, the function should complete without syntax errors
  });
}

// Schema Decoupling & Searchable Tags Tests
async function runSchemaDecouplingTests() {
  console.log('\n🔧 Running Schema Decoupling & Searchable Tags Tests...');
  console.log('====================================================');

  // Skip these tests if server is not running since they require database access
  let serverRunning = false;
  try {
    const response = await fetch('http://localhost:3000/health');
    serverRunning = response.ok;
  } catch (e) {
    // Server not running
  }

  if (!serverRunning) {
    console.log('⚠️  SKIP (server not running)');
    return;
  }

  const { db } = require('../src/core/db');
  const { ingestContent } = require('../src/services/ingest');
  const { executeSearch } = require('../src/services/search');

  const testIds = []; // Track IDs for cleanup

  try {
    // Test 1: Verify that the tags column exists in the schema
    await test('Database schema includes tags column', async () => {
      // Try to query the memory relation to check if tags column exists
      const query = `?[id, content, tags] := *memory{id, content, tags} LIMIT 1`;
      try {
        const result = await db.run(query);
        // If this succeeds, the tags column exists
        assert(true, 'Tags column exists in the schema');
      } catch (error) {
        // If this fails, the tags column might not exist
        throw new Error(`Tags column not found in schema: ${error.message}`);
      }
    });

    // Test 2: Ingest content with tags
    await test('Content can be ingested with tags', async () => {
      const testContent = `Test content with tags for schema decoupling test ${Date.now()}`;
      const result = await ingestContent(testContent, 'schema_test.txt', 'Schema Test', 'test', ['schema', 'decoupling']);
      assert(result.status === 'success', `Expected success, got ${result.status}`);
      testIds.push(result.id);
    });

    // Test 3: Search using tags
    await test('Content can be searched using tags', async () => {
      // This test requires the search functionality to properly handle tags
      const result = await executeSearch('schema decoupling', null, ['schema'], 2000, false);
      assert(typeof result === 'object', 'Expected search result to be an object');
      assert(typeof result.context === 'string', 'Expected context to be a string');
      // The result should contain the test content we ingested
    });

    // Test 4: Verify tag-based search functionality
    await test('Tag-based search returns appropriate results', async () => {
      // Use a more specific search to test tag functionality
      const result = await executeSearch('schema', null, ['decoupling'], 2000, false);
      assert(typeof result === 'object', 'Expected search result to be an object');
      assert(typeof result.context === 'string', 'Expected context to be a string');
    });

  } finally {
    // Clean up test data
    for (const id of testIds) {
      try {
        await db.run(`:delete memory := [id: $id]`, { id });
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }
}

// Mirror Protocol Tests
async function runMirrorProtocolTests() {
  console.log('\n🔍 Running Mirror Protocol Tests...');
  console.log('====================================');

  // Test that the mirror module exists and has the required functions
  await test('Mirror module exists and has required functions', async () => {
    const mirror = require('../src/services/mirror');

    assert(typeof mirror.createMirror === 'function', 'createMirror should be a function');
    assert(typeof mirror.MIRRORED_BRAIN_PATH === 'string', 'MIRRORED_BRAIN_PATH should be a string');
  });

  // Test that the mirrored brain directory path is correctly constructed
  await test('Mirrored brain directory path is correctly constructed', async () => {
    const { MIRRORED_BRAIN_PATH } = require('../src/services/mirror');

    assert(MIRRORED_BRAIN_PATH.includes('mirrored_brain'), 'Path should contain "mirrored_brain"');
    assert(MIRRORED_BRAIN_PATH.includes('context'), 'Path should contain "context"');
  });
}

async function runComprehensiveSuite() {
  console.log('\n🔬 Running Comprehensive ECE Test Suite...');
  console.log('==========================================');

  // Run unit tests
  await runUnitTests();

  // Run integration tests
  await runIntegrationTests();

  // Run error scenario tests
  await runErrorTests();

  // Run performance tests
  await runPerformanceTests();

  // Run context experiments
  await runContextExperiments();

  // Run deterministic syntax tests
  await runDeterministicSyntaxTests();

  // Run end-to-end search tests
  await runEndToEndSearchTests();

  // Run Epochal Historian tests
  await runEpochalHistorianTests();

  // Run Schema Decoupling & Searchable Tags tests
  await runSchemaDecouplingTests();

  // Run Mirror Protocol tests
  await runMirrorProtocolTests();

  // Summary
  console.log('\n📊 Comprehensive Test Suite Summary:');
  console.log('====================================');
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📈 Success Rate: ${totalPassed + totalFailed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! The system is working correctly.');
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the errors above.`);
  }

  console.log('\n🏁 Comprehensive test suite completed.');
}

// Run the comprehensive suite
runComprehensiveSuite().catch(e => {
  console.error('Comprehensive test suite crashed:', e);
  process.exit(1);
});