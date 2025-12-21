const fs = require('fs');
const path = require('path');

const datasetPath = 'c:\\Users\\Pc\\.gemini\\antigravity\\playground\\glacial-hubble\\cost-estimator-v2\\server\\dataset.json';
const backupPath = 'c:\\Users\\Pc\\.gemini\\antigravity\\playground\\glacial-hubble\\cost-estimator-v2\\server\\dataset.json.bak';

// Timestamp of the last item in the "inşaat" batch
const CUTOFF_TIMESTAMP = 1764570933260;

try {
    console.log('Reading dataset...');
    const data = fs.readFileSync(datasetPath, 'utf8');
    const dataset = JSON.parse(data);
    const initialCount = dataset.length;

    console.log(`Initial count: ${initialCount}`);

    const filteredDataset = dataset.filter(item => {
        if (!item.id) return true; // Keep items without ID (shouldn't exist but just in case)
        const timestamp = parseInt(item.id.split('-')[0]);
        return timestamp <= CUTOFF_TIMESTAMP;
    });

    const finalCount = filteredDataset.length;
    const deletedCount = initialCount - finalCount;

    console.log(`Final count: ${finalCount}`);
    console.log(`Deleted ${deletedCount} items.`);

    if (deletedCount > 0) {
        console.log('Writing updated dataset...');
        fs.writeFileSync(datasetPath, JSON.stringify(filteredDataset, null, 2));
        console.log('Success!');
    } else {
        console.log('No items to delete.');
    }

} catch (err) {
    console.error('Error processing dataset:', err);
}
