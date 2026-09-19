'use client';
import { useEffect, useState } from 'react';
import StatCard from '../../components/admin/StatCard';
import Link from 'next/link';
import { useTheme } from '../../ThemeContext';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';

const ONLINE_WINDOW_MS = 45 * 1000;

const langColors = { TH: '#00e5ff' };

const wordCardColors = ['#ffc800', '#4ade80', '#a78bfa'];

const barColors = ['#ffc800', '#4ade80', '#a78bfa', '#00e5ff', '#ff8fa3', '#ff9f43', '#5b9dff'];

const periodColors = { week: '#ffc800', month: '#4ade80', year: '#a78bfa' };

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (value) => {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isWithinDays = (date, days) => {
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
};

const getWordKey = (event) => event?.word || event?.wordText || event?.term || event?.label || null;
const getScanDate = (event) => asDate(event.created_at || event.timestamp || event.createdAt || event.date);

const periodDays = { week: 7, month: 30, year: 365 };

export default function DashboardPage() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState('week');
  const [dashboardUsers, setDashboardUsers] = useState([]);
  const [authUsers, setAuthUsers] = useState({});
  const [scanHistory, setScanHistory] = useState([]);
  const [gobotMessages, setGobotMessages] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [tick, setTick] = useState(() => Date.now());

  // Online/offline is time-based (a stale heartbeat), so it needs to re-evaluate even when
  // no new Firestore data arrives.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (response.ok) setAuthUsers(result.authUsers || {});
      } catch {
        // Leave authUsers as-is — status just falls back to "Offline" until this succeeds.
      }
    });
  }, []);

  useEffect(() => {
    if (!db) return undefined;

    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setDashboardUsers(snapshot.docs.map((userDocument) => ({ id: userDocument.id, ...userDocument.data() })));
    });

    const scansUnsub = onSnapshot(collection(db, 'scan_history'), (snapshot) => {
      setScanHistory(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
      setLoadError('');
    }, (error) => {
      setLoadError(`Unable to load scan_history: ${error.message}`);
    });

    // Real Gobot conversations live in users/{uid}/chat_history — "gobotChats" was never written by the app.
    const gobotUnsub = onSnapshot(collectionGroup(db, 'chat_history'), (snapshot) => {
      setGobotMessages(snapshot.docs.filter((document) => document.data().role === 'user').map((document) => document.data()));
    }, (error) => {
      setLoadError((current) => current || `Unable to load chat_history: ${error.message}`);
    });

    return () => {
      usersUnsub();
      scansUnsub();
      gobotUnsub();
    };
  }, []);

  // Real presence: lastSeenAt is the live heartbeat the app writes while open; lastSignInAt
  // (Firebase Auth) is the fallback for users on an app version before that existed.
  const getLastSeen = (user) => asDate(user.lastSeenAt) || asDate((authUsers[user.id] || {}).lastSignInAt);
  const isUserSuspended = (user) => Boolean((authUsers[user.id] || {}).disabled);
  const isUserOnline = (user) => {
    if (isUserSuspended(user)) return false;
    const lastSeen = getLastSeen(user);
    return Boolean(lastSeen) && (tick - lastSeen.getTime()) < ONLINE_WINDOW_MS;
  };

  const activeToday = dashboardUsers.filter((user) => !isUserSuspended(user) && isSameDay(getLastSeen(user))).length;

  const wordsScannedToday = scanHistory.filter((event) => isSameDay(getScanDate(event))).length;
  const gobotChatsToday = gobotMessages.filter((message) => isSameDay(getScanDate(message))).length;

  const suspendedUsersCount = dashboardUsers.filter((user) => isUserSuspended(user)).length;
  const attentionMessage = suspendedUsersCount > 0 ? `${suspendedUsersCount} suspended user${suspendedUsersCount === 1 ? '' : 's'}` : null;

  const scansInPeriod = scanHistory.filter((event) => isWithinDays(getScanDate(event), periodDays[period]));

  // Only report on a period once history actually reaches back that far — otherwise month/year
  // would just silently repeat the same (incomplete) data as week, implying stats that aren't real yet.
  const earliestScanDate = scanHistory.reduce((earliest, event) => {
    const date = getScanDate(event);
    if (!date) return earliest;
    return !earliest || date < earliest ? date : earliest;
  }, null);
  const historyDays = earliestScanDate ? (Date.now() - earliestScanDate.getTime()) / 86400000 : 0;
  const hasFullPeriodHistory = historyDays >= periodDays[period];

  const popularWordCounts = hasFullPeriodHistory ? scansInPeriod.reduce((counts, event) => {
    const key = getWordKey(event);
    if (!key) return counts;

    const value = counts[key] || { word: key, definition: event.definition || '', count: 0 };
    value.count += 1;
    if (event.definition) value.definition = event.definition;
    counts[key] = value;
    return counts;
  }, {}) : {};

  const topWords = Object.values(popularWordCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((word) => ({
      word: word.word,
      count: word.count,
      meaning: word.definition || 'No definition recorded',
    }));

  const recentUsers = [...dashboardUsers]
    .sort((a, b) => (getLastSeen(b)?.getTime() || 0) - (getLastSeen(a)?.getTime() || 0))
    .slice(0, 5)
    .map((user) => {
      const name = user.name || user.displayName || user.email || 'Unnamed user';
      const suspended = isUserSuspended(user);
      const online = isUserOnline(user);
      const statusLabel = suspended ? 'Suspended' : online ? 'Online' : 'Offline';
      const statusColor = suspended ? '#ff6b6b' : online ? '#4ade80' : '#8a97a3';
      return {
        initial: name.charAt(0).toUpperCase(),
        color: online && !suspended ? theme.accent : '#ff6b6b',
        bg: online && !suspended ? theme.accentBg : 'rgba(255,107,107,.12)',
        name,
        loc: user.city || user.location || 'Location unknown',
        langs: Array.isArray(user.language) ? user.language : [user.language || 'TH'],
        status: statusLabel,
        statusColor,
      };
    });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: theme.textStrong, fontSize: '18px', fontWeight: 700 }}>Dashboard</div>
        <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '2px' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.25)', borderRadius: '10px', padding: '10px 14px', color: theme.danger, fontSize: '12px', marginBottom: '16px' }}>{loadError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '14px', marginBottom: '20px' }}>
        <StatCard icon="◯" num={dashboardUsers.length.toLocaleString()} label="Total users" color="#ffc800" />
        <StatCard icon="◉" num={activeToday.toLocaleString()} label="Active today" color="#4ade80" />
        <StatCard icon="☷" num={wordsScannedToday.toLocaleString()} label="Words scanned today" color="#a78bfa" />
        <StatCard
          icon={<img src="/robot 1.png" alt="robot" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />}
          num={gobotChatsToday.toLocaleString()}
          label="Gobot chats today"
          color="#00e5ff"
        />
      </div>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ color: theme.textStrong, fontSize: '13px', fontWeight: 700 }}>Popular word</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: period === p ? `1px solid ${periodColors[p]}` : `1px solid ${theme.border}`,
                  background: period === p ? `${periodColors[p]}2a` : theme.bgInput,
                  color: period === p ? periodColors[p] : theme.textMuted,
                  fontSize: '11px',
                  fontWeight: period === p ? 700 : 400,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: period === p ? `0 0 0 3px ${periodColors[p]}25` : 'none',
                  transition: 'all .15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {topWords.length > 0 ? (
            topWords.map((word, index) => {
              const wordColor = wordCardColors[index % wordCardColors.length];
              return (
                <div
                  key={word.word}
                  style={{
                    background: theme.mode === 'light' ? `linear-gradient(180deg, ${wordColor}38, ${wordColor}12)` : theme.bgInput,
                    border: theme.mode === 'light' ? `1px solid ${wordColor}70` : '1px solid transparent',
                    borderRadius: '14px',
                    padding: '16px 22px',
                    textAlign: 'center',
                    flex: '1 1 160px',
                  }}
                >
                  <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>{word.word}</div>
                  <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '4px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{word.meaning}</div>
                  <div style={{ color: theme.mode === 'light' ? wordColor : theme.accent, fontSize: '11px', marginTop: '6px', fontWeight: 700 }}>{word.count.toLocaleString()} scans</div>
                </div>
              );
            })
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '12px', padding: '12px 0' }}>
              {hasFullPeriodHistory ? 'No scan data yet for this period.' : `No data yet for this ${period} — check back once a full ${period} of activity has been recorded.`}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '22px', padding: '22px', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>Scans per day</div>
          </div>

          {scanHistory.length > 0 ? (() => {
            const days = Array.from({ length: 7 }, (_, index) => {
              const day = new Date();
              day.setDate(day.getDate() - (6 - index));
              const value = scanHistory.filter((event) => {
                const eventDate = getScanDate(event);
                return eventDate && eventDate.toDateString() === day.toDateString();
              }).length;
              return { label: day.toLocaleDateString('en-US', { weekday: 'short' }), value };
            });
            const maxValue = Math.max(...days.map((day) => day.value), 1);

            return (
              <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '12px' }}>
                {days.map(({ label, value }, index) => {
                  const barColor = barColors[index % barColors.length];
                  return (
                    <div key={label + index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: '100%' }}>
                      <div style={{ color: theme.textMuted, fontSize: '11px' }}>{value}</div>
                      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${value ? Math.max(8, (value / maxValue) * 100) : 4}%`, borderRadius: '8px 8px 0 0', background: `linear-gradient(180deg, ${barColor}, ${barColor}99)`, boxShadow: `0 0 16px ${barColor}40` }} />
                      </div>
                      <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            );
          })() : (
            <div style={{ flex: 1, color: theme.textMuted, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>No scan data available yet.</div>
          )}
        </div>

        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ color: theme.textStrong, fontSize: '13px', fontWeight: 700 }}>Recent users</div>
            <Link href="/admin/users" style={{ color: theme.accent, fontSize: '11px', textDecoration: 'none' }}>See all ›</Link>
          </div>

          {recentUsers.map((user) => (
            <div key={user.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: user.bg, color: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                {user.initial}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: theme.text, fontSize: '12px', fontWeight: 600 }}>{user.name}</div>
                <div style={{ color: theme.textMuted, fontSize: '10px' }}>{user.loc}</div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {user.langs.map((language) => (
                  <span key={language} style={{ background: `${langColors[language] || '#00e5ff'}18`, color: langColors[language] || '#00e5ff', border: `1px solid ${(langColors[language] || '#00e5ff')}33`, borderRadius: '4px', padding: '1px 6px', fontSize: '8px', fontWeight: 600 }}>{language}</span>
                ))}
              </div>
              <span style={{ background: `${user.statusColor}18`, color: user.statusColor, border: `1px solid ${user.statusColor}33`, borderRadius: '10px', padding: '2px 8px', fontSize: '9px' }}>{user.status}</span>
            </div>
          ))}
        </div>
      </div>

      {attentionMessage && (
        <div style={{ background: 'rgba(255,76,76,.08)', border: '1px solid rgba(255,76,76,.2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ color: '#ff6b6b', fontSize: '13px', fontWeight: 700 }}>⚑ Needs your attention</div>
          <div style={{ color: theme.textMuted, fontSize: '11px' }}>{attentionMessage}</div>
          <Link href="/admin/users" style={{ background: 'rgba(255,76,76,.15)', border: '1px solid rgba(255,76,76,.3)', borderRadius: '8px', padding: '6px 12px', color: '#ff6b6b', fontSize: '11px', textDecoration: 'none' }}>View users ›</Link>
        </div>
      )}
    </div>
  );
}