'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { useAdminRole } from '../../../lib/useAdminRole';

// Keeps signed-out visitors (and signed-in accounts with no admin role) out of the admin pages.
// Firestore rules still protect the data; this just sends them to the login page instead of
// showing an empty panel.
export default function AuthGuard({ children }) {
  const router = useRouter();
  const { role, loading } = useAdminRole();

  useEffect(() => {
    if (loading || role) return;
    if (auth?.currentUser) signOut(auth).catch(() => {});
    router.replace('/login');
  }, [loading, role, router]);

  if (!role) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--adm-bg)',
          color: 'var(--adm-text)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '13px',
        }}
      >
        {loading ? 'Checking access…' : 'Redirecting to login…'}
      </div>
    );
  }

  return children;
}
