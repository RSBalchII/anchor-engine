# Standard 051: Service Module Path Resolution

**Domain:** 10-ARCH (System Architecture)  
**Status:** Active | **Authority:** Human-Locked

## The Triangle of Pain

### What Happened
During development and deployment of the ECE_Core system, service modules located in subdirectories were failing to load with "Cannot find module" errors. This was caused by incorrect relative import paths that didn't account for the additional directory level.

### The Cost
- Application failed to start with module loading errors
- Significant debugging time spent identifying path issues
- Deployment failures on different environments
- Developer productivity loss due to import errors

### The Rule
All service modules located in subdirectories must use the correct relative path to reference core modules and configuration files. Specifically, services in subdirectories must use `../../` to reach the src directory, while services in the main services directory use `../`.

## Technical Specifications

### Path Resolution Rules
- Services in subdirectories (e.g., `services/search/search.js`) must use `'../../core/db'` to access core modules
- Services in main services directory (e.g., `services/safe-shell-executor.js`) must use `'../core/db'` to access core modules
- Same rules apply to configuration files: `'../../config/paths'` or `'../config/paths'` respectively
- All relative imports must be verified to work from the service file's location

### Verification Requirements
1. All service modules must load without "Cannot find module" errors
2. Relative paths must be tested in both development and production environments
3. Import statements must be reviewed during code reviews for path correctness

## Quality Assurance

### Validation Criteria
- Module loading succeeds without path errors
- All services can be imported and used by the main application
- Configuration files are accessible from all service modules

### Testing Protocol
1. Verify all service modules can be loaded individually
2. Test application startup with all services enabled
3. Confirm all functionality works as expected after path corrections

## Integration Points

### With Existing Systems
- Integrates with the module loading system
- Affects all service modules in subdirectories
- Impacts deployment and packaging processes

---
*Standard created to formalize service module path resolution requirements*