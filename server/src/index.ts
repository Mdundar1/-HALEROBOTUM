import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import supabase from './supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { sendVerificationEmail, generateVerificationCode } from './email';
import db, { querySqlite } from './sqlite';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const _env_jwt_secret = process.env.JWT_SECRET;

if (!_env_jwt_secret) {
    if (process.env.NODE_ENV === 'production') {
        console.error('⚠️  FATAL: JWT_SECRET environment variable is missing in production. Exiting for security.');
        process.exit(1);
    } else {
        console.warn('CRITICAL WARNING: JWT_SECRET environment variable is missing. Authentication will NOT be secure. Fallback to "dev-secret" used.');
    }
}

const JWT_SECRET: string = (_env_jwt_secret || 'dev-secret-placeholder-for-startup') as string;

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware
const allowedOrigins = [
    'https://ihalerobotum.com',
    'https://www.ihalerobotum.com',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Upload Setup (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });

// --- Auth Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const optionalAuthenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            req.user = null;
            return next();
        }
        req.user = user;
        next();
    });
};

// --- In-Memory Dataset Storage (Cached from Supabase) ---
interface PozItem {
    id: string;
    code: string;
    description: string;
    unit: string;
    unitPrice: number;
}

let dataset: PozItem[] = [];

// Load dataset from Supabase on startup
async function loadDataset() {
    try {
        const { data, error } = await supabase
            .from('poz_items')
            .select('*')
            .order('code');

        if (error) throw error;

        dataset = (data || []).map((item: any) => ({
            id: item.id?.toString(),
            code: item.code,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unit_price
        }));

        console.log(`✓ Loaded ${dataset.length} items from Supabase poz_items`);
    } catch (error) {
        console.error('Error loading dataset from Supabase:', error);
        console.log('⚠️ Attempting fallback to SQLite...');

        try {
            // Fallback to SQLite
            const { querySqlite } = require('./sqlite');
            const rows = await querySqlite('SELECT * FROM poz_items ORDER BY code');

            dataset = rows.map((item: any) => ({
                id: item.id?.toString(),
                code: item.code,
                description: item.description,
                unit: item.unit,
                unitPrice: item.unit_price
            }));

            console.log(`Loaded ${dataset.length} items from SQLite poz_items`);
        } catch (sqliteError) {
            console.error('Error loading dataset from SQLite:', sqliteError);
        }
    }
}

// Load dataset on startup
loadDataset();

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        if (!phone) return res.status(400).json({ error: 'Telefon numarası gerekli' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = randomUUID();

        // Check if email already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create user with email_verified = true (Auto-verify until domain is ready)
        let { error: userError } = await supabase
            .from('users')
            .insert({
                id: userId,
                email,
                password: hashedPassword,
                name: name || '',
                phone,
                email_verified: true
            });

        // Fallback for missing 'phone' column in Supabase
        if (userError && (
            userError.message?.includes("column 'phone' of relation 'users' does not exist") ||
            userError.message?.includes("Could not find the 'phone' column")
        )) {
            console.warn('⚠️  Supabase "users" table is missing "phone" column. Attempting registration without phone.');
            const { error: retryError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    email,
                    password: hashedPassword,
                    name: name || '',
                    email_verified: true
                });
            userError = retryError;
        }

        if (userError) throw userError;

        // Create 3-day trial subscription
        const trialId = randomUUID();
        const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                id: trialId,
                user_id: userId,
                plan_id: null,
                status: 'trial',
                ends_at: trialEndsAt
            });

        if (subError) throw subError;

        // Generate token and auto-login
        const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: userId, email, name } });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify email with code
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

        // Find user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        if (user.email_verified) return res.status(400).json({ error: 'Email zaten doğrulanmış' });

        // Find valid verification code
        const { data: verificationCode, error: codeError } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('user_id', user.id)
            .eq('code', code)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (codeError || !verificationCode) {
            return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş kod' });
        }

        // Mark code as used
        await supabase
            .from('verification_codes')
            .update({ used: true })
            .eq('id', verificationCode.id);

        // Verify user
        await supabase
            .from('users')
            .update({ email_verified: true, verified_at: new Date().toISOString() })
            .eq('id', user.id);

        // Generate token and auto-login
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name },
            message: 'Email başarıyla doğrulandı!'
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Resend verification code
app.post('/api/auth/resend-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        // Find user
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        if (user.email_verified) return res.status(400).json({ error: 'Email zaten doğrulanmış' });

        // Invalidate old codes
        await supabase
            .from('verification_codes')
            .update({ used: true })
            .eq('user_id', user.id)
            .eq('used', false);

        // Generate new code
        const code = generateVerificationCode();
        const codeId = randomUUID();
        const expiryMinutes = parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '15');
        const expiresAt = new Date(Date.now() + expiryMinutes * 60000).toISOString();

        await supabase
            .from('verification_codes')
            .insert({ id: codeId, user_id: user.id, code, expires_at: expiresAt });

        // Send email
        const emailSent = await sendVerificationEmail(email, code);

        if (!emailSent) {
            return res.status(500).json({ error: 'Email gönderilemedi' });
        }

        res.json({ success: true, message: 'Yeni doğrulama kodu gönderildi' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Admin Routes ---
const ADMIN_EMAILS = ['admin@ihalerobotum.com', 'info@ihalerobotum.com', 'sigorta.mucahitdunder@gmail.com', 'admin@example.com'];

const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user || !ADMIN_EMAILS.includes(req.user.email.toLowerCase())) {
        return res.status(403).json({ error: 'Yönetici erişimi gerekli' });
    }
    next();
};

