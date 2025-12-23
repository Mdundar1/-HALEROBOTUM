import supabase from './supabase';

async function checkCount() {
    try {
        const { count, error } = await supabase
            .from('poz_items')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error fetching count:', error.message);
            return;
        }

        console.log('--- DB DIAGNOSTICS ---');
        console.log(`Total records in poz_items: ${count}`);

        const { data: latest, error: latestError } = await supabase
            .from('poz_items')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (latestError) {
            console.error('Error fetching latest items:', latestError.message);
        } else {
            console.log('Latest 5 items added:');
            latest?.forEach(item => {
                console.log(`- [${item.code}] ${item.description.substring(0, 30)}... (Price: ${item.unit_price})`);
            });
        }
        console.log('----------------------');
    } catch (err: any) {
        console.error('Check failed:', err.message);
    }
}

checkCount();
