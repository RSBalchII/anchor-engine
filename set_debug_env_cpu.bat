@echo off
echo Setting debug environment variables for Context Engine...

REM Set environment variables for detailed Dreamer logging
set DEBUG_DREAMER_PROCESSING=true
set DEBUG_DREAMER_UPDATES=true
set DEBUG_TAG_GENERATION=true

REM Disable GPU to prevent CUDA OOM errors
set NODE_LLAMA_CPP_GPU_ACCELERATION=false

echo Environment variables set:
echo   DEBUG_DREAMER_PROCESSING=%DEBUG_DREAMER_PROCESSING%
echo   DEBUG_DREAMER_UPDATES=%DEBUG_DREAMER_UPDATES%
echo   DEBUG_TAG_GENERATION=%DEBUG_TAG_GENERATION%
echo   NODE_LLAMA_CPP_GPU_ACCELERATION=%NODE_LLAMA_CPP_GPU_ACCELERATION%

echo.
echo Starting the Context Engine with debug logging...
cd engine
npm start