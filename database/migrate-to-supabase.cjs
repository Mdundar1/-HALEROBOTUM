// Migration script to upload POZ dataset to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials
const supabaseUrl = 'https://fenwwvrgjfktchawbdk.supabase.co';
const supabaseServiceKey = 'sb_secret_kMrQCxwo2CTancJexgB4gw_Re97Ls89';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Upload in batches of 500
    const batchSize = 500;
    let uploaded = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        const { error } = await supabase
            .from('poz_items')
            .upsert(batch, {
                onConflict: 'code',
                ignoreDuplicates: false
            });

        if (error) {
            console.error(`Error uploading batch ${i / batchSize + 1}:`, error.message);
            errors++;
        } else {
            uploaded += batch.length;
            console.log(`Uploaded ${uploaded}/${items.length} items...`);
        }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total items: ${items.length}`);
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Errors: ${errors}`);
}

migrateDataset().catch(console.error);
