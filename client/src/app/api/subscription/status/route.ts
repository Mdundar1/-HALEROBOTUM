import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const res = await fetch('http://localhost:3001/api/subscription/status', {
            headers: {
                'Authorization': authHeader,
            },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: data.error || 'Failed to get subscription status' }, { status: res.status });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Subscription status error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
