import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    return NextResponse.json({ token: "TODO_IMPLEMENT_SECURE_TOKEN_FETCH" });
}
