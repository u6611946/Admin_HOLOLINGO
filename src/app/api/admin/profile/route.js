import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export const runtime = 'nodejs';

const RENAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

// Lets any signed-in admin rename themselves, at most once every 30 days.
// Enforced here (not just in the UI) since a client-side-only check can be bypassed.
export async function PATCH(request) {
  try {
    if (!adminAuth || !adminDb) throw new Error('Server Firebase Admin credentials are not configured.');

    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new Error('Authentication required.');
    const token = await adminAuth.verifyIdToken(authorization.slice(7));

    const { name } = await request.json();
    const normalizedName = name?.trim();
    if (!normalizedName) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });

    const adminRef = adminDb.collection('admins').doc(token.uid);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) return NextResponse.json({ error: 'This account is not authorized as an admin.' }, { status: 403 });

    const data = adminDoc.data();
    if (data.nameUpdatedAt) {
      const nextAllowed = new Date(data.nameUpdatedAt).getTime() + RENAME_COOLDOWN_MS;
      const remainingMs = nextAllowed - Date.now();
      if (remainingMs > 0) {
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        return NextResponse.json({ error: `You can rename again in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.` }, { status: 429 });
      }
    }

    const nameUpdatedAt = new Date().toISOString();
    await adminAuth.updateUser(token.uid, { displayName: normalizedName });
    await adminRef.set({ name: normalizedName, nameUpdatedAt }, { merge: true });

    return NextResponse.json({ ok: true, name: normalizedName, nameUpdatedAt });
  } catch (error) {
    const status = error.message === 'Authentication required.' ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Unable to update your profile.' }, { status });
  }
}
