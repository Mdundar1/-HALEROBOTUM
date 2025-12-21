// Migration script to upload POZ dataset to Supabase using node-fetch
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Supabase credentials  
const supabaseUrl = 'https://fenwwvrgjfktchawbdk.supabase.co';
const supabaseServiceKey = 'sb_secret_kMrQCxwo2CTancJexgB4gw_Re97Ls89';

async function migrateDataset() {
    // Read the dataset
    const datasetPath = path.join(__dirname, '..', 'server', 'dataset.json');
    const rawData = fs.readFileSync(datasetPath, 'utf-8');
    const dataset = JSON.parse(rawData);

    console.log(`Found ${dataset.length} items to migrate`);

    // Transform data to match Supabase schema
    const items = dataset.map(item => ({
        code: item.code || '',
        description: item.description || '',
        unit: item.unit || null,
        unit_price: item.unitPrice || 0
    }));

    // Upload in batches of 100
    const batchSize = 100;
    let uploaded = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/poz_items`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(batch)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error batch ${Math.floor(i / batchSize) + 1}:`, response.status, errorText);
                errors++;
            } else {
                uploaded += batch.length;
                console.log(`Uploaded ${uploaded}/${items.length} items...`);
            }
        } catch (err) {
            console.error(`Network error batch ${Math.floor(i / batchSize) + 1}:`, err.message);
            errors++;
        }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total items: ${items.length}`);
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Errors: ${errors}`);
}

migrateDataset().catch(console.error);
