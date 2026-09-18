import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export const runtime = 'nodejs';

const PANEL_ROLES = ['super_admin', 'admin', 'viewer'];
const MODERATOR_ROLES = ['super_admin', 'admin'];

async function verifyRole(request, allowedRoles, permissionError) {
  if (!adminAuth || !adminDb) throw new Error('Server Firebase Admin credentials are not configured.');
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = await adminAuth.verifyIdToken(authorization.slice(7));
  const requester = await adminDb.collection('admins').doc(token.uid).get();
  if (!requester.exists || !allowedRoles.includes(requester.data()?.role)) throw new Error(permissionError);
}

// Viewing the user list (incl. real last-active/suspended status) is fine for any admin-panel role.
const verifyPanelUser = (request) => verifyRole(request, PANEL_ROLES, 'Admin permission required.');
// Creating/suspending/deleting app users is moderator+ only — viewers are read-only.
const verifyModerator = (request) => verifyRole(request, MODERATOR_ROLES, 'Moderator permission required.');

// Real last-active/suspended status, straight from Firebase Auth — no app-side write needed.
export async function GET(request) {
  try {
    await verifyPanelUser(request);

    const authUsers = {};
    let pageToken;
    do {
      const result = await adminAuth.listUsers(1000, pageToken);
      result.users.forEach((user) => {
        authUsers[user.uid] = {
          lastSignInAt: user.metadata.lastSignInTime || null,
          disabled: user.disabled,
        };
      });
      pageToken = result.pageToken;
    } while (pageToken);

    return NextResponse.json({ authUsers });
  } catch (error) {
    const status = error.message === 'Authentication required.' || error.message === 'Admin permission required.' || error.message === 'Moderator permission required.' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request) {
  try {
    await verifyModerator(request);

    const { name, email, password } = await request.json();
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedName = name?.trim();

    if (!normalizedEmail || !normalizedName || !password || password.length < 6) {
      return NextResponse.json({ error: 'Name, email, and a password of at least 6 characters are required.' }, { status: 400 });
    }

    const user = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: normalizedName,
    });

    await adminDb.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: normalizedName,
      email: normalizedEmail,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    const status = error.message === 'Authentication required.' || error.message === 'Admin permission required.' || error.message === 'Moderator permission required.' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Unable to create user.' }, { status });
  }
}

// Suspend/unsuspend: disabling the Firebase Auth account blocks their sign-in immediately.
export async function PATCH(request) {
  try {
    await verifyModerator(request);

    const { uid, disabled } = await request.json();
    if (!uid || typeof disabled !== 'boolean') {
      return NextResponse.json({ error: 'User UID and disabled flag are required.' }, { status: 400 });
    }

    await adminAuth.updateUser(uid, { disabled });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    const status = error.message === 'Authentication required.' || error.message === 'Admin permission required.' || error.message === 'Moderator permission required.' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Unable to update user.' }, { status });
  }
}

export async function DELETE(request) {
  try {
    await verifyModerator(request);

    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'User UID is required.' }, { status: 400 });

    await adminDb.recursiveDelete(adminDb.collection('users').doc(uid));

    try {
      await adminAuth.deleteUser(uid);
    } catch (authError) {
      if (authError.code !== 'auth/user-not-found') throw authError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error.message === 'Authentication required.' || error.message === 'Admin permission required.' || error.message === 'Moderator permission required.' ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Unable to remove user.' }, { status });
  }
}
