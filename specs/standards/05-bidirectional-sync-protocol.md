# Standard: Bidirectional Graph-Filesystem Synchronization Protocol

## What Happened?
The system needed a standardized approach for maintaining synchronization between the CozoDB graph database and the filesystem representation. Previously, the mirror protocol only provided unidirectional sync from database to filesystem, limiting the ability to directly edit memories through file manipulation.

## The Cost
- Limited ability to directly edit memories through filesystem
- Manual synchronization required between database and filesystem
- Risk of inconsistencies between database and filesystem representations
- Reduced flexibility in memory management workflows

## The Rule
1. **Bidirectional Sync**: The system must maintain synchronization in both directions between the CozoDB graph and the filesystem representation.

2. **Database to Filesystem**: On startup and during Dreamer cycles, database entries must be mirrored to the filesystem in `context/mirrored_brain/[Bucket]/[Year]/[Files]`.

3. **Filesystem to Database**: Changes to mirrored files must be automatically synced back to the corresponding database entries.

4. **File Type Preservation**: Files must be created with appropriate extensions based on their content type (.md, .json, .js, .py, etc.).

5. **Metadata Preservation**: Each mirrored file must include frontmatter with complete metadata (id, timestamp, date, source, type, hash, buckets, tags).

6. **Deletion Synchronization**: Deleting a mirrored file must remove the corresponding database entry.

7. **Startup Overwrite**: On startup, the filesystem mirror must be regenerated from the database, overwriting any temporary changes.

8. **Runtime Updates**: During runtime, changes to mirrored files must be immediately reflected in the database.

9. **Conflict Resolution**: When both database and filesystem versions of a memory exist, the most recent change takes precedence.

10. **Watch Mechanism**: The file watcher must monitor both the main context directory and the mirrored brain directory.

## Implementation Requirements
- Mirror service must regenerate the entire filesystem representation from database on demand
- Watcher service must detect and handle changes to mirrored files
- Frontmatter parsing must correctly extract metadata for database updates
- File extension mapping must preserve content type information
- Hash validation should ensure integrity during sync operations

## Testing Protocol
1. **Database to Filesystem**: Verify that database entries are correctly mirrored to filesystem with proper metadata
2. **Filesystem to Database**: Verify that changes to mirrored files are synced back to database
3. **Deletion Sync**: Verify that deleting mirrored files removes database entries
4. **Startup Regeneration**: Verify that mirror is regenerated from database on startup
5. **File Type Preservation**: Verify that files are created with correct extensions
6. **Metadata Integrity**: Verify that all metadata is preserved during sync operations

## Migration Requirements
- Update documentation to reflect bidirectional sync capabilities
- Modify existing workflows to account for bidirectional synchronization
- Train team members on the new editing workflow
- Update any automation to handle bidirectional sync

## Exception Handling
- If filesystem sync fails, log error and continue operation
- If database sync fails, preserve filesystem changes and retry
- Implement recovery mechanisms for sync conflicts
- Maintain backup of original data during sync operations