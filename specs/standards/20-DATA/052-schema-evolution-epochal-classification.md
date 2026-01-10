# Standard 052: Schema Evolution & Epochal Classification

**Domain:** 20-DATA (Data, Memory, Filesystem)  
**Status:** Active | **Authority:** Human-Locked

## The Triangle of Pain

### What Happened
During development of the Epochal Historian feature, the system's memory schema needed to be enhanced to support hierarchical organization of memories. Initially, the schema only supported basic fields, but the recursive decomposition (Epochs -> Episodes -> Propositions) required a dedicated field to store epochal classifications.

### The Cost
- Incompatibility issues when the Mirror Protocol attempted to access non-existent 'epochs' field
- Query parser errors when Dreamer service tried to read/write epochal data
- Potential data loss if schema migration wasn't handled carefully
- Inconsistent behavior across different system components

### The Rule
All schema evolutions must follow a careful migration process that preserves existing data while adding new fields. When introducing new classification fields like 'epochs', all system components that access the database must be updated to handle the new field appropriately.

## Technical Specifications

### Schema Evolution Process
1. Add new fields to the database schema with appropriate default values
2. Update all services that query the database to include the new fields
3. Ensure backward compatibility during the transition period
4. Update documentation to reflect the new schema structure

### Epochal Classification Schema
- **Field:** `epochs: String` (JSON-formatted array)
- **Purpose:** Stores epochal classifications for hierarchical organization (Epochs -> Episodes -> Propositions)
- **Format:** JSON string representing an array of epoch names (e.g., `'["Project Alpha Development", "Q3 2025 Planning"]'`)
- **Usage:** Used for epochal navigation and organizing memories into high-level thematic clusters

### Migration Requirements
1. All existing data must be preserved during schema updates
2. New fields should have sensible default values (typically empty JSON arrays)
3. Services must handle both old and new schema versions during transition
4. Fallback mechanisms should be in place for missing fields

## Quality Assurance

### Validation Criteria
- Schema migration completes without data loss
- All services can read and write to the updated schema
- Existing functionality remains unaffected
- New epochal classification features work as expected

### Testing Protocol
1. Verify schema migration works on existing databases
2. Test that all services can handle the new epochs field
3. Confirm backward compatibility with older data
4. Validate epochal classification functionality

## Integration Points

### With Existing Systems
- Integrates with Dreamer service for epochal analysis
- Works with Mirror Protocol for filesystem representation
- Compatible with search functionality for epochal queries
- Maintains consistency with existing bucket and tag systems

---
*Standard created to formalize schema evolution and epochal classification requirements*