# Standard 053: Dreamer Service CozoDB Query Syntax Fix

**Domain:** 10-ARCH (System Architecture)  
**Status:** Active | **Authority:** Human-Locked

## The Triangle of Pain

### What Happened
During development of the Dreamer service for background memory organization, a critical issue emerged where the service would fail with the error "The query parser has encountered unexpected input / end of input at 14..14". This occurred when the service attempted to retrieve individual memory records by ID using parameterized CozoDB queries.

The specific problematic query was:
```javascript
const currentQuery = `?[timestamp, content, source, type, hash, epochs] := *memory{id, timestamp, content, source, type, hash, epochs}, id == $id_param`;
const currentResult = await db.run(currentQuery, { $id_param: safeId });
```

### The Cost
- Dreamer service failing to run background memory organization
- Self-organization cycles failing completely
- Hours spent debugging CozoDB query syntax
- System's ability to automatically categorize and organize memories was impaired
- Temporal tagging and bucket assignment functionality was broken

### The Rule
1. **Parameterized Query Alternatives**: When encountering parser errors with parameterized queries in CozoDB, consider alternative approaches such as:
   - Retrieving all records and filtering in JavaScript (for smaller datasets)
   - Using different parameter syntax patterns
   - Breaking complex queries into simpler components

2. **Safe Query Patterns**: For retrieving individual records by ID, use the approach:
   ```javascript
   // Instead of parameterized queries that may fail
   const allRecordsQuery = `?[id, timestamp, content, source, type, hash, epochs] <- *memory{id, timestamp, content, source, type, hash, epochs}`;
   const allRecordsResult = await db.run(allRecordsQuery);
   
   // Find the specific record in JavaScript
   const specificRecord = allRecordsResult.rows.find(row => row[0] === safeId);
   ```

3. **Error Handling**: Always implement proper error handling for CozoDB queries with specific logging to identify query syntax issues quickly.

4. **Testing**: Test CozoDB queries individually via the `/v1/query` endpoint before integrating them into services.

### Implementation Note
This fix was applied to the Dreamer service in `engine/src/services/dreamer/dreamer.js` to resolve the parser error and enable proper background memory organization functionality. The approach of fetching all records and filtering in JavaScript is acceptable for the Dreamer service since it processes records in batches and the performance impact is minimal compared to the benefits of avoiding query syntax errors.