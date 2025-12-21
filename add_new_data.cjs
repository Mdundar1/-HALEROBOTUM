const fs = require('fs');
const path = require('path');

// Paths
const DATASET_PATH = path.join(__dirname, 'server', 'dataset.json');
const NEW_DATA_PATH = path.join(__dirname, 'test_new_data.json');

// Load existing dataset
console.log('📂 Mevcut dataset yükleniyor...');
const existingDataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
console.log(`✓ Mevcut dataset: ${existingDataset.length} kayıt`);

// Load new data
console.log('\n📂 Yeni veriler yükleniyor...');
const newData = JSON.parse(fs.readFileSync(NEW_DATA_PATH, 'utf-8'));
console.log(`✓ Yeni veriler: ${newData.length} kayıt`);

// Check for duplicates
const existingCodes = new Set(existingDataset.map(item => item.code));
let duplicateCount = 0;
let addedCount = 0;

const itemsToAdd = [];

newData.forEach((item, idx) => {
    if (existingCodes.has(item.code)) {
        duplicateCount++;
        console.log(`⚠ Duplicate bulundu: ${item.code}`);
    } else {
        const newItem = {
            id: `${Date.now()}-${idx}`,
            code: item.code,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice
        };
        itemsToAdd.push(newItem);
        existingCodes.add(item.code);
        addedCount++;
    }
});

// Add new items
if (itemsToAdd.length > 0) {
    const updatedDataset = [...existingDataset, ...itemsToAdd];

    // Save updated dataset
    fs.writeFileSync(DATASET_PATH, JSON.stringify(updatedDataset, null, 2), 'utf-8');
    console.log(`\n✓ Dataset güncellendi!`);
    console.log(`  - Eklenen kayıt: ${addedCount}`);
    console.log(`  - Atlanan duplicate: ${duplicateCount}`);
    console.log(`  - Toplam kayıt: ${updatedDataset.length}`);
} else {
    console.log(`\n⚠ Hiçbir yeni kayıt eklenmedi. Tüm kayıtlar zaten mevcut (${duplicateCount} duplicate)`);
}
