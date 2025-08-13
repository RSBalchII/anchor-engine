# T3 - The Apex model for high-level synthesis
STRATEGIST_MODEL = 'deepseek-r1:14b-qwen-distill-fp16'

# User-Facing - The fast and responsive model for the main loop
LOCUS_MODEL = 'samantha-mistral:7b-v1.2-text-fp16'

# Specialist Tool - The powerful coder model, loaded on demand
CODER_MODEL = 'deepseek-coder-v2:16b-lite-instruct-fp16'

# T2 - The lightweight model for background agents
TIER_2_WORKER_MODEL = 'granite3.1-moe:3b-instruct-fp16'

# T1 - The lightweight model for scouting
TIER_1_SCOUT_MODEL = 'tinydolphin:1.1b-v2.8-fp16'

# System
MAIN_CONTEXT_FILE = 'main_context.md'
