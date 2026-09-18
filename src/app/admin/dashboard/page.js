'use client';
import { useEffect, useState } from 'react';
import StatCard from '../../components/admin/StatCard';
import Link from 'next/link';
import { useTheme } from '../../ThemeContext';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const langColors = { TH: '#00e5ff' };

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
  const [scanHistory, setScanHistory] = useState([]);
  const [gobotMessages, setGobotMessages] = useState([]);
  const [flaggedIssues, setFlaggedIssues] = useState([]);
  const [loadError, setLoadError] = useState('');

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

    const flaggedUnsub = onSnapshot(collection(db, 'flagged'), (snapshot) => {
      setFlaggedIssues(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    }, (error) => {
      setLoadError((current) => current || `Unable to load flagged: ${error.message}`);
    });

    return () => {
      usersUnsub();
      scansUnsub();
      gobotUnsub();
      flaggedUnsub();
    };
  }, []);

  const activeToday = dashboardUsers.filter((user) => {
    const activity = user.lastActive || user.last_active || user.updatedAt || user.updated_at;
    const date = asDate(activity);
    if (!date) return user.status !== 'inactive' && user.active !== false;
    return date.toDateString() === new Date().toDateString();
  }).length;

  const wordsScannedToday = scanHistory.filter((event) => isSameDay(getScanDate(event))).length;
  const gobotChatsToday = gobotMessages.filter((message) => isSameDay(getScanDate(message))).length;

  const inactiveUsersCount = dashboardUsers.filter((user) => user.status === 'inactive' || user.active === false).length;
  const attentionParts = [
    ...flaggedIssues.slice(0, 2).map((issue) => issue.title || issue.label || 'Flagged item'),
    inactiveUsersCount > 0 ? `${inactiveUsersCount} inactive user${inactiveUsersCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  const attentionCount = flaggedIssues.length + (inactiveUsersCount > 0 ? 1 : 0);

  const scansInPeriod = scanHistory.filter((event) => isWithinDays(getScanDate(event), periodDays[period]));

  const popularWordCounts = scansInPeriod.reduce((counts, event) => {
    const key = getWordKey(event);
    if (!key) return counts;

    const value = counts[key] || { word: key, definition: event.definition || '', count: 0 };
    value.count += 1;
    if (event.definition) value.definition = event.definition;
    counts[key] = value;
    return counts;
  }, {});

  const topWords = Object.values(popularWordCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((word) => ({
      word: word.word,
      count: word.count,
      meaning: word.definition || 'No definition recorded',
    }));

  const recentUsers = dashboardUsers.slice(0, 5).map((user) => {
    const name = user.name || user.displayName || user.email || 'Unnamed user';
    const inactive = user.status === 'inactive' || user.active === false;
    return {
      initial: name.charAt(0).toUpperCase(),
      color: inactive ? '#ff6b6b' : theme.accent,
      bg: inactive ? 'rgba(255,107,107,.12)' : theme.accentBg,
      name,
      loc: user.city || user.location || 'Location unknown',
      langs: Array.isArray(user.language) ? user.language : [user.language || 'TH'],
      status: inactive ? 'Inactive' : 'Active',
      statusColor: inactive ? '#ff6b6b' : '#4ade80',
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
                  border: period === p ? `1px solid ${theme.accentBorder}` : `1px solid ${theme.border}`,
                  background: period === p ? theme.accentBg : theme.bgInput,
                  color: period === p ? theme.accent : theme.textMuted,
                  fontSize: '11px',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {topWords.length > 0 ? (
            topWords.map((word) => (
              <div key={word.word} style={{ background: theme.bgInput, borderRadius: '14px', padding: '16px 22px', textAlign: 'center', flex: '1 1 160px' }}>
                <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>{word.word}</div>
                <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '4px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{word.meaning}</div>
                <div style={{ color: theme.accent, fontSize: '11px', marginTop: '6px' }}>{word.count.toLocaleString()} scans</div>
              </div>
            ))
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '12px', padding: '12px 0' }}>No scan data yet for this period.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '22px', padding: '22px', minHeight: '420px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>Scans per day</div>
            <div style={{ color: theme.accent, fontSize: '15px', fontWeight: 500, cursor: 'pointer' }}>Full report ›</div>
          </div>

          {scanHistory.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '12px', alignItems: 'end', height: '210px' }}>
              {Array.from({ length: 7 }, (_, index) => {
                const day = new Date();
                day.setDate(day.getDate() - (6 - index));
                const label = day.toLocaleDateString('en-US', { weekday: 'short' });
                const value = scanHistory.filter((event) => {
                  const eventDate = getScanDate(event);
                  return eventDate && eventDate.toDateString() === day.toDateString();
                }).length;
                return (
                  <div key={label + index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ color: theme.textMuted, fontSize: '11px' }}>{value}</div>
                    <div style={{ width: '100%', height: `${Math.max(18, value * 14 || 12)}px`, borderRadius: '8px 8px 0 0', background: theme.accent }} />
                    <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '12px', padding: '40px 0', textAlign: 'center' }}>No scan data available yet.</div>
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

      {attentionCount > 0 && (
        <div style={{ background: 'rgba(255,76,76,.08)', border: '1px solid rgba(255,76,76,.2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ color: '#ff6b6b', fontSize: '13px', fontWeight: 700 }}>⚑ {attentionCount} item{attentionCount === 1 ? '' : 's'} need your attention</div>
          <div style={{ color: theme.textMuted, fontSize: '11px' }}>{attentionParts.join(' · ')}</div>
          <Link href="/admin/flagged" style={{ background: 'rgba(255,76,76,.15)', border: '1px solid rgba(255,76,76,.3)', borderRadius: '8px', padding: '6px 12px', color: '#ff6b6b', fontSize: '11px', textDecoration: 'none' }}>View flagged ›</Link>
        </div>
      )}
    </div>
  );
}