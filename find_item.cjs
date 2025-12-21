const fs = require('fs');
const path = require('path');

const datasetPath = path.join(__dirname, 'server/dataset.json');

try {
    const data = fs.readFileSync(datasetPath, 'utf8');
    const dataset = JSON.parse(data);

    const targetCode = '25.100.1012';
    const item = dataset.find(i => i.code === targetCode);

    if (item) {
        console.log('Found Item:');
        console.log(JSON.stringify(item, null, 2));
    } else {
        console.log(`Item ${targetCode} not found.`);
    }

} catch (err) {
    console.error('Error:', err);
}
