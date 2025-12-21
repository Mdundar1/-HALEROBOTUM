const fs = require('fs');
const path = require('path');

const datasetPath = 'c:\\Users\\Pc\\.gemini\\antigravity\\playground\\glacial-hubble\\cost-estimator-v2\\server\\dataset.json';

try {
    const data = fs.readFileSync(datasetPath, 'utf8');
    const dataset = JSON.parse(data);

    const batches = {};

    dataset.forEach(item => {
        if (item.id) {
            const timestamp = item.id.split('-')[0];
            if (!batches[timestamp]) {
                batches[timestamp] = {
                    count: 0,
                    firstItem: item.description.substring(0, 50) + '...'
                };
            }
            batches[timestamp].count++;
        }
    });

    console.log('Upload Batches:');
    Object.keys(batches).sort().forEach(ts => {
        const date = new Date(parseInt(ts)).toLocaleString();
        console.log(`Timestamp: ${ts} (${date}) - Count: ${batches[ts].count}`);
        console.log(`  First Item: ${batches[ts].firstItem}`);
        console.log('---');
    });

} catch (err) {
    console.error('Error reading dataset:', err);
}
