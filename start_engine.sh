#!/bin/bash

# ECE_Core Engine Startup Script for macOS/Linux
# Follows SCRIPT_PROTOCOL.md standards for detached execution

echo "Starting ECE_Core Engine..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if we are in root or engine directory and set paths accordingly
if [ -d "engine" ]; then
    # Running from root
    ENGINE_DIR="$SCRIPT_DIR/engine"
else
    # Assuming running from engine directory or similar
    ENGINE_DIR="$SCRIPT_DIR"
fi

cd "$ENGINE_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if server is already running on port 3000
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Error: A process is already running on port 3000."
    echo "Please stop it first or use: kill \$(lsof -t -i:3000)"
    exit 1
fi

# Start the engine in background with logging
# We use nohup to keep it running after the terminal closes
nohup node src/index.js > logs/server.log 2>&1 &

# Save the PID
echo $! > logs/server.pid

echo "Server process started with PID: $(cat logs/server.pid)"

# Wait a moment for the server to start
sleep 3

# Verify the server is running by checking the log
if [ -f "logs/server.log" ]; then
    echo "Last 5 lines of server log:"
    tail -n 5 logs/server.log
else
    echo "Warning: Log file not found. Server may not have started."
fi

echo ""
echo "Server started in background. Check engine/logs/server.log for output."
echo "Access the interface at: http://localhost:3000"
