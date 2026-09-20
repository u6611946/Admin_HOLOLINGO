'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';
import { useAdminRole } from '../../../lib/useAdminRole';

const DEFAULT_COIN_FLOOR = 10;
const DEFAULT_FREE_TOP_UP = 75;

export default function CoinBattlePage() {
  const { theme } = useTheme();
  const { isSuperAdmin } = useAdminRole();

  const [battles, setBattles] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [userNames, setUserNames] = useState({});
  const [search, setSearch] = useState('');

  const [coinFloor, setCoinFloor] = useState(String(DEFAULT_COIN_FLOOR));
  const [freeTopUp, setFreeTopUp] = useState(String(DEFAULT_FREE_TOP_UP));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!db) return undefined;

    return onSnapshot(
      collection(db, 'daily_battles'),
      (snapshot) => {
        setBattles(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setLoadError('');
      },
      (error) => setLoadError(`Unable to load daily_battles: ${error.message}`),
    );
  }, []);

  useEffect(() => {
    if (!db) return undefined;

    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const names = {};
      snapshot.docs.forEach((document) => {
        const data = document.data();
        names[document.id] = data.name || data.displayName || data.email || 'Unknown player';
      });
      setUserNames(names);
    });
  }, []);

  useEffect(() => {
    if (!db) return undefined;

    return onSnapshot(doc(db, 'config', 'coin_battle_settings'), (snapshot) => {
      const data = snapshot.data();
      setCoinFloor(String(data?.coin_floor ?? DEFAULT_COIN_FLOOR));
      setFreeTopUp(String(data?.free_top_up ?? DEFAULT_FREE_TOP_UP));
      setSettingsLoaded(true);
    });
  }, []);

  const nameFor = (uid) => userNames[uid] || (uid ? `${uid.slice(0, 6)}…` : '—');

  const winnerInfo = (b) => {
    if (b.result === 'player_a') return { label: nameFor(b.player_a_uid), color: '#4ade80' };
    if (b.result === 'player_b') return { label: nameFor(b.player_b_uid), color: '#4ade80' };
    if (b.result === 'draw') return { label: 'Draw', color: '#f59e0b' };
    if (b.status !== 'resolved') return { label: '—', color: theme.textMuted };
    return { label: b.result || '—', color: theme.textMuted };
  };

  const resolved = battles.filter((b) => b.status === 'resolved');
  const active = battles.filter((b) => b.status === 'active');
  const totalWagered = resolved.reduce((sum, b) => sum + (Number(b.wager) || 0), 0);
  const draws = resolved.filter((b) => b.result === 'draw').length;

  const filteredBattles = battles.filter((b) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return nameFor(b.player_a_uid).toLowerCase().includes(query) || nameFor(b.player_b_uid).toLowerCase().includes(query);
  });

  const handleSaveSettings = async () => {
    if (!db) return;

    const floorValue = Number(coinFloor);
    const topUpValue = Number(freeTopUp);

    if (!Number.isFinite(floorValue) || floorValue < 0 || !Number.isFinite(topUpValue) || topUpValue < 0) {
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, 'config', 'coin_battle_settings'),
        { coin_floor: Math.round(floorValue), free_top_up: Math.round(topUpValue) },
        { merge: true },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
    <div style={{ padding: '24px', maxWidth: '900px', color: theme.text }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>Coin Battle</div>
        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '3px' }}>
          1v1 wager battles — live activity and coin economy settings
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.25)', borderRadius: '10px', padding: '10px 14px', color: theme.danger, fontSize: '12px', marginBottom: '16px' }}>
          {loadError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Total battles', value: battles.length.toLocaleString(), color: theme.accent },
          { label: 'In progress', value: active.length.toLocaleString(), color: '#4ade80' },
          { label: 'Coins wagered (resolved)', value: totalWagered.toLocaleString(), color: '#f59e0b' },
          { label: 'Draws', value: draws.toLocaleString(), color: '#a78bfa' },
        ].map((item) => (
          <div key={item.label} style={{ background: `linear-gradient(160deg, ${item.color}1f 0%, ${theme.bgCard} 55%)`, border: `1px solid ${item.color}40`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ color: item.color, fontSize: '20px', fontWeight: 700 }}>{item.value}</div>
            <div style={{ color: theme.text, fontSize: '12px', marginTop: '2px' }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '18px', marginBottom: '28px' }}>
        <div style={{ color: theme.textStrong, fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>Coin economy settings</div>
        <div style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '16px' }}>
          Read by the app at battle time — coin_floor is baked into each new battle so a losing streak can never fully wipe someone out.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', opacity: settingsLoaded ? 1 : 0.5 }}>
          <div>
            <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
              Coin floor
            </div>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={coinFloor}
              disabled={!isSuperAdmin}
              onChange={(event) => setCoinFloor(event.target.value)}
            />
          </div>
          <div>
            <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
              Free top-up per event
            </div>
            <input
              type="number"
              min="0"
              style={inputStyle}
              value={freeTopUp}
              disabled={!isSuperAdmin}
              onChange={(event) => setFreeTopUp(event.target.value)}
            />
          </div>
        </div>

        {isSuperAdmin ? (
          <button
            onClick={handleSaveSettings}
            disabled={saving || !settingsLoaded}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: `1px solid ${saved ? 'rgba(74,222,128,.35)' : theme.accentBorder}`,
              background: saved ? 'rgba(74,222,128,.1)' : theme.accentBg,
              color: saved ? '#4ade80' : theme.accent,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
          </button>
        ) : (
          <div style={{ color: theme.textMuted, fontSize: '11px' }}>Only a super admin can change these settings.</div>
        )}
      </div>

      <div style={{ color: theme.textStrong, fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Recent battles</div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by player name…"
        style={{ width: '100%', boxSizing: 'border-box', background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 14px', color: theme.text, fontSize: '13px', outline: 'none', fontFamily: 'inherit', marginBottom: '16px' }}
      />

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr', gap: '10px', padding: '10px 16px', background: theme.bgInput }}>
          {['Players', 'Wager', 'Status', 'Winner', 'Settled'].map((header) => (
            <div key={header} style={{ color: theme.textFaint, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.07em' }}>{header}</div>
          ))}
        </div>

        {filteredBattles.length === 0 ? (
          <div style={{ padding: '28px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
            {battles.length === 0 ? 'No battles yet.' : 'No battles match that search.'}
          </div>
        ) : (
          filteredBattles
            .slice()
            .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
            .slice(0, 50)
            .map((b) => {
              const winner = winnerInfo(b);
              return (
                <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr', gap: '10px', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ color: theme.textStrong, fontSize: '13px', fontWeight: 600 }}>{nameFor(b.player_a_uid)} <span style={{ color: theme.textMuted, fontWeight: 400 }}>vs</span> {nameFor(b.player_b_uid)}</div>
                  <div style={{ color: theme.text, fontSize: '13px' }}>{b.wager ?? '—'}</div>
                  <div style={{ color: theme.text, fontSize: '12px', textTransform: 'capitalize' }}>{b.status || '—'}</div>
                  <div style={{ color: winner.color, fontSize: '12px', fontWeight: 600 }}>{winner.label}</div>
                  <div style={{ color: theme.textMuted, fontSize: '12px' }}>{b.settled ? 'Yes' : 'No'}</div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
