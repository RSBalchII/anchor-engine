
async function run() {
    try {
        console.log('Testing Ingest Debug Route...');
        const res = await fetch('http://localhost:3000/v1/ingest-debug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: 'Debug Memory ' + Date.now(),
                source: 'Debug Script',
                buckets: ['test']
            })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

run();
