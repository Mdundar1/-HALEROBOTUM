const fs = require('fs');
const path = require('path');

const datasetPath = path.join(__dirname, 'server/dataset.json');

try {
    console.log(`Reading dataset from: ${datasetPath}`);
    if (!fs.existsSync(datasetPath)) {
        console.error('Dataset file not found!');
        process.exit(1);
    }

    const data = fs.readFileSync(datasetPath, 'utf8');
    const dataset = JSON.parse(data);

    console.log(`Total items: ${dataset.length}`);

    if (dataset.length > 0) {
        const lastItems = dataset.slice(-5);
        console.log('Last 5 items:');
        lastItems.forEach(item => {
            console.log(`ID: ${item.id}, Code: ${item.code}, Desc: ${item.description}, Date: ${new Date(parseInt(item.id.split('-')[0])).toLocaleString()}`);
        });

        // Check for the batch of items added in the last 10 minutes
        // The user uploaded recently.
        const now = Date.now();
        let count = 0;
        const lastTimestamp = parseInt(dataset[dataset.length - 1].id.split('-')[0]);

        console.log(`Last item timestamp: ${lastTimestamp} (${new Date(lastTimestamp).toLocaleString()})`);

        for (let i = dataset.length - 1; i >= 0; i--) {
            const ts = parseInt(dataset[i].id.split('-')[0]);
            // Check if within 5 minutes of the last item
            if (Math.abs(ts - lastTimestamp) < 300000) {
                count++;
            } else {
                break;
            }
        }
        console.log(`Items in the last batch (approx 5 min window): ${count}`);
    }

} catch (err) {
    console.error('Error:', err);
}
