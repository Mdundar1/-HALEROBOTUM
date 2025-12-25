const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server/database.sqlite');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

try {
    // 1. Recreate table to ensure schema matches (with is_active column!)
    console.log('Recreating subscription_plans table...');
    db.exec('DROP TABLE IF EXISTS subscription_plans');
    db.exec(`
        CREATE TABLE subscription_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            duration_months INTEGER NOT NULL,
            features TEXT,
            discount_rate REAL DEFAULT 0,
            badge_text TEXT,
            tier TEXT DEFAULT 'standard',
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Insert new plans with proper features and is_active = 1
    console.log('Inserting new 1/6/12 Month plans for Free, Standard and Pro...');
    const insertPlan = db.prepare('INSERT INTO subscription_plans (id, name, price, duration_months, features, tier, badge_text, discount_rate, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)');

    const featuresFree = JSON.stringify({ list: ['10 Analiz Hakkı', 'Temel Raporlar', 'Sınırlı Birim Fiyat Erişimi'] });
    const featuresStd = JSON.stringify({ list: ['Sınırsız analiz', 'Tüm birim fiyatlar', 'Excel dışa aktırma', 'Teknik destek', 'Güncel veritabanı erişimi'] });
    const featuresPro = JSON.stringify({ list: ['Yapay Zeka Destekli Tahmin', 'Sınırsız Proje Yönetimi', 'Ekip Çalışması (5 Kişi)', 'Gelişmiş Excel/PDF Raporları', 'Öncelikli 7/24 Destek', 'Resmi Kurum Pozları (Tam Erişim)', 'API Erişimi'] });

    const plans = [
        // FREE Plan
        { id: 'plan-free', name: 'FREE', price: 0, duration_months: 1, features: featuresFree, tier: 'free', badge: null, discount: 0 },

        // Standard Plans (UI: Başlangıç)
        { id: 'plan-std-1m', name: 'Standart', price: 1299, duration_months: 1, features: featuresStd, tier: 'standard', badge: null, discount: 0 },
        { id: 'plan-std-3m', name: 'Standart', price: 2499, duration_months: 3, features: featuresStd, tier: 'standard', badge: null, discount: 0 },
        { id: 'plan-std-12m', name: 'Standart', price: 6999, duration_months: 12, features: featuresStd, tier: 'standard', badge: 'En Popüler', discount: 0 },

        // Professional Plans (UI: Profesyonel)
        { id: 'plan-pro-1m', name: 'Profesyonel', price: 1499, duration_months: 1, features: featuresPro, tier: 'pro', badge: null, discount: 0 },
        { id: 'plan-pro-3m', name: 'Profesyonel', price: 2899, duration_months: 3, features: featuresPro, tier: 'pro', badge: null, discount: 0 },
        { id: 'plan-pro-12m', name: 'Profesyonel', price: 7999, duration_months: 12, features: featuresPro, tier: 'pro', badge: 'En Popüler', discount: 0 }
    ];

    plans.forEach(plan => {
        insertPlan.run(plan.id, plan.name, plan.price, plan.duration_months, plan.features, plan.tier, plan.badge, plan.discount);
    });

    console.log('SUCCESS: Plans updated with Free, Standard and Pro tiers.');

    // Verify
    const currentPlans = db.prepare('SELECT * FROM subscription_plans').all();
    console.log('Current Plans in DB:', JSON.stringify(currentPlans, null, 2));

} catch (error) {
    console.error('ERROR:', error);
}
