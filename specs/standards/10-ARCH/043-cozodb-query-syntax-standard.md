# Standard 043: CozoDB Query Syntax for Data Retrieval

**Status:** Active | **Category:** ARCH | **Authority:** LLM-Enforced

## 1. What Happened
The system experienced database initialization failures with the error "parser::no_entry" and "You need to have one rule named '?'". This occurred during schema migrations when using the `:=` operator in CozoDB queries for data retrieval operations. The error specifically happened when running queries like `?[id, timestamp, content, source, type, hash, buckets] := *memory{...}`.

## 2. The Cost
- **System Instability**: Database initialization would fail completely, preventing the engine from starting
- **Development Blocker**: Multiple hours spent debugging CozoDB syntax issues
- **Migration Failures**: Schema migrations would halt, preventing proper database updates
- **User Experience**: Engine would crash during startup, showing confusing error messages

## 3. The Rule
1. **Data Retrieval Operator**: When retrieving data from existing relations in CozoDB, use the `<-` operator instead of `:=` for proper query syntax:
   ```javascript
   // CORRECT - Use for data retrieval from existing relations
   const data = await db.run('?[id, timestamp, content, source, type, hash, buckets] <- *memory{id, timestamp, content, source, type, hash, buckets}');
   
   // INCORRECT - This causes parser errors
   const data = await db.run('?[id, timestamp, content, source, type, hash, buckets] := *memory{id, timestamp, content, source, type, hash, buckets}');
   ```

2. **Operator Distinction**:
   - Use `<-` when retrieving data from existing relations (most common case)
   - Use `:=` when defining new derived relations or rules
   - The `<-` operator properly signals to CozoDB that this is a data retrieval operation

3. **Schema Migration Pattern**: When performing schema migrations that involve retrieving existing data, always use the `<-` operator:
   ```javascript
   // Retrieve existing data
   const data = await db.run('?[id, timestamp, content, source, type, hash, buckets] <- *memory{id, timestamp, content, source, type, hash, buckets}');
   
   // Then perform migration operations
   await db.run(':rm memory');
   // ... recreate schema ...
   ```

4. **Error Prevention**: Any query that starts with `?[variables]` and retrieves from an existing relation using `{relation_fields}` must use the `<-` operator to avoid "parser::no_entry" errors.