'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '../../lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const finishSignIn = async () => {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/admin/claim-invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) {
      await auth.signOut();
      const notAuthorized = new Error(result.error || 'This account is not authorized as an admin.');
      notAuthorized.code = 'not-authorized';
      throw notAuthorized;
    }
    router.replace('/admin/dashboard');
  };

  const handleLogin = async () => {
    if (!form.email.trim())    { setError('Email is required.');    return; }
    if (!form.password.trim()) { setError('Password is required.'); return; }
    setError('');
    setLoading(true);
    if (!auth) {
      setError('Firebase is not configured. Add the values from your Firebase web app to .env.local.');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      await finishSignIn();
    } catch (authError) {
      if (authError.code === 'not-authorized') {
        setError(authError.message);
      } else if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (authError.code === 'auth/user-disabled') {
        setError('This invite has expired. Ask a super admin to reset it.');
      } else if (authError.code === 'auth/invalid-api-key') {
        setError('Firebase is not configured. Add the values from your Firebase web app to .env.local.');
      } else {
        setError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0b141c 0%, #071018 100%)',
        padding: '24px',
      }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'linear-gradient(135deg, #0d1a22, #071018)',
          border: '1px solid rgba(0,229,255,.1)',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,.5)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(0,229,255,.18), rgba(0,229,255,.05))',
              border: '1px solid rgba(0,229,255,.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 32px rgba(0,229,255,.15)',
              marginBottom: '14px',
              overflow: 'hidden',
            }}
          >
            <Image
              src="/Hololingo_logo.png"
              alt="Hololingo"
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Hololingo
          </div>
          <div style={{ color: '#3a5060', fontSize: '12px', marginTop: '4px' }}>
            Admin panel
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>Welcome back</div>
          <div style={{ color: '#3a5060', fontSize: '12px', marginTop: '4px' }}>Sign in to your admin account</div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ color: '#3a8090', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>
            Email address
          </div>
          <input
            type="email"
            placeholder="admin@hololingo.app"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            onKeyDown={handleKey}
            style={{
              width: '100%',
              background: '#071014',
              border: '1px solid #0d2030',
              borderRadius: '10px',
              padding: '11px 14px',
              color: '#ccc',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border .15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(0,229,255,.4)')}
            onBlur={e  => (e.target.style.borderColor = '#0d2030')}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ color: '#3a8090', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>
            Password
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#071014',
              border: '1px solid #0d2030',
              borderRadius: '10px',
              overflow: 'hidden',
              transition: 'border .15s',
            }}
            onFocus={() => {}}
          >
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              onKeyDown={handleKey}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                padding: '11px 14px',
                color: '#ccc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              style={{ background: 'none', border: 'none', color: '#3a5060', cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center' }}
            >
              {showPass ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginBottom: '14px',
              padding: '8px 12px',
              background: 'rgba(255,107,107,.08)',
              border: '1px solid rgba(255,107,107,.15)',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            {error}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: error ? '0' : '20px',
            borderRadius: '10px',
            border: '1px solid rgba(0,229,255,.35)',
            background: loading
              ? 'rgba(0,229,255,.05)'
              : 'linear-gradient(135deg, rgba(0,229,255,.18), rgba(0,229,255,.08))',
            color: '#00e5ff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all .2s',
            opacity: loading ? 0.7 : 1,
            boxShadow: loading ? 'none' : '0 0 20px rgba(0,229,255,.1)',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {/* Footer note */}
        <div style={{ textAlign: 'center', color: '#1e3040', fontSize: '11px', marginTop: '20px' }}>
          Hololingo Admin v1.0.0
        </div>
      </div>
    </div>
  );
}