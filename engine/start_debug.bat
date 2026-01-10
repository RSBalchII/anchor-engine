@echo off
set DEBUG_DREAMER_PROCESSING=true
set DEBUG_DREAMER_UPDATES=true
set DEBUG_TAG_GENERATION=true
set NODE_LLAMA_CPP_GPU_ACCELERATION=false

echo Starting the Context Engine...
node src/index.js
echo Exit code: %ERRORLEVEL%