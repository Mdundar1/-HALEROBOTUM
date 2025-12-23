import supabase from './supabase';
import dotenv from 'dotenv';
dotenv.config();

// const supabaseUrl = process.env.SUPABASE_URL; ... removed because we use importing supabase

const plans = [
    // Başlangıç Plans
    { id: 'starter-3m', name: 'Başlangıç', price: 2299, duration_months: 3, features: ["1 Proje Hakkı", "Temel Metraj Analizi", "Standart Raporlama", "Poz Arama Motoru"], is_active: true },
    { id: 'starter-6m', name: 'Başlangıç', price: 3999, duration_months: 6, features: ["1 Proje Hakkı", "Temel Metraj Analizi", "Standart Raporlama", "Poz Arama Motoru"], is_active: true },
    { id: 'starter-12m', name: 'Başlangıç', price: 5999, duration_months: 12, features: ["1 Proje Hakkı", "Temel Metraj Analizi", "Standart Raporlama", "Poz Arama Motoru"], is_active: true },
    // Profesyonel Plans
    { id: 'pro-3m', name: 'Profesyonel', price: 2899, duration_months: 3, features: ["Sınırsız Proje", "Gelişmiş AI Analiz", "Excel & PDF Export", "7/24 Öncelikli Destek", "Güncel Birim Fiyatlar"], is_active: true, tag: 'En Popüler' },
    { id: 'pro-6m', name: 'Profesyonel', price: 4799, duration_months: 6, features: ["Sınırsız Proje", "Gelişmiş AI Analiz", "Excel & PDF Export", "7/24 Öncelikli Destek", "Güncel Birim Fiyatlar"], is_active: true, tag: 'En Popüler' },
    { id: 'pro-12m', name: 'Profesyonel', price: 7999, duration_months: 12, features: ["Sınırsız Proje", "Gelişmiş AI Analiz", "Excel & PDF Export", "7/24 Öncelikli Destek", "Güncel Birim Fiyatlar"], is_active: true, tag: 'En Popüler' }
];

async function updatePlans() {
    console.log('Clearing existing old variant ids if any...');
    // We should probably just upsert by ID. 
    // The user had 'starter' and 'pro' as IDs before. We will keep them or replace them.
    // Let's use clean IDs for the new structure.

    for (const plan of plans) {
        console.log(`Upserting ${plan.name} (${plan.duration_months} ay)...`);
        const { error } = await supabase
            .from('subscription_plans')
            .upsert({
                id: plan.id,
                name: plan.name,
                price: Math.round(plan.price / plan.duration_months), // We store MONTHLY price in DB usually to show /ay
                duration_months: plan.duration_months,
                features: JSON.stringify(plan.features),
                is_active: plan.is_active,
                tag: plan.tag || null
            }, { onConflict: 'id' });

        if (error) {
            console.error(`Error upserting ${plan.id}:`, error.message);
        }
    }

    // Deactivate old 'starter' and 'pro' IDs if they exist to avoid duplicates in the UI
    console.log('Deactivating legacy plan IDs...');
    await supabase.from('subscription_plans').update({ is_active: false }).in('id', ['starter', 'pro', 'plan-3-months', 'plan-6-months', 'plan-12-months']);

    console.log('Update complete!');
}

updatePlans();
