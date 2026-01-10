/**
 * Add Personal Test Memories
 * 
 * This script adds sample personal memories to ECE to test Brain Link.
 * Run: node add_personal_memories.js
 */

const http = require('http');

const personalMemories = [
  {
    content: `# About Coda
Coda is my cat, a beautiful grey tabby with green eyes. She's about 7 years old and loves to sit on my keyboard while I'm coding. Her favorite spots are the warm laptop and the sunny windowsill. She gets along well with Dory.`,
    source: "personal/pets/coda.md",
    type: "personal",
    buckets: ["personal", "pets"]
  },
  {
    content: `# About Dory
Dory is my other cat, a playful orange tabby. She's younger than Coda, about 4 years old. Named after the fish from Finding Nemo because she seems to forget things quickly. She loves to chase toys and play fetch with hair ties.`,
    source: "personal/pets/dory.md", 
    type: "personal",
    buckets: ["personal", "pets"]
  },
  {
    content: `# Daily Routine
I usually wake up around 7am, have coffee while checking emails. Most productive coding time is in the morning until lunch. Afternoons are for meetings and lighter work. Evening is personal time - gaming, reading, or side projects like ECE.`,
    source: "personal/routine.md",
    type: "personal",
    buckets: ["personal", "core"]
  },
  {
    content: `# Current Projects
Working on ECE (External Context Engine) - a local memory system for AI. The goal is to have a completely private, local AI assistant that remembers everything important. Also planning a desktop overlay app called Sovereign Desktop.`,
    source: "personal/projects.md",
    type: "personal",
    buckets: ["personal", "dev", "core"]
  },
  {
    content: `# Tech Preferences
Prefer local/private solutions over cloud. Use Windows with WSL for development. Main languages: JavaScript, Python. Editor: VS Code. Currently experimenting with local LLMs like Qwen.`,
    source: "personal/tech.md",
    type: "personal",
    buckets: ["personal", "dev"]
  },
  {
    content: `# Goals for 2026
1. Get ECE to production quality - stable, documented, useful
2. Build the Sovereign Desktop overlay app
3. Fully local AI workflow - no cloud dependencies for personal AI
4. Better work-life balance
5. More time with hobbies outside of coding`,
    source: "personal/goals-2026.md",
    type: "personal",
    buckets: ["personal", "core"]
  }
];

async function ingest(memory) {
  return new Promise((resolve, reject) => {
    // ECE expects: content, filename, source, type, buckets
    const postData = JSON.stringify({
      content: memory.content,
      filename: memory.source,
      source: memory.source,
      type: memory.type,
      buckets: memory.buckets
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/v1/ingest',  // Correct endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Adding personal test memories to ECE...\n');
  
  for (const memory of personalMemories) {
    try {
      const result = await ingest(memory);
      console.log(`✅ Added: ${memory.source}`);
    } catch (e) {
      console.log(`❌ Failed: ${memory.source} - ${e.message}`);
    }
  }
  
  console.log('\nDone! Try asking about Coda or Dory in chat.html');
}

main();
