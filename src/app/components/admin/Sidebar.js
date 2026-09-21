'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '../../ThemeContext';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const navItems = [
  {
    section: 'Overview',
    color: '#a78bfa',
    items: [
      { href: '/admin/dashboard', icon: '⊞', label: 'Dashboard' },
    ],
  },
  {
    section: 'Users',
    color: '#ffc800',
    items: [
      {
        href: '/admin/users',
        icon: '◯',
        label: 'Users',
        badgeStyle: 'count',
      },
      {
        href: '/admin/feedback',
        icon: '◈',
        label: 'Feedback',
      },
      {
        href: '/admin/reports',
        icon: '⚠',
        label: 'Reports',
      },
    ],
  },
  {
    section: 'Content',
    color: '#00e5ff',
    items: [
      {
        href: '/admin/popular-words',
        icon: '✦',
        label: 'Popular words',
      },
      {
        href: '/admin/topics',
        icon: '▤',
        label: 'Topics',
      },
      {
        href: '/admin/announcements',
        icon: '꒰ ✉︎ ꒱',
        label: 'Announcements',
      },
      {
        href: '/admin/subscription',
        icon: '◉',
        label: 'Subscription',
      },
      {
        href: '/admin/gobot',
        icon: 'robot',
        label: 'Gobot AI',
      },
      {
        href: '/admin/coin-battle',
        icon: '⛁',
        label: 'Token Battle',
      },
    ],
  },
  {
    section: 'System',
    color: '#4ade80',
    items: [
      {
        href: '/admin/settings',
        icon: '⚙',
        label: 'Settings',
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
   SHARED MODAL
───────────────────────────────────────────────────────────── */

function Modal({ title, subtitle, onClose, children }) {
  const { theme } = useTheme();

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.6)',
          zIndex: 200,
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '420px',
          background: theme.bgCard,
          border: `1px solid ${theme.accentBorder}`,
          borderRadius: '16px',
          zIndex: 201,
          boxShadow:
            theme.mode === 'dark'
              ? '0 24px 64px rgba(0,0,0,.8)'
              : '0 20px 50px rgba(0,0,0,.15)',
          overflow: 'hidden',
          color: theme.text,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div>
            <div
              style={{
                color: theme.textStrong,
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              {title}
            </div>

            {subtitle && (
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '11px',
                  marginTop: '3px',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   EDIT PROFILE MODAL
───────────────────────────────────────────────────────────── */

const RENAME_COOLDOWN_DAYS = 30;

function daysUntilRenameAllowed(nameUpdatedAt) {
  if (!nameUpdatedAt) return 0;
  const nextAllowed = new Date(nameUpdatedAt).getTime() + RENAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = nextAllowed - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
}

function EditProfileModal({ onClose, account, onUpdated }) {
  const { theme } = useTheme();

  const [name, setName] = useState(account.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const remainingDays = daysUntilRenameAllowed(account.nameUpdatedAt);
  const canRename = remainingDays === 0;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!auth?.currentUser) {
      setError('You are not signed in.');
      return;
    }

    if (name.trim() === (account.name || '')) {
      onClose();
      return;
    }

    setError('');
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update your profile.');
      await auth.currentUser.reload();
      onUpdated({ name: result.name, nameUpdatedAt: result.nameUpdatedAt });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (saveError) {
      setError(saveError.message || 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    padding: '9px 12px',
    color: theme.text,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <Modal
      title="Edit profile"
      subtitle="Update your display info"
      onClose={onClose}
    >
      <div style={{ padding: '18px 20px' }}>

        {/* Avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '18px',
            padding: '12px 14px',
            background: theme.accentBg,
            border: `1px solid ${theme.accentBorder}`,
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              flexShrink: 0,
              background: theme.accentBg,
              border: `1px solid ${theme.accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.accent,
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div
              style={{
                color: theme.textStrong,
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {name || 'Admin'}
            </div>

            <div
              style={{
                color: theme.textMuted,
                fontSize: '11px',
                marginTop: '2px',
              }}
            >
              {account.role}
            </div>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: '14px' }}>
          <div
            style={{
              color: theme.accent,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              marginBottom: '6px',
            }}
          >
            Display name
          </div>

          <input
            style={{ ...inputStyle, opacity: canRename ? 1 : 0.6, cursor: canRename ? 'text' : 'not-allowed' }}
            value={name}
            disabled={!canRename}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            onFocus={(e) =>
              (e.target.style.borderColor = theme.accentBorder)
            }
            onBlur={(e) =>
              (e.target.style.borderColor = theme.border)
            }
          />
          {!canRename && (
            <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '6px' }}>
              You can rename again in {remainingDays} day{remainingDays === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              color: theme.danger,
              fontSize: '12px',
              marginTop: '10px',
              padding: '8px 12px',
              background: 'rgba(255,107,107,.08)',
              border: '1px solid rgba(255,107,107,.15)',
              borderRadius: '8px',
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '18px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              background: 'transparent',
              color: theme.textMuted,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${
                saved ? 'rgba(74,222,128,.35)' : theme.accentBorder
              }`,
              background: saved
                ? 'rgba(74,222,128,.1)'
                : theme.accentBg,
              color: saved ? '#4ade80' : theme.accent,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .2s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? 'Saving…'
              : saved
              ? '✓ Saved'
              : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}


/* ─────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────── */

export default function Sidebar() {
  const { theme } = useTheme();

  const path = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [account, setAccount] = useState({ name: '', email: '', role: 'User', nameUpdatedAt: null });

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAccount({ name: '', email: '', role: 'User', nameUpdatedAt: null });
        return;
      }

      let role = 'User';
      let nameUpdatedAt = null;
      if (db) {
        const adminDocument = await getDoc(doc(db, 'admins', user.uid));
        if (adminDocument.exists()) {
          role = adminDocument.data()?.role || 'admin';
          nameUpdatedAt = adminDocument.data()?.nameUpdatedAt || null;
        }
      }
      setAccount({ name: user.displayName || '', email: user.email || '', role, nameUpdatedAt });
    });
  }, []);

  useEffect(() => {
    if (!db) return undefined;
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      setUserCount(snapshot.size);
    });
  }, []);

  const adminMenuOptions = [
    {
      label: 'Edit profile',
      action: () => {
        setMenuOpen(false);
        setShowEditModal(true);
      },
    },
    {
      label: 'Sign out',
      action: async () => {
        setMenuOpen(false);
        if (auth) await signOut(auth);
        router.replace('/login');
      },
      danger: true,
    },
  ];

  return (
    <>
      {/* Click outside */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
          }}
        />
      )}

      {/* Modals */}
      {showEditModal && (
        <EditProfileModal
          account={account}
          onUpdated={(updatedAccount) => setAccount((current) => ({ ...current, ...updatedAccount }))}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        style={{
          width: '260px',
          height: '100vh',
          position: 'relative',
          zIndex: 45,
          top: 0,
          display: 'flex',
          flexDirection: 'column',

          background:
            theme.mode === 'dark'
              ? 'linear-gradient(180deg, #0b141c 0%, #071018 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #f4f7f9 100%)',

          borderRight: `1px solid ${theme.border}`,

          overflow: 'visible',
          backdropFilter: 'blur(12px)',
          transition:
            'background .2s, border-color .2s',
        }}
      >

        {/* LOGO */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: theme.accentBg,
              border: `1px solid ${theme.accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                theme.mode === 'dark'
                  ? '0 0 24px rgba(0,229,255,.12)'
                  : '0 4px 14px rgba(0,144,168,.08)',
              overflow: 'hidden',
            }}
          >
            <Image
              src="/Hololingo_logo.png"
              alt="Hololingo Logo"
              width={26}
              height={26}
              style={{ objectFit: 'contain' }}
            />
          </div>

          <div>
            <div
              style={{
                color: theme.textStrong,
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              Hololingo
            </div>

            <div
              style={{
                color: theme.textMuted,
                fontSize: '11px',
                marginTop: '3px',
              }}
            >
              Admin panel
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <div
          style={{
            flex: 1,
            padding: '18px 14px',
            overflowY: 'auto',
          }}
        >
          {navItems.map((sec) => (
            <div
              key={sec.section}
              style={{ marginBottom: '28px' }}
            >
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '.14em',
                  padding: '0 10px',
                  marginBottom: '10px',
                  fontWeight: 700,
                }}
              >
                {sec.section}
              </div>

              {sec.items.map((item) => {
                const active = path.startsWith(item.href);
                const sectionColor = sec.color;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      textDecoration: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '11px 12px',
                        borderRadius: '14px',
                        marginBottom: '5px',

                        background: active
                          ? `${sectionColor}18`
                          : 'transparent',

                        border: active
                          ? `1px solid ${sectionColor}45`
                          : '1px solid transparent',

                        transition: '.2s ease',
                        cursor: 'pointer',

                        boxShadow:
                          active && theme.mode === 'dark'
                            ? `0 0 20px ${sectionColor}20`
                            : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',

                          background: active
                            ? `${sectionColor}18`
                            : theme.mode === 'dark'
                            ? 'rgba(255,255,255,.03)'
                            : 'rgba(0,0,0,.035)',

                          border: active
                            ? `1px solid ${sectionColor}45`
                            : `1px solid ${theme.border}`,

                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',

                          color: active
                            ? sectionColor
                            : theme.textMuted,

                          fontSize: item.icon.length > 1 ? '9px' : '16px',
                          letterSpacing: item.icon.length > 1 ? '-1px' : 'normal',
                        }}
                      >
                        {item.icon === 'robot' ? (
                          <Image
                            src="/robot 1.png"
                            alt="Robot"
                            width={20}
                            height={20}
                            style={{
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          item.icon
                        )}
                      </div>

                      <span
                        style={{
                          flex: 1,
                          color: active
                            ? sectionColor
                            : theme.text,

                          fontSize: '13px',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {item.label}
                      </span>

                      {(item.badge || item.href === '/admin/users') && (
                        <span
                          style={{
                            background:
                              item.badgeStyle === 'alert'
                                ? 'rgba(255,107,107,.14)'
                                : `${sectionColor}18`,

                            color:
                              item.badgeStyle === 'alert'
                                ? '#ff7b7b'
                                : sectionColor,

                            border:
                              item.badgeStyle === 'alert'
                                ? '1px solid rgba(255,107,107,.18)'
                                : `1px solid ${sectionColor}45`,

                            borderRadius: '999px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                          }}
                        >
                          {item.href === '/admin/users'
                            ? userCount.toLocaleString()
                            : item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '16px',
            borderTop: `1px solid ${theme.border}`,
            position: 'relative',
            flexShrink: 0,
            zIndex: 50,
          }}
        >

          {/* ACCOUNT MENU */}
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: 'calc(100% - 8px)',
                left: '16px',
                right: '16px',

                background: theme.bgCard,
                border: `1px solid ${theme.accentBorder}`,

                borderRadius: '16px',
                overflow: 'visible',
                zIndex: 999,

                boxShadow:
                  theme.mode === 'dark'
                    ? '0 -12px 40px rgba(0,0,0,.6)'
                    : '0 -8px 30px rgba(0,0,0,.12)',
              }}
            >
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '.14em',
                  padding: '12px 14px 6px',
                  fontWeight: 700,
                }}
              >
                Account
              </div>

              {adminMenuOptions.map((opt, i) => (
                <div
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    opt.action();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderTop:
                      i === adminMenuOptions.length - 1
                        ? `1px solid ${theme.border}`
                        : 'none',
                    cursor: 'pointer',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      opt.danger
                        ? 'rgba(255,107,107,.06)'
                        : theme.accentBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      'transparent';
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: opt.danger
                        ? theme.danger
                        : theme.text,
                    }}
                  >
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ADMIN CARD */}
          <div
            onClick={() =>
              setMenuOpen((o) => !o)
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px',

              background: menuOpen
                ? theme.accentBg
                : theme.mode === 'dark'
                ? 'rgba(255,255,255,.03)'
                : 'rgba(0,0,0,.035)',

              borderRadius: '16px',

              border: menuOpen
                ? `1px solid ${theme.accentBorder}`
                : `1px solid ${theme.border}`,

              cursor: 'pointer',
              transition: 'all .2s ease',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: theme.accentBg,
                border: `1px solid ${theme.accentBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.accent,
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {(account.name || account.email || 'A').charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  color: theme.text,
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {account.name || account.email || 'Admin'}
              </div>

              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '10px',
                  marginTop: '2px',
                }}
              >
                {account.role}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  boxShadow: '0 0 10px #4ade80',
                }}
              />

              <span
                style={{
                  color: theme.textMuted,
                  fontSize: '10px',
                  display: 'inline-block',
                  transform: menuOpen
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)',
                  transition: 'transform .2s',
                }}
              >
                ▲
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}