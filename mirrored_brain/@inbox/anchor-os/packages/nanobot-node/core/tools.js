
import { exec } from 'child_process';
import path from 'path';

// Safety patterns to block
const DENY_PATTERNS = [
    /\brm\s+-[rf]{1,2}\b/i,          // rm -r, rm -rf, rm -fr
    /\bdel\s+\/[fq]\b/i,             // del /f, del /q
    /\brmdir\s+\/s\b/i,              // rmdir /s
    /\b(format|mkfs|diskpart)\b/i,   // disk operations
    /\bdd\s+if=/i,                   // dd
    />\s*\/dev\/sd/i,                // write to disk
    /\b(shutdown|reboot|poweroff)\b/i,  // system power
    /:\(\)\s*\{.*\};\s*:/            // fork bomb
];

/**
 * Execute a shell command safely
 * @param {string} command - The command to execute
 * @param {string} [workingDir] - Optional working directory
 * @returns {Promise<string>} - The command output
 */
export function executeCommand(command, workingDir) {
    return new Promise((resolve, reject) => {
        // 1. Guard check
        const cmdTrimmed = command.trim();

        // Check deny patterns
        for (const pattern of DENY_PATTERNS) {
            if (pattern.test(cmdTrimmed)) {
                return resolve("Error: Command blocked by safety guard (dangerous pattern detected)");
            }
        }

        // Check for path traversal if strictly restricted (optional, lenient for this implementation)
        // For now, we trust the user knows what they are doing in their project folder

        const cwd = workingDir || process.cwd();
        // Use a reasonable timeout
        const timeout = 60000; // 60 seconds

        exec(cmdTrimmed, { cwd, timeout }, (error, stdout, stderr) => {
            let output = '';

            if (stdout) {
                output += stdout;
            }

            if (stderr) {
                if (output) output += '\n';
                output += `STDERR:\n${stderr}`;
            }

            if (error) {
                // If it was valid execution but returned non-zero
                if (output) output += '\n';
                output += `Exit code: ${error.code || 'unknown'}`;
                if (error.signal) output += ` (Signal: ${error.signal})`;
            }

            const cleanOutput = output.trim() || "(no output)";

            // Truncate if too long (to avoid blowing up context)
            const MAX_LEN = 4000;
            if (cleanOutput.length > MAX_LEN) {
                resolve(cleanOutput.substring(0, MAX_LEN) + `\n... (truncated, ${cleanOutput.length - MAX_LEN} more chars)`);
            } else {
                resolve(cleanOutput);
            }
        });
    });
}
