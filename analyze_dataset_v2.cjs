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
                    firstItem: item.description ? item.description.substring(0, 50) + '...' : 'No description'
                };
            }
            batches[timestamp].count++;
        }
    });

    console.log('Upload Batches:');
    const sortedKeys = Object.keys(batches).sort();
    sortedKeys.forEach(ts => {
        const date = new Date(parseInt(ts)).toLocaleString();
        console.log(`[${ts}] ${date} - ${batches[ts].count} items - First: ${batches[ts].firstItem}`);
    });

} catch (err) {
    console.error('Error reading dataset:', err);
}
