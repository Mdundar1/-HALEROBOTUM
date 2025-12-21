import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const res = await fetch('http://localhost:3001/api/plans');
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: 'Backend error' }, { status: 500 });
    }
}
