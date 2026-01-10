# Standard: Comprehensive Testing Policy for ECE

## What Happened?
The ECE project had multiple scattered test files (`unit_tests.js`, `integration_tests.js`, `error_tests.js`) that were not providing complete coverage of all system paths and data flows. This led to inconsistencies in testing and made it difficult to ensure all functionality was working correctly.

## The Cost
- Fragmented test coverage leading to potential gaps in validation
- Multiple test execution points making it difficult to ensure complete validation
- Inconsistent testing approaches across different test files
- Difficulty in maintaining and updating tests across multiple files

## The Rule
1. **Single Point of Truth**: All testing is performed through the comprehensive suite (`comprehensive_suite.js`)
2. **Complete Coverage**: The suite must cover unit tests, integration tests, error scenarios, performance tests, and experimental tests
3. **Unified Execution**: All tests run in sequence to ensure coordinated validation of the entire system
4. **Standardized Execution**: Use `npm test` to run the complete comprehensive suite
5. **Archive Obsolete Files**: Move individual test files to `tests/archive/` after consolidation

## Test Categories in Comprehensive Suite
The comprehensive suite includes:
- Unit Tests: Individual service function validation
- Integration Tests: Full data pipeline validation
- Error Scenario Tests: Error handling and edge case validation
- Performance Tests: Search performance and response time validation
- Context Experiments: Query effectiveness and optimization validation

## Implementation
- Update package.json to point all test commands to comprehensive suite
- Consolidate all test functionality into comprehensive_suite.js
- Update documentation to reflect new testing policy
- Archive obsolete test files in tests/archive/

## Verification
- All tests must pass when running `npm test`
- Complete coverage of all system paths and data flows
- Consistent test execution across all environments