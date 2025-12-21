import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to verify JWT and get user
function verifyToken(request: Request): { id: string; email: string } | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        return jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    } catch {
        return null;
    }
}

// GET /api/projects - List user's projects
export async function GET(request: Request) {
    try {
        const user = verifyToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: 'Veritabanı bağlantısı kurulamadı' },
                { status: 500 }
            );
        }

        const { data: projects, error } = await supabaseAdmin
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(projects || []);
    } catch (error: any) {
        console.error('Get projects error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/projects - Create new project
export async function POST(request: Request) {
    try {
        const user = verifyToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, description, items, totalCost } = await request.json();
        const projectId = randomUUID();

        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: 'Veritabanı bağlantısı kurulamadı' },
                { status: 500 }
            );
        }

        // Insert project
        const { error: projectError } = await supabaseAdmin
            .from('projects')
            .insert({
                id: projectId,
                user_id: user.id,
                name,
                description,
                total_cost: totalCost,
            });

        if (projectError) throw projectError;

        // Insert project items
        if (items && items.length > 0) {
            const projectItems = items.map((item: any) => ({
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
                match_score: item.matchScore,
            }));

            const { error: itemsError } = await supabaseAdmin
                .from('project_items')
                .insert(projectItems);

            if (itemsError) throw itemsError;
        }

        return NextResponse.json({ success: true, projectId });
    } catch (error: any) {
        console.error('Create project error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
