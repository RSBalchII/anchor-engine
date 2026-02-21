### **Directive INJ-A2: Error Handling Protocol**

The Injector Agent must be **resilient**. It cannot be allowed to crash the entire system if it encounters a single piece of malformed data.

**Proposed Protocol: The "Quarantine & Report" Method**

1.  **Identify & Isolate:** If the Injector Agent encounters data it cannot parse into the `INJ-A1` schema (e.g., a corrupted JSON file, a text file with weird encoding), it will immediately isolate the problematic source file.
2.  **Quarantine:** The agent will move the source file to a dedicated `/_quarantine` directory.
3.  **Log the Error:** The agent will create a detailed log entry in a separate `injector_errors.log` file. The log must include:
      * A timestamp.
      * The original path of the quarantined file.
      * The specific error message or traceback (e.g., "JSONDecodeError: Expecting ',' delimiter").
4.  **Notify:** The agent will send a status report to the **T3 Strategist** (once it exists). For now, this can be a simple printout to the console or a summary file. The report should indicate success for all processed files and a clear "FAILURE" status for any quarantined files.
5.  **Continue Processing:** The agent will then **continue** processing the rest of the files in its queue. It does not stop.

This protocol ensures that one bad apple doesn't spoil the whole batch. We maintain system uptime, have a clear record of failures, and preserve the problematic data for you to debug manually.