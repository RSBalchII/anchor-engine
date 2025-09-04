# 🚀 ECE Memory Management System - Quick Start Guide

## Option 1: Automated Startup (Recommended)

Simply run the startup script:

```bash
./start_memory_system.sh
```

This will:
1. Check prerequisites
2. Start Neo4j and Redis in Docker
3. Setup Python environment
4. Install all dependencies
5. Start the FastAPI server

## Option 2: Manual Startup

If you prefer to run components manually:

### Step 1: Start Database Services

```bash
# Start Neo4j and Redis
docker-compose up -d neo4j redis

# Verify they're running
docker-compose ps
```

### Step 2: Setup Python Environment

```bash
# Create virtual environment (if not exists)
python3 -m venv .venv

# Activate it
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn redis neo4j pydantic python-dotenv pyyaml
pip install torch sentence-transformers numpy  # For AI features
```

### Step 3: Start the Server

```bash
# Set Python path
export PYTHONPATH="$PYTHONPATH:$(pwd)/src"

# Run the server
cd src
uvicorn external_context_engine.main:app --reload --host 0.0.0.0 --port 8000
```

## Option 3: Docker-Only (Simplest)

Run everything in Docker:

```bash
# Build and start all services
docker-compose up --build
```

## 🧪 Testing the System

Once the server is running, test it:

```bash
# In a new terminal
./test_memory_system.py
```

Or test manually with curl:

```bash
# Health check
curl http://localhost:8000/memory/health

# Store a memory
curl -X POST http://localhost:8000/memory/store \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "Test memory", "source": "manual"}'

# Query memories
curl -X POST http://localhost:8000/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What do you remember?"}'

# Get statistics
curl http://localhost:8000/memory/stats
```

## 📚 Access Points

Once running, you can access:

- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc
- **Neo4j Browser**: http://localhost:7474 (user: neo4j, password: your_neo4j_password)
- **Health Check**: http://localhost:8000/memory/health

## 🔧 Configuration

### Environment Variables (.env)

Key settings to check/modify:

```env
# Neo4j
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Redis
REDIS_URL=redis://localhost:6379

# GPU (if available)
CUDA_DEVICE=0
GPU_BATCH_SIZE=32

# Q-Learning
QL_LEARNING_RATE=0.1
QL_EPSILON=0.1
```

### Memory Management Config (config.yaml)

The system configuration is in `config.yaml`:

```yaml
memory_management:
  cache:
    redis_url: "redis://localhost:6379"
    ttl_seconds: 3600
  gpu:
    device: "cuda:0"
    batch_size: 32
  q_learning:
    learning_rate: 0.1
    max_episodes: 1000
```

## 🐛 Troubleshooting

### Issue: Cannot connect to server

```bash
# Check if port 8000 is in use
lsof -i :8000

# Check Docker services
docker-compose ps

# Check logs
docker-compose logs neo4j redis
```

### Issue: Import errors

```bash
# Ensure you're in virtual environment
which python  # Should show .venv/bin/python

# Reinstall dependencies
pip install -r requirements_memory.txt
```

### Issue: Neo4j connection failed

```bash
# Check Neo4j is running
docker-compose logs neo4j

# Test connection
docker exec -it external-context-engine-ece_neo4j_1 cypher-shell \
  -u neo4j -p your_neo4j_password "RETURN 1"
```

### Issue: GPU not detected

```bash
# Check CUDA installation
nvidia-smi

# Test PyTorch GPU
python -c "import torch; print(torch.cuda.is_available())"
```

## 📝 Example Usage

### Store a Memory

```python
import requests

response = requests.post(
    "http://localhost:8000/memory/store",
    json={
        "raw_text": "The ECE system uses Q-Learning to optimize memory retrieval paths.",
        "source": "documentation",
        "metadata": {"category": "technical"}
    }
)
print(response.json())
```

### Query Memories

```python
response = requests.post(
    "http://localhost:8000/memory/query",
    json={
        "query": "How does the ECE system optimize retrieval?",
        "max_results": 5
    }
)
context = response.json()["context"]
print(f"Found: {context['summary']}")
```

### WebSocket Stream

```python
import asyncio
import websockets

async def listen_to_memory_events():
    async with websockets.connect("ws://localhost:8000/memory/stream") as ws:
        while True:
            event = await ws.recv()
            print(f"Memory event: {event}")

asyncio.run(listen_to_memory_events())
```

## 🛑 Stopping the System

To stop all services:

```bash
# Stop the FastAPI server
Ctrl+C

# Stop Docker services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## 📖 Further Documentation

- Full API docs: http://localhost:8000/docs
- Specification documents: `specs/memory-management-system/`
- Architecture: `specs/memory-management-system/implementation-plan.md`
- Task breakdown: `specs/memory-management-system/tasks.md`

---

**Need help?** Check the logs:
- Application logs: Terminal output
- Docker logs: `docker-compose logs -f`
- Neo4j logs: `docker-compose logs neo4j`
- Redis logs: `docker-compose logs redis`
