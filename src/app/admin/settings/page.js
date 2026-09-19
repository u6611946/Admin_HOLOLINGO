'use client';
import { useEffect, useState } from 'react';
import { useTheme } from '../../ThemeContext'; // adjust the import path to wherever you place ThemeContext.js
import { auth, db } from '../../../lib/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAdminRole } from '../../../lib/useAdminRole';

function SettingSection({ title, children, theme, overflowVisible = false }) {
  return (
    <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'14px',marginBottom:'12px',overflow:overflowVisible ? 'visible' : 'hidden'}}>
      <div style={{color:theme.accent,fontSize:'10px',textTransform:'uppercase',letterSpacing:'.08em',padding:'12px 16px 8px',borderBottom:`1px solid ${theme.border}`}}>{title}</div>
      {children}
    </div>
  );
}

function SettingRow({ label, sub, type='chevron', danger=false, onToggle, isOn, theme }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${theme.border}`}}>
      <div>
        <div style={{color:danger?theme.danger:theme.text,fontSize:'13px'}}>{label}</div>
        {sub && <div style={{color:danger?theme.dangerMuted:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>{sub}</div>}
      </div>
      {type==='toggle' ? (
        <div onClick={onToggle} style={{width:'40px',height:'24px',borderRadius:'12px',position:'relative',flexShrink:0,cursor:'pointer',background:isOn?theme.accent:theme.toggleOff,border:isOn?'none':`1px solid ${theme.toggleOffBorder}`,transition:'background .2s'}}>
          <div style={{position:'absolute',top:'3px',left:isOn?'calc(100% - 21px)':'3px',width:'18px',height:'18px',borderRadius:'50%',background:isOn?'#fff':theme.toggleKnobOff,transition:'left .2s'}}/>
        </div>
      ) : (
        <span style={{color:danger?theme.danger:theme.textFaint,fontSize:'16px'}}>›</span>
      )}
    </div>
  );
}

function ThemeToggleRow({ theme, mode, toggleMode }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${theme.border}`}}>
      <div>
        <div style={{color:theme.text,fontSize:'13px'}}>Light mode</div>
        <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>Switch the admin panel&apos;s color theme</div>
      </div>
      <div onClick={toggleMode} style={{width:'40px',height:'24px',borderRadius:'12px',position:'relative',flexShrink:0,cursor:'pointer',background:mode==='light'?theme.accent:theme.toggleOff,border:mode==='light'?'none':`1px solid ${theme.toggleOffBorder}`,transition:'background .2s'}}>
        <div style={{position:'absolute',top:'3px',left:mode==='light'?'calc(100% - 21px)':'3px',width:'18px',height:'18px',borderRadius:'50%',background:mode==='light'?'#fff':theme.toggleKnobOff,transition:'left .2s'}}/>
      </div>
    </div>
  );
}

