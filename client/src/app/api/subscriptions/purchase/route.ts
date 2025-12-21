import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyToken(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    try {
        const token = authHeader.split(' ')[1];
        return jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    } catch {
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const user = verifyToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!supabaseAdmin) throw new Error('DB connection failed');

        const { planId, period } = await request.json(); // period: 'monthly', '3_months', etc.

        // Mock Payment Success - In real world, initialize PayTR/Iyzico here

        // Find Plan (Mocking plan ID logic or fetching from DB)
        // Assuming plans are seeded. If not, we just create a sub with raw values or use a fixed logic.
        // Let's assume we fetch a plan by name or create one dynamically for this mock.

        let durationDays = 30;
        if (period === '3_months') durationDays = 90;
        if (period === '6_months') durationDays = 180;
        if (period === '12_months') durationDays = 365;

        // Ensure plan exists (or use a generic 'pro' plan)
        const { data: proPlan } = await supabaseAdmin
            .from('subscription_plans')
            .select('id')
            .eq('name', 'Pro') // Assuming 'Pro' plan exists
            .single();

        // If no plan, careful. But let's proceed trying to insert subscription directly.

        const endsAt = new Date();
        endsAt.setDate(endsAt.getDate() + durationDays);

        const { error } = await supabaseAdmin
            .from('subscriptions')
            .insert({
                id: randomUUID(),
                user_id: user.id,
                plan_id: proPlan?.id || null,
                status: 'active',
                ends_at: endsAt.toISOString()
            });

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Subscription updated successfully' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
