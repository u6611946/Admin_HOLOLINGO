'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Reads the signed-in admin's role from Firestore so pages can gate write actions client-side.
// The real enforcement lives in Firestore rules / API routes — this only controls what's shown.
export function useAdminRole() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, 'admins', user.uid));
        setRole(snapshot.exists() ? snapshot.data()?.role || null : null);
      } catch {
        setRole(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return {
    role,
    loading,
    isSuperAdmin: role === 'super_admin',
    isModerator: role === 'super_admin' || role === 'admin',
    isViewer: role === 'viewer',
  };
}