function SetupLinkCard({ theme, email, link }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — she can still select and copy the text manually.
    }
  };

  return (
    <div>
      <div style={{color:theme.textMuted,fontSize:'11px',marginBottom:'16px'}}>
        Send this link to her yourself — she uses it to set her own password, which you never see. It expires in 30 minutes if she doesn&apos;t sign in.
      </div>
      <div style={{marginBottom:'10px'}}>
        <div style={{color:theme.accent,fontSize:'10px',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'4px'}}>Email</div>
        <div style={{background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',fontFamily:'monospace',wordBreak:'break-all'}}>{email}</div>
      </div>
      <div style={{marginBottom:'6px'}}>
        <div style={{color:theme.accent,fontSize:'10px',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'4px'}}>Setup link</div>
        <div style={{display:'flex',gap:'8px'}}>
          <div style={{flex:1,minWidth:0,background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'12px',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link}</div>
          <button type="button" onClick={copy} style={{padding:'0 14px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0}}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}

function CredentialsCard({ theme, email, name, password }) {
  const [copiedField, setCopiedField] = useState(null);

  const copy = async (field, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500);
    } catch {
      // Clipboard API unavailable — she can still select and copy the text manually.
    }
  };

  const rows = [
    { field: 'name', label: 'Name', value: name },
    { field: 'email', label: 'Email', value: email },
    { field: 'password', label: 'Password', value: password },
  ];

  return (
    <div>
      <div style={{color:theme.textMuted,fontSize:'11px',marginBottom:'16px'}}>
        Copy these and send them to her yourself, however you&apos;d like. This is the only time the password is shown.
      </div>
      {rows.map((row, index) => (
        <div key={row.field} style={{marginBottom: index === rows.length - 1 ? '6px' : '10px'}}>
          <div style={{color:theme.accent,fontSize:'10px',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'4px'}}>{row.label}</div>
          <div style={{display:'flex',gap:'8px'}}>
            <div style={{flex:1,minWidth:0,background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.value}</div>
            <button type="button" onClick={() => copy(row.field, row.value)} style={{padding:'0 14px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0}}>{copiedField === row.field ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddAdminModal({ onClose, onAdd, theme }) {
  const [form, setForm] = useState({ email: '', name: '', role: 'admin', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const roles = [
    { value: 'super_admin', label: 'Super admin' },
    { value: 'admin',       label: 'Moderator'   },
    { value: 'viewer',      label: 'Viewer'       },
  ];

  const handleSubmit = async () => {
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!form.name.trim())  { setError('Display name is required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      if (!auth?.currentUser) throw new Error('You are not signed in.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create admin.');
      setCreated({ email: form.email.trim(), name: form.name.trim(), password: form.password });
      onAdd();
    } catch (inviteError) {
      setError(inviteError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:50}} />

      <div style={{
        position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        zIndex:51,width:'100%',maxWidth:'400px',
        background:theme.bgCard,border:`1px solid ${theme.borderStrong}`,borderRadius:'16px',
        padding:'24px',boxShadow:'0 24px 60px rgba(0,0,0,.35)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
          <div style={{width:'40px',height:'40px',borderRadius:'10px',background:theme.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>
            👤
          </div>
          <div>
            <div style={{color:theme.textStrong,fontSize:'15px',fontWeight:600}}>{created ? 'Admin created' : 'Add new admin'}</div>
            {!created && <div style={{color:theme.textMuted,fontSize:'11px',marginTop:'2px'}}>Set her login here — no email sent automatically</div>}
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',color:theme.textMuted,fontSize:'20px',cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        {created ? (
          <>
            <CredentialsCard theme={theme} email={created.email} name={created.name} password={created.password} />
            <button
              onClick={onClose}
              style={{width:'100%',marginTop:'18px',padding:'10px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'13px',fontWeight:600,cursor:'pointer'}}
            >Done</button>
          </>
        ) : (
          <>
            <div style={{marginBottom:'14px'}}>
              <div style={{color:theme.accent,fontSize:'11px',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.06em'}}>Email address</div>
              <input
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={e => setForm(p => ({...p, email: e.target.value}))}
                style={{width:'100%',background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',outline:'none',boxSizing:'border-box'}}
              />
            </div>

            <div style={{marginBottom:'14px'}}>
              <div style={{color:theme.accent,fontSize:'11px',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.06em'}}>Display name</div>
              <input
                type="text"
                placeholder="Jane Doe"
                value={form.name}
                onChange={e => setForm(p => ({...p, name: e.target.value}))}
                style={{width:'100%',background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',outline:'none',boxSizing:'border-box'}}
              />
            </div>

            <div style={{marginBottom:'18px'}}>
              <div style={{color:theme.accent,fontSize:'11px',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'.06em'}}>Role</div>
              <div style={{display:'flex',gap:'8px'}}>
                {roles.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setForm(p => ({...p, role: r.value}))}
                    style={{
                      flex:1,padding:'8px 6px',borderRadius:'8px',fontSize:'12px',cursor:'pointer',
                      border: form.role === r.value ? `1px solid ${theme.accentBorder}` : `1px solid ${theme.border}`,
                      background: form.role === r.value ? theme.accentBg : theme.bgInput,
                      color: form.role === r.value ? theme.accent : theme.textMuted,
                      transition:'all .15s',
                    }}
                  >{r.label}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:'18px'}}>
              <div style={{color:theme.accent,fontSize:'11px',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.06em'}}>Password</div>
              <input
                type="text"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={e => setForm(p => ({...p, password: e.target.value}))}
                style={{width:'100%',background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',outline:'none',boxSizing:'border-box',fontFamily:'monospace'}}
              />
              <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'8px'}}>She can sign in with this right away. You&apos;ll send her the name and password yourself — nothing is emailed automatically.</div>
            </div>

            {error && <div style={{color:theme.danger,fontSize:'11px',marginBottom:'12px'}}>{error}</div>}

            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={onClose} style={{flex:1,padding:'9px',borderRadius:'8px',border:`1px solid ${theme.border}`,background:'transparent',color:theme.textMuted,fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{flex:1,padding:'9px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'13px',fontWeight:600,cursor:'pointer',opacity:loading?0.6:1}}
              >{loading ? 'Creating…' : 'Create admin'}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ResetPasswordModal({ theme, admin, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState(null);

  const handleReset = async () => {
    setError('');
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/invite', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: admin.id, regenerateLink: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to reset invite.');
      setLink(result.setupLink);
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:50}} />
      <div style={{
        position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        zIndex:51,width:'100%',maxWidth:'400px',
        background:theme.bgCard,border:`1px solid ${theme.borderStrong}`,borderRadius:'16px',
        padding:'24px',boxShadow:'0 24px 60px rgba(0,0,0,.35)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
          <div>
            <div style={{color:theme.textStrong,fontSize:'15px',fontWeight:600}}>{link ? 'New setup link ready' : `Reset invite for ${admin.name}`}</div>
            {!link && <div style={{color:theme.textMuted,fontSize:'11px',marginTop:'2px'}}>Issues a fresh setup link and a new 30-minute window</div>}
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',color:theme.textMuted,fontSize:'20px',cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        {link ? (
          <>
            <SetupLinkCard theme={theme} email={admin.email} link={link} />
            <button onClick={onClose} style={{width:'100%',marginTop:'18px',padding:'10px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Done</button>
          </>
        ) : (
          <>
            {error && <div style={{color:theme.danger,fontSize:'11px',marginBottom:'12px'}}>{error}</div>}
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={onClose} style={{flex:1,padding:'9px',borderRadius:'8px',border:`1px solid ${theme.border}`,background:'transparent',color:theme.textMuted,fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button
                onClick={handleReset}
                disabled={loading}
                style={{flex:1,padding:'9px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'13px',fontWeight:600,cursor:'pointer',opacity:loading?0.6:1}}
              >{loading ? 'Resetting…' : 'Reset & get link'}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function EditAdminModal({ theme, admin, onClose }) {
  const [form, setForm] = useState({ name: admin.name, email: admin.email, role: admin.role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { value: 'super_admin', label: 'Super admin' },
    { value: 'admin',       label: 'Moderator'   },
    { value: 'viewer',      label: 'Viewer'       },
  ];

  const handleSubmit = async () => {
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!form.name.trim())  { setError('Display name is required.'); return; }
    setError('');
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/invite', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: admin.id, name: form.name.trim(), email: form.email.trim(), role: form.role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update admin.');
      onClose();
    } catch (editError) {
      setError(editError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:50}} />
      <div style={{
        position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        zIndex:51,width:'100%',maxWidth:'400px',
        background:theme.bgCard,border:`1px solid ${theme.borderStrong}`,borderRadius:'16px',
        padding:'24px',boxShadow:'0 24px 60px rgba(0,0,0,.35)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
          <div style={{color:theme.textStrong,fontSize:'15px',fontWeight:600}}>Edit admin</div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',color:theme.textMuted,fontSize:'20px',cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        <div style={{marginBottom:'14px'}}>
          <div style={{color:theme.accent,fontSize:'11px',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.06em'}}>Email address</div>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({...p, email: e.target.value}))}
            style={{width:'100%',background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',outline:'none',boxSizing:'border-box'}}
          />
          {admin.status === 'Accepted' && (
            <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'6px'}}>She&apos;s already signed in — changing this means she&apos;ll need to use the new email next time.</div>
          )}
        </div>

        <div style={{marginBottom:'14px'}}>
          <div style={{color:theme.accent,fontSize:'11px',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.06em'}}>Display name</div>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(p => ({...p, name: e.target.value}))}
            style={{width:'100%',background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'8px',padding:'9px 12px',color:theme.text,fontSize:'13px',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        <div style={{marginBottom:'18px'}}>
          <div style={{color:theme.accent,fontSize:'11px',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'.06em'}}>Role</div>
          <div style={{display:'flex',gap:'8px'}}>
            {roles.map(r => (
              <button
                key={r.value}
                onClick={() => setForm(p => ({...p, role: r.value}))}
                style={{
                  flex:1,padding:'8px 6px',borderRadius:'8px',fontSize:'12px',cursor:'pointer',
                  border: form.role === r.value ? `1px solid ${theme.accentBorder}` : `1px solid ${theme.border}`,
                  background: form.role === r.value ? theme.accentBg : theme.bgInput,
                  color: form.role === r.value ? theme.accent : theme.textMuted,
                  transition:'all .15s',
                }}
              >{r.label}</button>
            ))}
          </div>
        </div>

        {error && <div style={{color:theme.danger,fontSize:'11px',marginBottom:'12px'}}>{error}</div>}

        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={onClose} style={{flex:1,padding:'9px',borderRadius:'8px',border:`1px solid ${theme.border}`,background:'transparent',color:theme.textMuted,fontSize:'13px',cursor:'pointer'}}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{flex:1,padding:'9px',borderRadius:'8px',border:`1px solid ${theme.accentBorder}`,background:theme.accentBg,color:theme.accent,fontSize:'13px',fontWeight:600,cursor:'pointer',opacity:loading?0.6:1}}
          >{loading ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </>
  );
}

function formatCountdown(expiresAt, now) {
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return null;
  const totalSeconds = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')} left`;
}

export default function SettingsPage() {
  const { theme, mode, toggleMode } = useTheme();
  const { isSuperAdmin, loading: roleLoading } = useAdminRole();

  const [tog, setTog] = useState({
    maintenance:false, forceUpdate:false,
  });
  const toggle = key => setTog(prev => ({...prev, [key]: !prev[key]}));

  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationLoaded, setRegistrationLoaded] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);

  useEffect(() => {
    if (!db) return undefined;
    const unsubscribe = onSnapshot(doc(db, 'config', 'app_settings'), (snapshot) => {
      setRegistrationEnabled(snapshot.data()?.registrationEnabled ?? true);
      setRegistrationLoaded(true);
    });
    return unsubscribe;
  }, []);

  const toggleRegistration = async () => {
    if (!db || registrationSaving) return;
    const next = !registrationEnabled;
    setRegistrationSaving(true);
    try {
      await setDoc(doc(db, 'config', 'app_settings'), { registrationEnabled: next }, { merge: true });
    } catch (error) {
      window.alert(error.message || 'Unable to update registration setting.');
    } finally {
      setRegistrationSaving(false);
    }
  };

  const [adminCount, setAdminCount] = useState(0);
  const [admins, setAdmins] = useState([]);
  const [adminLoadError, setAdminLoadError] = useState('');
  const [openAdminMenu, setOpenAdminMenu] = useState(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!db) return undefined;
    const unsubscribe = onSnapshot(collection(db, 'admins'), (snapshot) => {
      setAdminCount(snapshot.size);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadAdmins = async () => {
    if (!auth?.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/invite', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load admins.');
      setAdmins(result.admins);
      setAdminLoadError('');
    } catch (loadError) {
      setAdminLoadError(loadError.message);
    }
  };

  useEffect(() => {
    if (roleLoading || !isSuperAdmin) return;
    // loadAdmins is async; its setState calls run after the awaited fetch, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAdmins();
  }, [roleLoading, isSuperAdmin]);

  const handleAdminAdded = () => {
    loadAdmins();
  };

  const removeAdmin = async (admin) => {
    if (!window.confirm(`Remove ${admin.email} from HoloLingo Admin?`)) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/invite', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: admin.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to remove admin.');
      loadAdmins();
    } catch (removeError) {
      setAdminLoadError(removeError.message);
    }
  };

  return (
    <div style={{padding:'24px'}}>
      <div style={{marginBottom:'20px'}}>
        <div style={{color:theme.textStrong,fontSize:'18px',fontWeight:700}}>Settings</div>
        <div style={{color:theme.textMuted,fontSize:'11px',marginTop:'2px'}}>App-wide configuration</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>

        {/* Left col */}
        <div>
          <SettingSection title="App settings" theme={theme}>
            <SettingRow theme={theme} label="App name" sub="Hololingo v1.0.0" />
            <SettingRow theme={theme} label="Maintenance mode"      sub="Take app offline for all users" type="toggle" isOn={tog.maintenance}  onToggle={() => toggle('maintenance')} />
            <SettingRow theme={theme} label="New user registration" sub={!registrationLoaded ? 'Loading…' : isSuperAdmin ? 'Allow new sign-ups' : 'Allow new sign-ups (super admin only)'} type="toggle" isOn={registrationEnabled}  onToggle={isSuperAdmin ? toggleRegistration : undefined} />
            <SettingRow theme={theme} label="Force app update"      sub="Block old app versions"          type="toggle" isOn={tog.forceUpdate}   onToggle={() => toggle('forceUpdate')} />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'}}>
              <div>
                <div style={{color:theme.text,fontSize:'13px'}}>Default language for new users</div>
                <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>English (US)</div>
              </div>
              <span style={{color:theme.textFaint,fontSize:'16px'}}>›</span>
            </div>
          </SettingSection>

          <SettingSection title="AR & detection" theme={theme}>
            <SettingRow theme={theme} label="AR confidence threshold" sub="Min score to show label: 0.82" />
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'}}>
              <div>
                <div style={{color:theme.text,fontSize:'13px'}}>Fallback message on detection fail</div>
                <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>&quot;Point at a clear object&quot;</div>
              </div>
              <span style={{color:theme.textFaint,fontSize:'16px'}}>›</span>
            </div>
          </SettingSection>

          <SettingSection title="Appearance" theme={theme}>
            <ThemeToggleRow theme={theme} mode={mode} toggleMode={toggleMode} />
          </SettingSection>
        </div>

        {/* Right col */}
        <div>
          {!roleLoading && !isSuperAdmin ? (
            <SettingSection title="Admin access" theme={theme}>
              <div style={{padding:'12px 16px'}}>
                <div style={{color:theme.text,fontSize:'13px'}}>Admin accounts</div>
                <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>{adminCount} active admin{adminCount !== 1 ? 's' : ''} · only super admins can manage admins</div>
              </div>
            </SettingSection>
          ) : (
          <SettingSection title="Admin access" theme={theme} overflowVisible>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'}}>
              <div>
                <div style={{color:theme.text,fontSize:'13px'}}>Admin accounts</div>
                <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>{adminCount} active admin{adminCount !== 1 ? 's' : ''}</div>
              </div>
              <button
                onClick={() => setShowAddAdmin(true)}
                style={{
                  display:'flex',alignItems:'center',gap:'6px',
                  padding:'6px 12px',borderRadius:'8px',
                  border:`1px solid ${theme.accentBorder}`,
                  background:theme.accentBg,
                  color:theme.accent,fontSize:'12px',fontWeight:600,
                  cursor:'pointer',whiteSpace:'nowrap',
                }}
              >
                + Add admin
              </button>
            </div>
            {adminLoadError && <div style={{padding:'0 16px 12px',color:theme.danger,fontSize:'11px'}}>{adminLoadError}</div>}
            {admins.map((admin) => {
              const countdown = admin.status === 'Pending' ? formatCountdown(admin.expiresAt, now) : null;
              const statusColor = admin.status === 'Accepted' ? '#4ade80' : admin.status === 'Expired' || admin.status === 'Broken' ? '#ff6b6b' : '#ffc800';
              return (
                <div key={admin.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',padding:'10px 16px',borderTop:`1px solid ${theme.border}`}}>
                  <div>
                    <div style={{color:theme.text,fontSize:'12px',fontWeight:600}}>{admin.name}</div>
                    <div style={{color:theme.textMuted,fontSize:'10px',marginTop:'2px'}}>{admin.email} · {admin.role}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <span style={{color:statusColor,fontSize:'11px',fontWeight:600,textAlign:'right'}}>
                      {admin.status}
                      {countdown && <div style={{fontSize:'10px',fontWeight:400,color:theme.textMuted}}>{countdown}</div>}
                    </span>
                    <div style={{position:'relative'}}>
                      <button type="button" onClick={() => setOpenAdminMenu((current) => current === admin.id ? null : admin.id)} aria-label={`Actions for ${admin.email}`} style={{background:'transparent',border:'none',color:theme.textMuted,fontSize:'18px',lineHeight:1,padding:'2px 6px',cursor:'pointer'}}>⋯</button>
                      {openAdminMenu === admin.id && (
                        <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',zIndex:10,minWidth:'130px',padding:'4px',background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'8px',boxShadow:'0 10px 24px rgba(0,0,0,.3)'}}>
                          {admin.status !== 'Broken' && (
                            <button type="button" onClick={() => { setOpenAdminMenu(null); setEditTarget(admin); }} style={{width:'100%',padding:'7px 9px',background:'transparent',border:'none',borderRadius:'5px',color:theme.text,textAlign:'left',fontSize:'11px',cursor:'pointer'}}>Edit</button>
                          )}
                          {admin.status !== 'Accepted' && admin.status !== 'Broken' && (
                            <button type="button" onClick={() => { setOpenAdminMenu(null); setResetTarget(admin); }} style={{width:'100%',padding:'7px 9px',background:'transparent',border:'none',borderRadius:'5px',color:theme.text,textAlign:'left',fontSize:'11px',cursor:'pointer'}}>Reset password</button>
                          )}
                          <button type="button" onClick={() => { setOpenAdminMenu(null); removeAdmin(admin); }} style={{width:'100%',padding:'7px 9px',background:'transparent',border:'none',borderRadius:'5px',color:theme.danger,textAlign:'left',fontSize:'11px',cursor:'pointer'}}>{admin.status === 'Broken' ? 'Clean up' : 'Remove'}</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </SettingSection>
          )}
        </div>

      </div>

      {showAddAdmin && (
        <AddAdminModal
          theme={theme}
          onClose={() => { setShowAddAdmin(false); loadAdmins(); }}
          onAdd={handleAdminAdded}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          theme={theme}
          admin={resetTarget}
          onClose={() => { setResetTarget(null); loadAdmins(); }}
        />
      )}

      {editTarget && (
        <EditAdminModal
          theme={theme}
          admin={editTarget}
          onClose={() => { setEditTarget(null); loadAdmins(); }}
        />
      )}
    </div>
  );
}