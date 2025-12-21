import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

// GET /api/projects/[id] - Get single project with items
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = verifyToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }

        const { id } = await params;

        // Get project
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get project items
        const { data: items, error: itemsError } = await supabaseAdmin
            .from('project_items')
            .select('*')
            .eq('project_id', id);

        if (itemsError) throw itemsError;

        return NextResponse.json({ ...project, items: items || [] });
    } catch (error: any) {
        console.error('Get project error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = verifyToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }

        const { id } = await params;
        const { name, description, items, totalCost } = await request.json();

        // Verify ownership
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Update project
        await supabaseAdmin
            .from('projects')
            .update({ name, description, total_cost: totalCost })
            .eq('id', id);

        // Delete old items and insert new ones
        await supabaseAdmin.from('project_items').delete().eq('project_id', id);

        if (items && items.length > 0) {
            const projectItems = items.map((item: any) => ({
                id: randomUUID(),
                project_id: id,
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

            await supabaseAdmin.from('project_items').insert(projectItems);
        }

        return NextResponse.json({ success: true, projectId: id });
    } catch (error: any) {
        console.error('Update project error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = verifyToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }

        const { id } = await params;

        // Verify ownership
        const { data: project } = await supabaseAdmin
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Delete project (cascade will delete items)
        await supabaseAdmin.from('projects').delete().eq('id', id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete project error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