// --- Admin Plan Routes ---

// List all users with subscription details (Admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                id,
                name,
                email,
                created_at,
                subscriptions (
                    status,
                    ends_at,
                    subscription_plans (
                        name,
                        price
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Flatten the data structure
        const formattedUsers = (users || []).map((u: any) => {
            const sub = u.subscriptions?.[0];
            return {
                id: u.id,
                name: u.name,
                email: u.email,
                created_at: u.created_at,
                subscription_status: sub?.status || null,
                subscription_ends_at: sub?.ends_at || null,
                plan_name: sub?.subscription_plans?.name || null,
                plan_price: sub?.subscription_plans?.price || null
            };
        });

        res.json(formattedUsers);
    } catch (error: any) {
        console.error('Supabase error, attempting SQLite fallback for users:', error.message);
        try {
            const { querySqlite } = require('./sqlite');
            // Simplified query for users, joins might be tricky in raw SQL without ORM so we do basic join
            const sql = `
                SELECT 
                    u.id, u.name, u.email, u.created_at,
                    s.status as subscription_status,
                    s.ends_at as subscription_ends_at,
                    p.name as plan_name,
                    p.price as plan_price
                FROM users u
                LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status IN ('active', 'trial')
                LEFT JOIN subscription_plans p ON s.plan_id = p.id
                ORDER BY u.created_at DESC
            `;
            const rows = await querySqlite(sql);
            res.json(rows);
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

// List all plans (Admin)
app.get('/api/admin/plans', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data: plans, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('price', { ascending: true });

        if (error) throw error;
        res.json(plans || []);
    } catch (error: any) {
        console.error('Supabase error, attempting SQLite fallback for plans:', error.message);
        try {
            const { querySqlite } = require('./sqlite');
            const plans = await querySqlite('SELECT * FROM subscription_plans ORDER BY price ASC');
            // Ensure features is parsed if stored as string
            const parsedPlans = plans.map((p: any) => ({
                ...p,
                features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features
            }));
            res.json(parsedPlans);
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

// PUBLIC: List active plans for Homepage/Checkout
app.get('/api/subscription/plans', async (req, res) => {
    try {
        const { data: plans, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) throw error;
        res.json(plans || []);
    } catch (error: any) {
        console.error('Supabase error, falling back to SQLite:', error.message);
        try {
            const { querySqlite } = require('./sqlite');
            const plans = await querySqlite('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price ASC');
            res.json(plans || []);
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Create new plan
app.post('/api/admin/plans', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
        const { id, name, price, duration_months, features, is_active, discount_percent, tag } = req.body;

        if (!name || price === undefined || !duration_months) {
            return res.status(400).json({ error: 'Name, price, and duration are required' });
        }

        const planId = id || randomUUID();
        const featuresJson = typeof features === 'object' ? features : JSON.parse(features || '{}');

        const { error } = await supabase
            .from('subscription_plans')
            .insert({
                id: planId,
                name,
                price,
                duration_months,
                features: featuresJson,
                is_active: (is_active === true || is_active === 1 || is_active === undefined),
                discount_percent: discount_percent || 0,
                tag: tag || null
            });

        if (error) throw error;
        res.json({ success: true, id: planId });
    } catch (error: any) {
        console.error('Supabase plan create failed, attempting SQLite fallback:', error.message);
        try {
            const { id, name, price, duration_months, features, is_active, discount_percent, tag } = req.body;
            const planId = id || randomUUID();
            const featuresJson = typeof features === 'object' ? features : JSON.parse(features || '[]');
            const activeVal = (is_active === true || is_active === 1 || is_active === undefined) ? 1 : 0;

            await new Promise((resolve, reject) => {
                db?.run(
                    'INSERT OR REPLACE INTO subscription_plans (id, name, price, duration_months, features, is_active, discount_percent, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [planId, name, price, duration_months, JSON.stringify(featuresJson), activeVal, discount_percent || 0, tag || null],
                    (err: any) => {
                        if (err) reject(err);
                        else resolve(true);
                    }
                );
            });
            res.json({ success: true, id: planId });
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Update plan
app.put('/api/admin/plans/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
        const { name, price, duration_months, features, is_active, discount_percent, tag } = req.body;
        const planId = req.params.id;

        const featuresJson = typeof features === 'object' ? features : JSON.parse(features || '{}');

        const { error, count } = await supabase
            .from('subscription_plans')
            .update({
                name,
                price,
                duration_months,
                features: featuresJson,
                is_active: (is_active === true || is_active === 1 || is_active === undefined),
                discount_percent: discount_percent || 0,
                tag: tag || null
            })
            .eq('id', planId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        console.error('Supabase plan update failed, attempting SQLite fallback:', error.message);
        try {
            const { name, price, duration_months, features, is_active, discount_percent, tag } = req.body;
            const planId = req.params.id;
            const featuresJson = typeof features === 'object' ? features : JSON.parse(features || '[]');
            const activeVal = (is_active === true || is_active === 1 || is_active === undefined) ? 1 : 0;

            await new Promise((resolve, reject) => {
                db?.run(
                    'UPDATE subscription_plans SET name = ?, price = ?, duration_months = ?, features = ?, is_active = ?, discount_percent = ?, tag = ? WHERE id = ?',
                    [name, price, duration_months, JSON.stringify(featuresJson), activeVal, discount_percent || 0, tag || null, planId],
                    (err: any) => {
                        if (err) reject(err);
                        else resolve(true);
                    }
                );
            });
            res.json({ success: true });
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Delete plan
app.delete('/api/admin/plans/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const planId = req.params.id;

        // Check if any subscription uses this plan (Supabase)
        try {
            const { count } = await supabase
                .from('subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('plan_id', planId);

            if (count && count > 0) {
                // Soft delete if used
                await supabase
                    .from('subscription_plans')
                    .update({ is_active: false })
                    .eq('id', planId);
                return res.json({ success: true, message: 'Plan deactivated because it is in use.' });
            }

            await supabase
                .from('subscription_plans')
                .delete()
                .eq('id', planId);

            res.json({ success: true });
        } catch (sbError: any) {
            console.log('Supabase delete failed, attempting SQLite fallback for Plan ID:', planId);
            try {
                // Check usage in SQLite
                const subCount = await querySqlite('SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ?', [planId]);
                const count = subCount[0]?.count || 0;
                console.log(`SQLite: Plan ${planId} usage count: ${count}`);

                if (count > 0) {
                    await new Promise((resolve, reject) => {
                        db?.run('UPDATE subscription_plans SET is_active = 0 WHERE id = ?', [planId], (err: any) => {
                            if (err) {
                                console.error('SQLite update error:', err);
                                reject(err);
                            }
                            else resolve(true);
                        });
                    });
                    console.log(`SQLite: Plan ${planId} deactivated.`);
                    return res.json({ success: true, message: 'Plan deactivated because it is in use (SQLite).' });
                }

                // Delete from SQLite
                await new Promise((resolve, reject) => {
                    db?.run('DELETE FROM subscription_plans WHERE id = ?', [planId], (err: any) => {
                        if (err) {
                            console.error('SQLite delete error:', err);
                            reject(err);
                        }
                        else resolve(true);
                    });
                });

                console.log(`SQLite: Plan ${planId} deleted successfully.`);
                res.json({ success: true });
            } catch (sqliteError: any) {
                console.error('SQLite delete fallback failed:', sqliteError);
                throw sbError; // Throw original error if fallback fails
            }
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
        // Total Users
        const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // Active Subscriptions
        const { count: subCount } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gt('ends_at', new Date().toISOString());

        // Passive/Expired Subscriptions
        const { count: passiveSubCount } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .or(`status.neq.active,ends_at.lte.${new Date().toISOString()}`);

        // Today's Signups
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

        // Daily Signups for Chart (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentUsers } = await supabase
            .from('users')
            .select('created_at')
            .gte('created_at', thirtyDaysAgo.toISOString());

        // Group by date
        const dailySignups: { date: string; count: number }[] = [];
        const dateMap = new Map<string, number>();

        (recentUsers || []).forEach((u: any) => {
            const date = u.created_at.split('T')[0];
            dateMap.set(date, (dateMap.get(date) || 0) + 1);
        });

        dateMap.forEach((count, date) => {
            dailySignups.push({ date, count });
        });
        dailySignups.sort((a, b) => a.date.localeCompare(b.date));

        // Plan Distribution
        const { data: planData } = await supabase
            .from('subscriptions')
            .select(`
                subscription_plans (name)
            `)
            .eq('status', 'active');

        const planDistribution: { name: string; count: number }[] = [];
        const planMap = new Map<string, number>();

        (planData || []).forEach((s: any) => {
            const name = s.subscription_plans?.name || 'Unknown';
            planMap.set(name, (planMap.get(name) || 0) + 1);
        });

        planMap.forEach((count, name) => {
            planDistribution.push({ name, count });
        });

        // Revenue estimation
        const { data: proPlanData } = await supabase
            .from('subscriptions')
            .select('subscription_plans!inner(price)')
            .eq('status', 'active')
            .gt('subscription_plans.price', 0);

        const revenue = (proPlanData || []).reduce((sum: number, s: any) => sum + (s.subscription_plans?.price || 0), 0);

        res.json({
            userCount: userCount || 0,
            subCount: subCount || 0,
            passiveSubCount: passiveSubCount || 0,
            todayCount: todayCount || 0,
            revenue,
            dailySignups,
            planDistribution
        });
    } catch (error: any) {
        console.error('Supabase error, attempting SQLite fallback for stats:', error.message);
        try {
            const { querySqlite } = require('./sqlite');

            // 1. User Count
            const userCountRes = await querySqlite('SELECT COUNT(*) as count FROM users');
            const userCount = userCountRes[0]?.count || 0;

            // 2. Active Subs
            const now = new Date().toISOString();
            const subCountRes = await querySqlite(`SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND ends_at > ?`, [now]);
            const subCount = subCountRes[0]?.count || 0;

            // 3. Passive Subs
            const passiveSubCountRes = await querySqlite(`SELECT COUNT(*) as count FROM subscriptions WHERE status != 'active' OR ends_at <= ?`, [now]);
            const passiveSubCount = passiveSubCountRes[0]?.count || 0;

            // 4. Today Count
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayCountRes = await querySqlite(`SELECT COUNT(*) as count FROM users WHERE created_at >= ?`, [today.toISOString()]);
            const todayCount = todayCountRes[0]?.count || 0;

            // 5. Daily Signups
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentUsers = await querySqlite(`SELECT created_at FROM users WHERE created_at >= ?`, [thirtyDaysAgo.toISOString()]);

            const dailySignups: { date: string; count: number }[] = [];
            const dateMap = new Map<string, number>();
            (recentUsers || []).forEach((u: any) => {
                const date = u.created_at.split('T')[0];
                dateMap.set(date, (dateMap.get(date) || 0) + 1);
            });
            dateMap.forEach((count, date) => dailySignups.push({ date, count }));
            dailySignups.sort((a, b) => a.date.localeCompare(b.date));

            // 6. Plan Distribution
            const planData = await querySqlite(`
                SELECT p.name 
                FROM subscriptions s 
                JOIN subscription_plans p ON s.plan_id = p.id 
                WHERE s.status = 'active'
            `);
            const planDistribution: { name: string; count: number }[] = [];
            const planMap = new Map<string, number>();
            (planData || []).forEach((s: any) => {
                const name = s.name || 'Unknown';
                planMap.set(name, (planMap.get(name) || 0) + 1);
            });
            planMap.forEach((count, name) => planDistribution.push({ name, count }));

            // 7. Revenue
            const proPlanData = await querySqlite(`
                SELECT p.price 
                FROM subscriptions s 
                JOIN subscription_plans p ON s.plan_id = p.id 
                WHERE s.status = 'active' AND p.price > 0
            `);
            const revenue = (proPlanData || []).reduce((sum: number, s: any) => sum + (s.price || 0), 0);

            res.json({
                userCount,
                subCount,
                passiveSubCount,
                todayCount,
                revenue,
                dailySignups,
                planDistribution
            });

        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/admin/users/:id', authenticateToken, requireAdmin, async (req: any, res) => {
    try {
        const userId = req.params.id;

        const { data: user, error } = await supabase
            .from('users')
            .select(`
                id, email, name, phone, created_at, email_verified,
                company_name, tax_office, tax_number, billing_address,
                subscriptions (
                    status,
                    ends_at,
                    subscription_plans (name)
                )
            `)
            .eq('id', userId)
            .single();

        if (error || !user) return res.status(404).json({ error: 'User not found' });

        const sub = (user as any).subscriptions?.[0];
        const formattedUser = {
            ...user,
            sub_status: sub?.status || null,
            plan_name: sub?.subscription_plans?.name || null,
            sub_ends_at: sub?.ends_at || null
        };
        delete (formattedUser as any).subscriptions;

        // Get projects
        const { data: projects } = await supabase
            .from('projects')
            .select('id, name, created_at, total_cost')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        res.json({ ...formattedUser, projects: projects || [] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Purchase Route ---
app.post('/api/subscriptions/purchase', authenticateToken, async (req: any, res) => {
    try {
        const { planId, companyName, taxOffice, taxNumber, billingAddress } = req.body;
        const userId = req.user.id;

        if (!planId) return res.status(400).json({ error: 'Plan ID required' });

        // 1. Update User Billing Info
        await supabase
            .from('users')
            .update({
                company_name: companyName,
                tax_office: taxOffice,
                tax_number: taxNumber,
                billing_address: billingAddress
            })
            .eq('id', userId);

        // 2. Get Plan Details
        const { data: plan, error: planError } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', planId)
            .single();

        if (planError || !plan) return res.status(404).json({ error: 'Plan not found' });

        // 3. Create Subscription
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + (plan.duration_months || 1));

        const subId = randomUUID();

        // Deactivate old subscriptions
        await supabase
            .from('subscriptions')
            .update({ status: 'expired' })
            .eq('user_id', userId);

        // Insert new subscription
        const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                id: subId,
                user_id: userId,
                plan_id: planId,
                status: 'active',
                starts_at: startDate.toISOString(),
                ends_at: endDate.toISOString()
            });

        if (subError) throw subError;

        res.json({ success: true, message: 'Subscription active', subscriptionId: subId });
    } catch (error: any) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        email = email?.trim();
        password = password?.trim();

        let user;

        // Try Supabase first
        const { data: sbUser, error: sbError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (sbError || !sbUser) {
            console.log('Supabase login failed or user not found, attempting SQLite fallback...');
            try {
                const { querySqlite } = require('./sqlite');
                const rows = await querySqlite('SELECT * FROM users WHERE email = ?', [email]);
                if (rows && rows.length > 0) {
                    user = rows[0];
                    console.log('User found in SQLite:', user.email);
                }
            } catch (sqliteError) {
                console.error('SQLite fallback failed:', sqliteError);
            }
        } else {
            user = sbUser;
        }

        if (!user) return res.status(400).json({ error: 'Kullanıcı bulunamadı' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Şifre hatalı' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Subscription Check Route ---
app.get('/api/subscription/status', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select(`
                *,
                subscription_plans (name)
            `)
            .eq('user_id', userId)
            .in('status', ['active', 'trial'])
            .gt('ends_at', new Date().toISOString())
            .order('ends_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"

        if (subscription) {
            res.json({
                hasActiveSubscription: true,
                status: subscription.status,
                planName: subscription.subscription_plans?.name || 'Deneme Sürümü',
                endsAt: subscription.ends_at,
                isTrial: subscription.status === 'trial'
            });
        } else {
            res.json({
                hasActiveSubscription: false,
                status: 'expired',
                planName: null,
                endsAt: null,
                isTrial: false
            });
        }
    } catch (error: any) {
        console.error('Supabase error, attempting SQLite fallback for subscription status:', error.message);
        try {
            const { querySqlite } = require('./sqlite');
            const now = new Date().toISOString();

            // Note: Join syntax is slightly different or we do two queries
            const sql = `
                SELECT s.*, p.name as plan_name
                FROM subscriptions s
                LEFT JOIN subscription_plans p ON s.plan_id = p.id
                WHERE s.user_id = ? 
                AND s.status IN ('active', 'trial')
                AND s.ends_at > ?
                ORDER BY s.ends_at DESC
                LIMIT 1
            `;
            const rows = await querySqlite(sql, [req.user.id, now]);
            const subscription = rows[0];

            if (subscription) {
                res.json({
                    hasActiveSubscription: true,
                    status: subscription.status,
                    planName: subscription.plan_name || 'Deneme Sürümü',
                    endsAt: subscription.ends_at,
                    isTrial: subscription.status === 'trial'
                });
            } else {
                res.json({
                    hasActiveSubscription: false,
                    status: 'expired',
                    planName: null,
                    endsAt: null,
                    isTrial: false
                });
            }

        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

// --- User Profile Routes ---
app.get('/api/user/profile', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;
        let userData: any = null;

        // 1. Fetch user data (Supabase with SQLite fallback)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, name, phone, company, created_at')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            try {
                const { querySqlite } = require('./sqlite');
                const rows = await querySqlite('SELECT id, email, name, phone, company, created_at FROM users WHERE id = ?', [userId]);
                if (rows && rows.length > 0) {
                    userData = rows[0];
                }
            } catch (sqError) { }
        } else {
            userData = user;
        }

        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Fetch subscription using helper (consistent with /api/subscription/status)
        const subscription = await getSubscription(userId);

        res.json({
            user: userData,
            subscription: subscription ? {
                status: subscription.status,
                planName: (subscription as any).subscription_plans?.name || (subscription as any).plan_name || 'Deneme Sürümü',
                startsAt: subscription.starts_at,
                endsAt: subscription.ends_at,
                hasActiveSubscription: true
            } : {
                hasActiveSubscription: false,
                status: 'expired',
                planName: null,
                endsAt: null
            }
        });
    } catch (error: any) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/user/profile', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { email, phone, company } = req.body;

        const { error } = await supabase
            .from('users')
            .update({ email, phone, company })
            .eq('id', userId);

        if (error) throw error;

        // Sync with SQLite
        try {
            const db = require('./sqlite').default;
            db?.run('UPDATE users SET email = ?, phone = ?, company = ? WHERE id = ?', [email, phone, company, userId]);
        } catch (sqError) { }

        res.json({ success: true, message: 'Profile updated' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Project Routes ---
app.get('/api/projects', authenticateToken, async (req: any, res) => {
    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(projects || []);
    } catch (error: any) {
        console.error('Supabase error, attempting SQLite fallback for projects list:', error.message);
        try {
            const { querySqlite } = require('./sqlite');
            const rows = await querySqlite('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
            res.json(rows);
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/projects/:id', authenticateToken, async (req: any, res) => {
    try {
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (projectError || !project) {
            if (projectError && projectError.code !== 'PGRST116') throw projectError;
            // If not found in supabase, throw to catch block if error exists, or handle as not found?
            // Actually, if supbase connects but returns null, we might not want to check sqlite?
            // But if supbase FAILS (throw), we check sqlite.
            // If simply not found, we might assume it's not there.
            // But let's assume we want to fall back if 'error' is network related.
            if (projectError) throw projectError;
            return res.status(404).json({ error: 'Project not found' });
        }

        const { data: items, error: itemsError } = await supabase
            .from('project_items')
            .select('*')
            .eq('project_id', req.params.id);

        if (itemsError) throw itemsError;

        res.json({ ...project, items: items || [] });
    } catch (error: any) {
        console.error('Supabase error, attempting SQLite fallback for project details:', error.message);
        try {
            const { querySqlite } = require('./sqlite');
            const projectRows = await querySqlite('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            const project = projectRows[0];

            if (!project) return res.status(404).json({ error: 'Project not found' });

            const items = await querySqlite('SELECT * FROM project_items WHERE project_id = ?', [req.params.id]);
            res.json({ ...project, items: items || [] });
        } catch (sqliteError: any) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.post('/api/projects', authenticateToken, async (req: any, res) => {
    try {
        const userId = req.user.id;

        // --- Subscription & Limit Check ---
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('*, subscription_plans(name)')
            .eq('user_id', userId)
            .in('status', ['active', 'trial'])
            .gt('ends_at', new Date().toISOString())
            .order('ends_at', { ascending: false })
            .limit(1)
            .single();

        const planName = subscription?.subscription_plans?.name || (subscription?.status === 'trial' ? 'Deneme Sürümü' : null);

        if (planName === 'Standart' || planName === 'Deneme Sürümü') {
            const { count, error: countError } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (countError) throw countError;

            if (count !== null && count >= 10) {
                return res.status(403).json({
                    error: 'Proje limitine ulaştınız. Standart paket ve deneme sürümü için limit 10 projedir. Profesyonel pakete geçerek sınırsız proje oluşturabilirsiniz.'
                });
            }
        }
        // --- End of Limit Check ---

        const { name, description, items, totalCost, tenderRegistrationNumber } = req.body;
        const projectId = randomUUID();

        const { error: projectError } = await supabase
            .from('projects')
            .insert({
                id: projectId,
                user_id: req.user.id,
                name,
                description,
                total_cost: totalCost,
                tender_registration_number: tenderRegistrationNumber || null
            });

        if (projectError) throw projectError;

        // Insert items
        if (items && items.length > 0) {
            const itemsToInsert = items.map((item: any) => ({
                id: randomUUID(),
                project_id: projectId,
                raw_line: item.rawLine,
                unit: item.unit || null,
                matched_poz_code: item.matchedPoz?.code || null,
                matched_poz_description: item.matchedPoz?.description || null,
                matched_poz_unit: item.matchedPoz?.unit || null,
                matched_poz_unit_price: item.matchedPoz?.unitPrice || 0,
                quantity: item.quantity,
                total_price: item.totalPrice,
                match_score: item.matchScore
            }));

            const { error: itemsError } = await supabase
                .from('project_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

        res.json({ success: true, projectId });
    } catch (error: any) {
        console.error('Save project error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/projects/:id', authenticateToken, async (req: any, res) => {
    try {
        const { name, description, items, totalCost, tenderRegistrationNumber } = req.body;
        const projectId = req.params.id;

        // Verify ownership
        const { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .eq('user_id', req.user.id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Update project
        await supabase
            .from('projects')
            .update({
                name,
                description,
                total_cost: totalCost,
                tender_registration_number: tenderRegistrationNumber || null
            })
            .eq('id', projectId);

        // Delete old items
        await supabase
            .from('project_items')
            .delete()
            .eq('project_id', projectId);

        // Insert new items
        if (items && items.length > 0) {
            const itemsToInsert = items.map((item: any) => ({
                id: randomUUID(),
                project_id: projectId,
                raw_line: item.rawLine,
                unit: item.unit || null,
                matched_poz_code: item.matchedPoz?.code || null,
                matched_poz_description: item.matchedPoz?.description || null,
                matched_poz_unit: item.matchedPoz?.unit || null,
                matched_poz_unit_price: item.matchedPoz?.unitPrice || 0,
                quantity: item.quantity,
                total_price: item.totalPrice,
                match_score: item.matchScore
            }));

            await supabase
                .from('project_items')
                .insert(itemsToInsert);
        }

        res.json({ success: true, projectId });
    } catch (error: any) {
        console.error('Update project error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE project
app.delete('/api/projects/:id', authenticateToken, async (req: any, res) => {
    try {
        const projectId = req.params.id;

        // Verify ownership
        const { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .eq('user_id', req.user.id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Delete project (cascade will delete items too)
        await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Subscription Helper ---
const getSubscription = async (userId: string) => {
    try {
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select(`
                *,
                subscription_plans (name)
            `)
            .eq('user_id', userId)
            .in('status', ['active', 'trial'])
            .gt('ends_at', new Date().toISOString())
            .order('ends_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return subscription;
    } catch (e) {
        return null;
    }
};

// --- Subscription Middleware ---
const requireSubscription = async (req: any, res: any, next: any) => {
    try {
        const userId = req.user.id;
        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['active', 'trial'])
            .gt('ends_at', new Date().toISOString())
            .order('ends_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !subscription) {
            return res.status(403).json({
                error: 'Aktif bir üyeliğiniz bulunmamaktadır veya deneme süreniz sona ermiştir.',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }
        req.subscription = subscription;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Abonelik kontrolü başarısız oldu' });
    }
};

app.get('/api/dataset', optionalAuthenticateToken, async (req: any, res) => {
    try {
        let hasActiveSubscription = false;
        if (req.user) {
            const sub = await getSubscription(req.user.id);
            hasActiveSubscription = !!sub;
        }

        const { data: items, error } = await supabase
            .from('poz_items')
            .select('*')
            .order('code');

        if (error) throw error;

        const formattedItems = (items || []).map((item: any) => ({
            id: item.id?.toString(),
            code: item.code,
            description: item.description,
            unit: item.unit,
            unitPrice: hasActiveSubscription ? item.unit_price : 0
        }));

        res.json({ items: formattedItems, count: formattedItems.length });
    } catch (error: any) {
        console.error('Dataset fetch error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/dataset/upload', authenticateToken, requireAdmin, upload.single('file'), async (req: any, res: any) => {
    try {
        // Handle JSON body import
        if (req.is('json')) {
            const { items } = req.body;
            if (!Array.isArray(items)) return res.status(400).json({ error: 'Array expected' });

            let addedCount = 0;
            for (const item of items) {
                const { error } = await supabase
                    .from('poz_items')
                    .upsert({
                        code: item.code,
                        description: item.description,
                        unit: item.unit,
                        unit_price: item.unitPrice || item.unit_price || 0
                    }, { onConflict: 'code' });

                if (!error) addedCount++;
            }

            // Reload dataset cache
            await loadDataset();

            return res.json({ success: true, addedCount, message: `${addedCount} kayıt eklendi.` });
        }

        // Handle File Upload (Excel/JSON)
        if (!req.file && !req.body.items) {
            return res.status(400).json({ error: 'No file or items provided' });
        }

        if (req.file) {
            const buffer = req.file.buffer;
            let items: any[] = [];

            // Parse Excel
            if (req.file.originalname.match(/\.(xlsx|xls)$/i)) {
                const XLSX = require('xlsx');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                for (let i = 1; i < jsonData.length; i++) {
                    const row: any = jsonData[i];
                    if (row && row.length >= 2) {
                        items.push({
                            code: row[0]?.toString().trim(),
                            description: row[1]?.toString().trim(),
                            unit: row[2]?.toString().trim(),
                            unit_price: parseFloat(row[3]) || 0
                        });
                    }
                }
            } else if (req.file.originalname.match(/\.json$/i)) {
                const jsonContent = JSON.parse(buffer.toString('utf-8'));
                if (Array.isArray(jsonContent)) {
                    items = jsonContent;
                } else if (jsonContent.items && Array.isArray(jsonContent.items)) {
                    items = jsonContent.items;
                }
            }

            if (items.length > 0) {
                let addedCount = 0;
                for (const item of items) {
                    if (!item.code || !item.description) continue;

                    const { error } = await supabase
                        .from('poz_items')
                        .upsert({
                            code: item.code,
                            description: item.description,
                            unit: item.unit || '',
                            unit_price: item.unitPrice || item.unit_price || 0
                        }, { onConflict: 'code' });

                    if (!error) addedCount++;
                }

                // Reload dataset cache
                await loadDataset();

                return res.json({ success: true, addedCount, message: `${addedCount} kayıt eklendi.` });
            } else {
                return res.status(400).json({ error: 'Dosyadan veri okunamadı veya format hatalı.' });
            }
        }

        return res.status(400).json({ error: 'Geçersiz istek.' });

    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/dataset', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await supabase
            .from('poz_items')
            .delete()
            .neq('id', 0); // Delete all rows

        dataset = [];
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/dataset/item/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { code, description, unit, unitPrice } = req.body;

        const { error, count } = await supabase
            .from('poz_items')
            .update({
                code,
                description,
                unit,
                unit_price: unitPrice
            })
            .eq('id', req.params.id);

        if (error) throw error;

        // Reload dataset cache
        await loadDataset();

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to extract technical specs (dimensions, units, calculations)
function extractTechnicalSpecs(text: string): string[] {
    const specs: string[] = [];
    const t = text.toLowerCase();

    const calcRegex = /\(\s*\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?\s*\)\s*=\s*\d+(?:[.,]\d+)?/g;
    const calcs = t.match(calcRegex);
    if (calcs) specs.push(...calcs);

    const dimRegex = /\b\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?\b/g;
    const dims = t.match(dimRegex);
    if (dims) specs.push(...dims);

    const unitRegex = /\b\d+(?:[.,]\d+)?\s*(?:mm2|mm|cm|m|Ø|kg|ton|kw|kva|a|v)\b/g;
    const units = t.match(unitRegex);
    if (units) specs.push(...units);

    return specs;
}

// Fuzzy matching helper
function fuzzyMatch(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 100;
    if (s1.includes(s2) || s2.includes(s1)) return 80;

    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    let matches = 0;

    for (const w1 of words1) {
        for (const w2 of words2) {
            if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
                matches++;
                break;
            }
        }
    }

    return (matches / Math.max(words1.length, words2.length)) * 100;
}

// Matching API
app.post('/api/match', optionalAuthenticateToken, upload.single('file'), async (req: any, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Check subscription status
        let hasActiveSubscription = false;
        if (req.user) {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', req.user.id)
                .in('status', ['active', 'trial'])
                .gt('ends_at', new Date().toISOString())
                .order('ends_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            hasActiveSubscription = !!subscription;
        }

        if (dataset.length === 0) {
            await loadDataset();
            if (dataset.length === 0) {
                return res.status(400).json({ error: 'No dataset available.' });
            }
        }

        const fileContent = file.buffer.toString('utf-8');
        const lines = fileContent.split('\n').filter((l: string) => l.trim().length > 5);

        const results = lines.map((rawLine: string, index: number) => {
            let bestMatch: PozItem | null = null;
            let bestScore = 0;

            const codeMatch = rawLine.match(/(\d{1,2}\.\d{3}\.\d{3,4})/);
            const inputSpecs = extractTechnicalSpecs(rawLine);

            for (const item of dataset) {
                if (!item.description || item.description.length < 3) continue;

                let score = 0;
                if (codeMatch && item.code === codeMatch[1]) {
                    score = 100;
                } else {
                    score = fuzzyMatch(rawLine, item.description);
                    if (inputSpecs.length > 0) {
                        const itemSpecs = extractTechnicalSpecs(item.description);
                        let specMatches = 0;
                        let specConflicts = 0;
                        for (const spec of inputSpecs) {
                            const cleanSpec = spec.replace(/\s+/g, '');
                            if (itemSpecs.some(s => s.replace(/\s+/g, '') === cleanSpec)) {
                                specMatches++;
                            } else {
                                specConflicts++;
                            }
                        }
                        if (specMatches > 0) score += 20;
                        if (specConflicts > 0) score -= 30;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                }
            }

            const unitPrice = (hasActiveSubscription && bestMatch) ? bestMatch.unitPrice : 0;

            return {
                id: randomUUID(),
                rawLine,
                matchedPoz: bestMatch ? {
                    ...bestMatch,
                    unitPrice: hasActiveSubscription ? bestMatch.unitPrice : 0
                } : null,
                matchScore: bestScore,
                quantity: 1,
                totalPrice: unitPrice,
                isBlurred: !hasActiveSubscription
            };
        });

        results.sort((a: any, b: any) => b.matchScore - a.matchScore);
        res.json(results);
    } catch (error: any) {
        console.error('Match error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Static File Serving for Production ---
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// SPA Fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
