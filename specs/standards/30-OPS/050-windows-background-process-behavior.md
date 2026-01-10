# Standard 050: Windows Background Process Behavior

**Domain:** 30-OPS (Protocols, Safety, Debugging)  
**Status:** Active | **Authority:** Human-Locked

## The Triangle of Pain

### What Happened
When running background processes on Windows using the Qwen Code CLI, subprocesses were created with visible console windows that would remain open until the process completed. Additionally, the output from these processes was not captured by the CLI, making it impossible to see the results of the commands.

### The Cost
- Loss of visibility into command execution results
- Multiple console windows opening unexpectedly
- Disruption of the workflow when commands run in separate windows
- Inability to properly monitor and debug background processes

### The Rule
On Windows systems, all background processes must be executed using the SafeShellExecutor with proper creation flags to prevent console windows from appearing. Additionally, output must be redirected to log files for later inspection.

## Technical Specifications

### Safe Process Creation on Windows
- Use CREATE_NO_WINDOW flag when creating subprocesses on Windows
- Redirect stdout and stderr to timestamped log files in the `logs/` directory
- Use the SafeShellExecutor service for all command execution

### Expected Behavior
- Background processes should run without opening visible console windows
- Process output should be captured in log files
- The CLI session should remain responsive during background execution

## Quality Assurance

### Validation Criteria
- No console windows appear when running background processes
- Process output is available in log files
- CLI session remains responsive

### Testing Protocol
1. Execute a background command using the SafeShellExecutor
2. Verify no console window appears
3. Check that output is logged to the appropriate file
4. Confirm CLI session remains responsive

## Integration Points

### With Existing Systems
- Integrates with SafeShellExecutor service for command execution
- Works with centralized logging system
- Maintains compatibility with cross-platform operation

---
*Standard created to formalize Windows background process execution behavior*