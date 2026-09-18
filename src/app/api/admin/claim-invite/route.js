import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    if (!adminAuth || !adminDb) throw new Error('Server Firebase Admin credentials are not configured.');

    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new Error('Authentication required.');
    const token = await adminAuth.verifyIdToken(authorization.slice(7));

    const adminRef = adminDb.collection('admins').doc(token.uid);
    const existingAdmin = await adminRef.get();
    if (!existingAdmin.exists) {
      return NextResponse.json({ error: 'This account is not authorized as an admin.' }, { status: 403 });
    }

    const data = existingAdmin.data();

    if (!data.acceptedAt && data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      await adminAuth.updateUser(token.uid, { disabled: true }).catch(() => {});
      return NextResponse.json({ error: 'This invite has expired. Ask a super admin to reset it.' }, { status: 403 });
    }

    if (!data.acceptedAt) {
      await adminRef.set({ acceptedAt: new Date().toISOString() }, { merge: true });
    }

    return NextResponse.json({ ok: true, role: data.role || 'admin' });
  } catch (error) {
    const status = error.message === 'Authentication required.' ? 401 : 403;
    return NextResponse.json({ error: error.message || 'Unable to verify admin access.' }, { status });
  }
}
