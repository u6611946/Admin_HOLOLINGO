'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../ThemeContext'; // from src/app/admin/users/ up to src/app/
import { auth, db } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAdminRole } from '../../../lib/useAdminRole';

const langColors = { TH:'#00e5ff' };
const cols = '2fr 1.1fr 0.7fr 1fr 0.8fr 1fr';

// "Online" is a real presence heartbeat (lastSeenAt) the app writes to Firestore every ~20s while open.
// A heartbeat older than this window means the app isn't open anymore. "Suspended" comes from Firebase Auth (disabled) via /api/admin/users.
const ONLINE_WINDOW_MS = 45 * 1000;

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLastActive = (date) => {
  if (!date) return 'Never';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return 'Just now';
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function UsersPage() {
  const { theme } = useTheme();
  const [rawUsers, setRawUsers] = useState([]);
  const [authUsers, setAuthUsers] = useState({});
  const [suspendingUserId, setSuspendingUserId] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(Boolean(db));
  const [loadError, setLoadError] = useState(db ? '' : 'Firebase is not configured.');
  const [showAddUser, setShowAddUser] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [openUserMenu, setOpenUserMenu] = useState(null);
  const { isModerator, loading: checkingAdmin } = useAdminRole();
  const [tick, setTick] = useState(() => Date.now());
  const pageSize = 20;

  // Online/offline is time-based (a stale heartbeat), so it needs to re-evaluate even when
  // no new Firestore data arrives — a Firestore snapshot alone won't fire when someone goes idle.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setRawUsers(snapshot.docs.map((userDocument) => ({ id: userDocument.id, ...userDocument.data() })));
      setLoadingUsers(false);
      setLoadError('');
    }, () => {
      setLoadingUsers(false);
      setLoadError('Unable to load users. Check your Firestore rules.');
    });

    return unsubscribe;
  }, []);

  const loadAuthUsers = async () => {
    if (!auth?.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load account status.');
      setAuthUsers(result.authUsers || {});
    } catch {
      // Leave authUsers as-is — the table just falls back to "Never"/Offline until this succeeds.
    }
  };

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => {
      if (user) loadAuthUsers();
    });
  }, []);

  // Close the row action menu on any click outside it — the menu itself stops the mousedown
  // from bubbling here, so this only fires for clicks elsewhere on the page.
  useEffect(() => {
    if (openUserMenu === null) return undefined;
    const closeMenu = () => setOpenUserMenu(null);
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [openUserMenu]);

  const now = tick;
  const userList = useMemo(() => rawUsers.map((data) => {
    const name = data.name || data.displayName || data.email || 'Unnamed user';
    const authInfo = authUsers[data.id] || {};
    const isSuspended = Boolean(authInfo.disabled);
    // lastSeenAt is the live heartbeat the app writes while open; lastSignInAt (Firebase Auth) is the fallback
    // for users on an app version before this existed, or accounts created but never opened.
    const lastSeenAt = asDate(data.lastSeenAt) || asDate(authInfo.lastSignInAt);
    const isOnline = !isSuspended && Boolean(lastSeenAt) && (now - lastSeenAt.getTime()) < ONLINE_WINDOW_MS;
    const language = data.language || data.languages || 'TH';
    const languages = Array.isArray(language) ? language : [language];
    const statusLabel = isSuspended ? 'Suspended' : isOnline ? 'Online' : 'Offline';
    const statusColor = isSuspended ? '#ff6b6b' : isOnline ? '#4ade80' : '#8a97a3';
    return {
      id: data.id,
      initial: name.charAt(0).toUpperCase(),
      color: isOnline && !isSuspended ? '#00e5ff' : '#ff6b6b',
      bg: isOnline && !isSuspended ? 'rgba(0,229,255,.12)' : 'rgba(255,107,107,.12)',
      name,
      email: data.email || 'No email',
      langs: languages,
      words: data.words_saved ?? data.words ?? data.wordsLearned ?? 0,
      lastActive: formatLastActive(lastSeenAt),
      statusLabel,
      statusColor,
      isSuspended,
    };
  }), [rawUsers, authUsers, now]);

  const filteredUsers = userList.filter((user) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    return matchesSearch && (statusFilter === 'all' || user.statusLabel.toLowerCase() === statusFilter);
  });
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const handleAddUser = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (!auth?.currentUser) throw new Error('You are not signed in.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), password: form.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add user.');

      setForm({ name: '', email: '', password: '' });
      setShowAddUser(false);
      loadAuthUsers();
    } catch (addError) {
      setError(addError.message || 'Unable to add user. Check Firebase configuration and Firestore rules.');
    } finally {
      setSaving(false);
    }
  };

  const openUserModal = (user) => {
    setSelectedUser(user);
  };

  const toggleSuspend = async (user) => {
    const nextDisabled = !user.isSuspended;
    if (!window.confirm(`${nextDisabled ? 'Suspend' : 'Unsuspend'} ${user.name}?`)) return;

    setSuspendingUserId(user.id);
    try {
      if (!auth?.currentUser) throw new Error('You are not signed in.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.id, disabled: nextDisabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update this user.');

      setAuthUsers((current) => ({ ...current, [user.id]: { ...current[user.id], disabled: nextDisabled } }));
    } catch (toggleError) {
      window.alert(toggleError.message || 'Unable to update this user.');
    } finally {
      setSuspendingUserId(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!db || !window.confirm(`Delete ${user.name}? This removes their Firestore data (including chat history and progress) and their login. This cannot be undone.`)) return;

    setDeletingUserId(user.id);
    try {
      if (!auth?.currentUser) throw new Error('You are not signed in.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete this user.');

      setRawUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
      if (selectedUser?.id === user.id) setSelectedUser(null);
    } catch (deleteError) {
      window.alert(deleteError.message || 'Unable to delete this user. Check your Firebase connection.');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div style={{padding:'24px'}}>
      <div style={{marginBottom:'20px'}}>
        <div style={{color:theme.textStrong,fontSize:'18px',fontWeight:700}}>All users</div>
        <div style={{color:theme.textMuted,fontSize:'11px',marginTop:'2px'}}>{userList.length} users</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'14px',marginBottom:'20px'}}>
        {[
          { label: 'Total users', value: userList.length, sub: 'all accounts', color: theme.accent },
          { label: 'Online now', value: userList.filter((u) => u.statusLabel === 'Online').length, sub: 'active heartbeat', color: '#4ade80' },
          { label: 'Suspended', value: userList.filter((u) => u.statusLabel === 'Suspended').length, sub: 'disabled accounts', color: theme.danger },
        ].map((s) => (
          <div key={s.label} style={{background:`linear-gradient(160deg, ${s.color}1f 0%, ${theme.bgCard} 55%)`,border:`1px solid ${s.color}40`,borderRadius:'12px',padding:'14px 16px'}}>
            <div style={{color:s.color,fontSize:'20px',fontWeight:700}}>{s.value}</div>
            <div style={{color:theme.text,fontSize:'12px',marginTop:'2px'}}>{s.label}</div>
            <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'10px',padding:'7px 12px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{color:theme.textMuted}}>⌕</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name or email…" style={{background:'transparent',border:'none',outline:'none',color:theme.text,fontSize:'12px',width:'200px',fontFamily:'inherit'}}/>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <div style={{position:'relative'}}>
            <button type="button" onClick={() => setFilterOpen((isOpen) => !isOpen)} aria-expanded={filterOpen} style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'9px',padding:'8px 12px',color:theme.textMuted,fontSize:'12px',cursor:'pointer',fontFamily:'inherit',minWidth:'112px',textAlign:'left'}}>
              {statusFilter === 'all' ? 'All users' : statusFilter === 'online' ? 'Online' : statusFilter === 'offline' ? 'Offline' : 'Suspended'} <span style={{float:'right',marginLeft:'10px'}}>⌄</span>
            </button>
            {filterOpen && (
              <div style={{position:'absolute',top:'calc(100% + 5px)',right:0,minWidth:'140px',padding:'4px',background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'9px',boxShadow:'0 12px 30px rgba(0,0,0,.35)',zIndex:20}}>
                {[['all','All users'],['online','Online'],['offline','Offline'],['suspended','Suspended']].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => { setStatusFilter(value); setPage(1); setFilterOpen(false); }} style={{display:'block',width:'100%',padding:'8px 10px',border:'none',borderRadius:'6px',background:statusFilter === value ? theme.accentBg : 'transparent',color:statusFilter === value ? theme.accent : theme.textMuted,textAlign:'left',fontSize:'12px',cursor:'pointer',fontFamily:'inherit'}}>
                    {statusFilter === value ? '✓ ' : '   '}{label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isModerator && !checkingAdmin && <button onClick={() => { setError(''); setShowAddUser(true); }} style={{background:theme.accent,border:'none',borderRadius:'9px',padding:'8px 16px',color:theme.bgPage,fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ Add user</button>}
        </div>
      </div>

      <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'14px',overflow:'hidden'}}>
        {/* Head */}
        <div style={{display:'grid',gridTemplateColumns:cols,gap:'8px',padding:'10px 16px',background:theme.bgInput}}>
          {['User','Languages','Words','Last active','Status','Actions'].map(h=>(
            <div key={h} style={{color:theme.textFaint,fontSize:'9px',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        {loadingUsers && <div style={{padding:'24px 16px',color:theme.textMuted,fontSize:'12px',textAlign:'center'}}>Loading users…</div>}
        {!loadingUsers && loadError && <div style={{padding:'24px 16px',color:theme.danger,fontSize:'12px',textAlign:'center'}}>{loadError}</div>}
        {!loadingUsers && !loadError && visibleUsers.map((u,i)=>(
          <div key={u.id} style={{display:'grid',gridTemplateColumns:cols,gap:'8px',padding:'11px 16px',borderTop:`1px solid ${theme.border}`,background:i%2===1?theme.bgInput:'transparent',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <div style={{width:'26px',height:'26px',borderRadius:'50%',background:u.bg,color:u.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,flexShrink:0}}>{u.initial}</div>
              <div>
                <div style={{color:theme.text,fontSize:'12px'}}>{u.name}</div>
                <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'1px'}}>{u.email}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
              {u.langs.map(l=>(
                <span key={l} style={{background:`${langColors[l] || '#00e5ff'}14`,color:langColors[l] || '#00e5ff',border:`1px solid ${langColors[l] || '#00e5ff'}2a`,borderRadius:'4px',padding:'1px 5px',fontSize:'8px',fontWeight:600}}>{l}</span>
              ))}
            </div>
            <div style={{color:theme.text,fontSize:'12px'}}>{u.words}</div>
            <div style={{color:theme.text,fontSize:'12px'}}>{u.lastActive}</div>
            <div style={{color:u.statusColor,fontSize:'11px',fontWeight:600}}>{u.statusLabel}</div>
            <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
              <button onClick={() => openUserModal(u)} style={{background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'6px',padding:'3px 8px',color:theme.textMuted,fontSize:'10px',cursor:'pointer'}}>View</button>
              {isModerator && (
                <div style={{position:'relative'}} onMouseDown={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => setOpenUserMenu((current) => current === u.id ? null : u.id)} aria-label={`Actions for ${u.email}`} style={{background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'6px',padding:'2px 7px',color:theme.textMuted,fontSize:'15px',lineHeight:1,cursor:'pointer'}}>⋯</button>
                  {openUserMenu === u.id && (
                    <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',zIndex:20,minWidth:'110px',padding:'4px',background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'8px',boxShadow:'0 10px 24px rgba(0,0,0,.35)'}}>
                      <button
                        type="button"
                        onClick={() => { setOpenUserMenu(null); toggleSuspend(u); }}
                        disabled={suspendingUserId === u.id}
                        style={{width:'100%',padding:'7px 9px',background:'transparent',border:'none',borderRadius:'5px',color:u.isSuspended ? theme.textMuted : theme.danger,textAlign:'left',fontSize:'11px',cursor:suspendingUserId === u.id ? 'wait' : 'pointer',opacity:suspendingUserId === u.id ? .5 : 1}}
                      >{suspendingUserId === u.id ? '…' : u.isSuspended ? 'Unsuspend' : 'Suspend'}</button>
                      <button type="button" onClick={() => { setOpenUserMenu(null); handleDeleteUser(u); }} disabled={deletingUserId === u.id} style={{width:'100%',padding:'7px 9px',background:'transparent',border:'none',borderRadius:'5px',color:theme.danger,textAlign:'left',fontSize:'11px',cursor:deletingUserId === u.id ? 'wait' : 'pointer',opacity:deletingUserId === u.id ? .5 : 1}}>{deletingUserId === u.id ? 'Deleting…' : 'Delete'}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {!loadingUsers && !loadError && visibleUsers.length === 0 && (
          <div style={{padding:'24px 16px',color:theme.textMuted,fontSize:'12px',textAlign:'center'}}>No users match your search or filter.</div>
        )}
        {/* Pager */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',borderTop:`1px solid ${theme.border}`}}>
          <span style={{color:theme.textMuted,fontSize:'11px'}}>Showing {visibleUsers.length} of {filteredUsers.length} users</span>
          <div style={{display:'flex',gap:'4px'}}>
            <button onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={page === 1} style={{background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'6px',padding:'3px 8px',color:theme.textMuted,fontSize:'10px',cursor:page === 1 ? 'not-allowed' : 'pointer',opacity:page === 1 ? .5 : 1}}>‹ Prev</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button key={pageNumber} onClick={() => setPage(pageNumber)} style={{background:page === pageNumber ? theme.accentBg : theme.bgInput,border:`1px solid ${page === pageNumber ? theme.accentBorder : theme.border}`,borderRadius:'6px',padding:'3px 8px',color:page === pageNumber ? theme.accent : theme.textMuted,fontSize:'10px',cursor:'pointer'}}>{pageNumber}</button>
            ))}
            <button onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))} disabled={page === pageCount} style={{background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'6px',padding:'3px 8px',color:theme.textMuted,fontSize:'10px',cursor:page === pageCount ? 'not-allowed' : 'pointer',opacity:page === pageCount ? .5 : 1}}>Next ›</button>
          </div>
        </div>
      </div>

      {showAddUser && (
        <div onClick={() => !saving && setShowAddUser(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <form onSubmit={handleAddUser} onClick={(event) => event.stopPropagation()} style={{width:'min(420px, calc(100% - 32px))',background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'14px',padding:'22px',boxShadow:'0 24px 70px rgba(0,0,0,.45)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
              <div style={{color:theme.textStrong,fontSize:'16px',fontWeight:700}}>Add user</div>
              <button type="button" onClick={() => setShowAddUser(false)} disabled={saving} style={{background:'transparent',border:'none',color:theme.textMuted,fontSize:'20px',cursor:'pointer'}}>×</button>
            </div>
            {['name', 'email', 'password'].map((field) => (
              <label key={field} style={{display:'block',color:theme.textMuted,fontSize:'11px',marginBottom:'12px',textTransform:'capitalize'}}>
                {field}
                <input type={field === 'password' ? 'password' : field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:'6px',padding:'10px 12px',background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',color:theme.text,fontSize:'13px',fontFamily:'inherit'}} />
              </label>
            ))}
            {error && <div style={{color:theme.danger,fontSize:'11px',marginBottom:'12px'}}>{error}</div>}
            <button type="submit" disabled={saving} style={{width:'100%',padding:'10px',background:theme.accent,border:'none',borderRadius:'8px',color:theme.bgPage,fontWeight:700,cursor:saving?'wait':'pointer'}}>{saving ? 'Adding…' : 'Add user'}</button>
          </form>
        </div>
      )}

      {selectedUser && (
        <div onClick={() => setSelectedUser(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div onClick={(event) => event.stopPropagation()} style={{width:'min(420px, calc(100% - 32px))',background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'14px',padding:'22px',boxShadow:'0 24px 70px rgba(0,0,0,.45)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
              <div style={{color:theme.textStrong,fontSize:'16px',fontWeight:700}}>User details</div>
              <button type="button" onClick={() => setSelectedUser(null)} style={{background:'transparent',border:'none',color:theme.textMuted,fontSize:'20px',cursor:'pointer'}}>×</button>
            </div>
            <div>
                <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'18px'}}>
                  <div style={{width:'42px',height:'42px',borderRadius:'50%',background:selectedUser.bg,color:selectedUser.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{selectedUser.initial}</div>
                  <div><div style={{color:theme.textStrong,fontSize:'15px',fontWeight:700}}>{selectedUser.name}</div><div style={{color:theme.textMuted,fontSize:'11px'}}>{selectedUser.email}</div></div>
                </div>
                {[['Status', selectedUser.statusLabel], ['Languages', selectedUser.langs.length ? selectedUser.langs.join(', ') : 'None yet'], ['Words learned', selectedUser.words], ['Last active', selectedUser.lastActive]].map(([label, value]) => (
                  <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderTop:`1px solid ${theme.border}`,fontSize:'12px'}}><span style={{color:theme.textMuted}}>{label}</span><span style={{color:theme.text}}>{value}</span></div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}