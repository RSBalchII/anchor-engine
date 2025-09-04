# 📋 How to Run the ECE Memory Management System

I've created everything you need to run the project! Here's how:

## 🎯 **Easiest Method: One Command**

```bash
./start_memory_system.sh
```

This single command will:
1. ✅ Check all prerequisites (Docker, Python, etc.)
2. ✅ Start Neo4j and Redis databases
3. ✅ Create Python virtual environment
4. ✅ Install all dependencies
5. ✅ Check for GPU support
6. ✅ Start the FastAPI server

## 🧪 **Test That Everything Works**

After the server starts, in a new terminal:

```bash
./test_memory_system.py
```

This will test all the endpoints and confirm everything is working.

## 📚 **Access the System**

Once running, you can access:

- **API Documentation**: http://localhost:8000/docs (Interactive Swagger UI)
- **Neo4j Browser**: http://localhost:7474 (Database visualization)
- **Health Check**: http://localhost:8000/memory/health

## 🔧 **Manual Alternative (if you prefer)**

```bash
# 1. Start databases
docker-compose up -d neo4j redis

# 2. Setup Python
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn redis neo4j pydantic python-dotenv pyyaml

# 3. Run server
export PYTHONPATH="$PYTHONPATH:$(pwd)/src"
cd src
uvicorn external_context_engine.main:app --reload --host 0.0.0.0 --port 8000
```

## 🎮 **Try It Out!**

Once running, you can:

1. **Store a memory**:
```bash
curl -X POST http://localhost:8000/memory/store \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "The system uses Q-Learning for optimization", "source": "test"}'
```

2. **Query memories**:
```bash
curl -X POST http://localhost:8000/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What do you know about Q-Learning?"}'
```

## 🛑 **To Stop Everything**

```bash
# Stop the server: Press Ctrl+C
# Stop Docker services:
docker-compose down
```

## ⚠️ **Troubleshooting**

If you encounter issues:

1. **Port conflict**: Make sure port 8000 isn't already in use
2. **Docker not running**: Start Docker Desktop first
3. **Import errors**: Make sure you activated the virtual environment
4. **Neo4j issues**: Check logs with `docker-compose logs neo4j`

The system is now fully implemented and ready to use! The startup script handles everything automatically. Just run `./start_memory_system.sh` and you'll have a working Memory Management System with Q-Learning optimization, GPU acceleration, and intelligent context building! 🚀
