# Quickstart Guide - Essential User Workflow

**Status:** Active | **Authority:** Human-Locked | **Domain:** User Onboarding

## Quick Launch

### Prerequisites
- Node.js v18+
- PNPM package manager

### Setup & Launch
```bash
# Clone and setup
git clone <repository-url>
cd ECE_Core
pnpm install
pnpm build

# Launch the system
./start.sh        # Linux/macOS
.\start.bat      # Windows
```

Access UI at http://localhost:3000

## Core Operations

### Data Ingestion
- **File Drop**: Place files in `context/` directory
- **API**: `POST /v1/ingest` endpoint
- **Real-time Sync**: Watchdog monitors `context/` directory

### Search Capabilities
- **Natural Language**: Ask questions in plain English
- **Tag-Based**: Use hashtags for filtering (`#tagname`)
- **Semantic**: Retrieve related concepts via Tag-Walker

### API Examples
```bash
# Ingest content
curl -X POST http://localhost:3000/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"content": "Your content", "buckets": ["inbox"]}'

# Search memory
curl -X POST http://localhost:3000/v1/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "search terms", "buckets": ["inbox"]}'
```

## Troubleshooting

### Common Issues
- **Slow startup**: First run includes database initialization
- **UI delays**: Electron wrapper may take up to 15 seconds
- **Direct access**: Available at http://localhost:3000 if needed

### Health Checks
- System status: `GET /health`
- Performance metrics: `GET /monitoring/metrics`