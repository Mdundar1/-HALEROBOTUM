
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function seed() {
    console.log('Seeding database...');

    // 1. Create Admin User
    const email = 'admin@ihalerobotum.com';
    const password = '123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const adminExists = await query('SELECT id FROM users WHERE email = ?', [email]);

    if (adminExists.length === 0) {
        await run(`
            INSERT INTO users (id, email, password, name, role, email_verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, email, hashedPassword, 'Admin User', 'admin', 1, new Date().toISOString()]);
        console.log(`User created: ${email} / ${password}`);
    } else {
        await run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
        console.log(`Admin user password reset to: ${password}`);
    }

    // 2. Create Plans
    const plans = [
        { name: 'Ücretsiz', price: 0, duration: 1, features: ['1 Proje', 'Temel Analiz'] },
        { name: 'Pro', price: 299, duration: 1, features: ['Sınırsız Proje', 'Gelişmiş Analiz', 'Excel Export'] }
    ];

    for (const plan of plans) {
        const planExists = await query('SELECT id FROM subscription_plans WHERE name = ?', [plan.name]);
        if (planExists.length === 0) {
            await run(`
                INSERT INTO subscription_plans (id, name, price, duration_months, features, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [randomUUID(), plan.name, plan.price, plan.duration, JSON.stringify(plan.features), 1]);
            console.log(`Plan created: ${plan.name}`);
        }
    }

    // 3. Assign Subscription to Admin (Pro)
    const adminUser = (await query('SELECT id FROM users WHERE email = ?', [email]))[0];
    const proPlan = (await query('SELECT id FROM subscription_plans WHERE name = ?', ['Pro']))[0];

    if (adminUser && proPlan) {
        const subExists = await query('SELECT id FROM subscriptions WHERE user_id = ?', [adminUser.id]);
        if (subExists.length === 0) {
            await run(`
                INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [randomUUID(), adminUser.id, proPlan.id, 'active', new Date().toISOString(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()]);
            console.log('Admin subscription created.');
        }
    }

    console.log('Seeding complete.');
}

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

seed().then(() => db.close()).catch(err => {
    console.error('Seeding failed:', err);
    db.close();
});
