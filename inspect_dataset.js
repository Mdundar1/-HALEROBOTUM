const fs = require('fs');
const path = require('path');

const datasetPath = path.join(__dirname, 'dataset.json');

try {
    const data = fs.readFileSync(datasetPath, 'utf8');
    const dataset = JSON.parse(data);

    console.log(`Total items: ${dataset.length}`);

    if (dataset.length > 0) {
        const lastItems = dataset.slice(-5);
        console.log('Last 5 items:');
        lastItems.forEach(item => {
            console.log(`ID: ${item.id}, Code: ${item.code}, Desc: ${item.description}, Date: ${new Date(parseInt(item.id.split('-')[0])).toLocaleString()}`);
        });

        // Check for the batch of 1215 items
        // We look at the timestamp of the last item and see how many items have a timestamp close to it (within 1 minute)
        const lastTimestamp = parseInt(dataset[dataset.length - 1].id.split('-')[0]);
        let count = 0;
        for (let i = dataset.length - 1; i >= 0; i--) {
            const ts = parseInt(dataset[i].id.split('-')[0]);
            if (Math.abs(ts - lastTimestamp) < 60000) { // 1 minute window
                count++;
            } else {
                break;
            }
        }
        console.log(`Items in the last batch (approx 1 min window): ${count}`);
    }

} catch (err) {
    console.error('Error:', err);
}
