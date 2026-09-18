import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export const runtime = 'nodejs';

const INVITE_TTL_MS = 30 * 60 * 1000;

// Managing other admins is super-admin only — moderators/viewers never reach this route.
async function verifySuperAdmin(request) {
  if (!adminAuth || !adminDb) throw new Error('Server Firebase Admin credentials are not configured.');
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = await adminAuth.verifyIdToken(authorization.slice(7));
  const requester = await adminDb.collection('admins').doc(token.uid).get();
  if (!requester.exists || requester.data()?.role !== 'super_admin') throw new Error('Super admin permission required.');
}

function isExpired(data) {
  return Boolean(data.expiresAt) && new Date(data.expiresAt).getTime() < Date.now();
}

export async function GET(request) {
  try {
    await verifySuperAdmin(request);

    const adminsSnapshot = await adminDb.collection('admins').get();

    const admins = await Promise.all(adminsSnapshot.docs.map(async (adminDocument) => {
      const data = adminDocument.data();
      const user = await adminAuth.getUser(adminDocument.id).catch((getUserError) => {
        if (getUserError.code === 'auth/user-not-found') return null;
        throw getUserError;
      });

      if (!user) {
        // Firestore doc survived without a matching Firebase Auth account (e.g. deleted in the console).
        return {
          id: adminDocument.id,
          name: data.name || 'Admin',
          email: data.email || '',
          role: data.role || 'admin',
          status: 'Broken',
          lastSignInAt: null,
          expiresAt: null,
          isPendingInvite: false,
        };
      }

      const accepted = Boolean(user.metadata.lastSignInTime);

      let status = 'Accepted';
      if (!accepted) {
        if (isExpired(data)) {
          status = 'Expired';
          // Lock the account out the moment anyone loads this list past the deadline.
          if (!user.disabled) {
            await adminAuth.updateUser(adminDocument.id, { disabled: true }).catch(() => {});
          }
        } else {
          status = 'Pending';
        }
      }

      return {
        id: adminDocument.id,
        name: data.name || user.displayName || 'Admin',
        email: data.email || user.email || '',
        role: data.role || 'admin',
        status,
        lastSignInAt: user.metadata.lastSignInTime || null,
        expiresAt: accepted ? null : data.expiresAt || null,
        isPendingInvite: false,
      };
    }));

    return NextResponse.json({ admins });
  } catch (error) {
    const status = error.message === 'Authentication required.' || error.message === 'Super admin permission required.' ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request) {
  try {
    await verifySuperAdmin(request);

    const { email, name, role, password } = await request.json();
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedName = name?.trim();

    if (!normalizedEmail || !normalizedName || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Email, name, and a valid role are required.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'A password of at least 6 characters is required.' }, { status: 400 });
    }

    const user = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: normalizedName,
    });

    await adminDb.collection('admins').doc(user.uid).set({
      email: normalizedEmail,
      name: normalizedName,
      role,
      invitedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'That email already has an account.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Unable to create the admin account.' }, { status: 500 });
  }
}

const ALLOWED_ROLES = ['super_admin', 'admin', 'viewer'];

// Handles two independent updates, either or both at once:
// - name/email/role: edit an admin's profile, accepted or not.
// - password: regenerate the password and reset the 30-minute window for a pending (not-yet-accepted) invite.
export async function PATCH(request) {
  try {
    await verifySuperAdmin(request);
    const { uid, name, email, role, password } = await request.json();
    if (!uid) return NextResponse.json({ error: 'Admin UID is required.' }, { status: 400 });

    const adminRef = adminDb.collection('admins').doc(uid);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });

    const user = await adminAuth.getUser(uid);
    const authUpdates = {};
    const firestoreUpdates = {};

    if (typeof name === 'string' && name.trim()) {
      authUpdates.displayName = name.trim();
      firestoreUpdates.name = name.trim();
    }

    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      authUpdates.email = normalizedEmail;
      firestoreUpdates.email = normalizedEmail;
    }

    if (typeof role === 'string' && ALLOWED_ROLES.includes(role)) {
      firestoreUpdates.role = role;
    }

    if (password) {
      if (user.metadata.lastSignInTime) {
        return NextResponse.json({ error: 'This admin has already signed in — nothing to reset.' }, { status: 409 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'A password of at least 6 characters is required.' }, { status: 400 });
      }
      authUpdates.password = password;
      authUpdates.disabled = false;
      firestoreUpdates.expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    }

    if (Object.keys(authUpdates).length > 0) {
      await adminAuth.updateUser(uid, authUpdates);
    }
    if (Object.keys(firestoreUpdates).length > 0) {
      await adminRef.set(firestoreUpdates, { merge: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'That email already has an account.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Unable to update admin.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await verifySuperAdmin(request);
    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ error: 'Admin UID is required.' }, { status: 400 });

    await adminAuth.deleteUser(uid).catch((deleteError) => {
      if (deleteError.code !== 'auth/user-not-found') throw deleteError;
    });
    await adminDb.collection('admins').doc(uid).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to remove admin.' }, { status: 500 });
  }
}
