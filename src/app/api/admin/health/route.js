import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diagnostic: reports whether the server can load Firebase Admin, without exposing any secrets.
export async function GET() {
  const env = {
    FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
    FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
  };

  try {
    const { adminAuth, adminDb, adminInitError } = await import('../../../../lib/firebase-admin');
    return NextResponse.json({ ok: Boolean(adminAuth && adminDb), env, initError: adminInitError });
  } catch (error) {
    return NextResponse.json({ ok: false, env, loadError: String(error?.message || error).slice(0, 500) }, { status: 500 });
  }
}
