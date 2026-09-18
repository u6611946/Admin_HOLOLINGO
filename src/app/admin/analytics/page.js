'use client';

import { useEffect, useState } from 'react';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import StatCard from '../../components/admin/StatCard';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/firebase';

const langNames = { TH: 'Thai' };
const langColors = { TH: '#00e5ff' };
const palette = ['#00e5ff', '#a78bfa', '#4ade80', '#ffc800', '#ff6b6b'];

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

const isWithinDays = (date, days) => {
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
};

const getUserDate = (user) => asDate(user.createdAt || user.created_at || user.joinedAt || user.joined_at);
const getEventDate = (event) => asDate(event.created_at || event.timestamp || event.createdAt || event.date);

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const [users, setUsers] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [gobotMessages, setGobotMessages] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!db) return undefined;

    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
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

  const totalUsers = users.length;

  const activeToday = users.filter((user) => {
    const activity = asDate(user.lastActive || user.last_active || user.updatedAt || user.updated_at);
    if (!activity) return user.status !== 'inactive' && user.active !== false;
    return isSameDay(activity, new Date());
  }).length;

  const dailyRetentionPct = totalUsers ? Math.round((activeToday / totalUsers) * 100) : 0;
  const newUsersThisWeek = users.filter((user) => isWithinDays(getUserDate(user), 7)).length;
  const scansThisWeek = scanHistory.filter((event) => isWithinDays(getEventDate(event), 7)).length;
  const gobotChatsThisWeek = gobotMessages.filter((message) => isWithinDays(getEventDate(message), 7)).length;

  const chartData = Array.from({ length: 4 }, (_, index) => {
    const weeksAgo = 3 - index;
    const start = new Date();
    start.setDate(start.getDate() - (weeksAgo + 1) * 7);
    const end = new Date();
    end.setDate(end.getDate() - weeksAgo * 7);
    const count = users.filter((user) => {
      const date = getUserDate(user);
      return date && date > start && date <= end;
    }).length;
    return { w: `W${index + 1}`, v: count };
  });
  const chartMax = Math.max(1, ...chartData.map((b) => b.v));

  const langCounts = users.reduce((counts, user) => {
    const rawLanguage = Array.isArray(user.language) ? user.language[0] : user.language;
    const normalized = typeof rawLanguage === 'string' ? rawLanguage.trim() : '';
    if (!normalized) return counts;

    const key = normalized.toLowerCase();
    const entry = counts[key] || { code: normalized, count: 0 };
    entry.count += 1;
    counts[key] = entry;
    return counts;
  }, {});

  const langBreakdown = Object.values(langCounts)
    .map(({ code, count }, index) => ({
      code,
      pct: totalUsers ? Math.round((count / totalUsers) * 100) : 0,
      color: langColors[code] || palette[index % palette.length],
    }))
    .sort((a, b) => b.pct - a.pct);

  const topLanguage = langBreakdown[0]?.code || '—';

  const scanShare = scansThisWeek + gobotChatsThisWeek
    ? Math.round((scansThisWeek / (scansThisWeek + gobotChatsThisWeek)) * 100)
    : 0;

  const features = [
    { label: 'AR Scan used', pct: scanShare, color: theme.accent },
    { label: 'Gobot AI', pct: 100 - scanShare, color: '#00e5ff' },
  ];

  return (
    <div style={{ padding: '24px' }}>

      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            color: theme.textStrong,
            fontSize: '18px',
            fontWeight: 700,
          }}
        >
          Analytics
        </div>

        <div
          style={{
            color: theme.textMuted,
            fontSize: '11px',
            marginTop: '2px',
          }}
        >
          Last 7 days
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.25)', borderRadius: '10px', padding: '10px 14px', color: theme.danger, fontSize: '12px', marginBottom: '16px' }}>{loadError}</div>
      )}

      {/* STATS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <StatCard
          icon="%"
          num={`${dailyRetentionPct}%`}
          label="Active today"
          color={theme.accent}
        />

        <StatCard
          icon="↺"
          num={newUsersThisWeek.toLocaleString()}
          label="New users this week"
          color="#4ade80"
        />

        <StatCard
          icon="☷"
          num={scansThisWeek.toLocaleString()}
          label="AR scans this week"
          color="#a78bfa"
        />

        <StatCard
          icon="⚑"
          num={totalUsers.toLocaleString()}
          label="Total Thai learners"
          color="#ffc800"
        />
      </div>

      {/* TOP GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}
      >

        {/* NEW USERS CHART */}
        <div
          style={{
            background: theme.bgCard,
            border: `1px solid ${theme.border}`,
            borderRadius: '16px',
            padding: '20px',
            minHeight: '440px',
            boxShadow:
              theme.mode === 'dark'
                ? '0 0 0 1px rgba(0,229,255,.02) inset'
                : '0 0 0 1px rgba(0,0,0,.02) inset',
          }}
        >
          <div
            style={{
              color: theme.textStrong,
              fontSize: '13px',
              fontWeight: 700,
              marginBottom: '24px',
            }}
          >
            New users per week (4 weeks)
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '22px',
              height: '300px',
              marginTop: '20px',
            }}
          >
            {chartData.map((b) => {
              const height = Math.round((b.v / chartMax) * 100);
              return (
                <div
                  key={b.w}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      marginBottom: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color:
                        height === 100
                          ? theme.accent
                          : '#b388ff',
                    }}
                  >
                    {b.v}
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: '160px',
                      background:
                        theme.mode === 'dark'
                          ? '#0b1b25'
                          : '#e8eef1',
                      borderRadius: '10px 10px 0 0',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: `${height}%`,
                        background:
                          height === 100
                            ? theme.accent
                            : '#9c7be8',
                        borderRadius: '10px 10px 0 0',
                        transition: '0.3s ease',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: '12px',
                      color: theme.textMuted,
                      fontSize: '12px',
                    }}
                  >
                    {b.w}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LANGUAGE BREAKDOWN */}
        <div
          style={{
            background: theme.bgCard,
            border: `1px solid ${theme.border}`,
            borderRadius: '14px',
            padding: '18px',
          }}
        >
          <div
            style={{
              color: theme.textStrong,
              fontSize: '13px',
              fontWeight: 700,
              marginBottom: '14px',
            }}
          >
            Language breakdown
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {langBreakdown.length > 0 ? langBreakdown.map((l) => (
              <div
                key={l.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    color: l.color,
                    fontSize: '11px',
                    minWidth: '24px',
                  }}
                >
                  {l.code}
                </span>

                <div
                  style={{
                    flex: 1,
                    height: '5px',
                    background:
                      theme.mode === 'dark'
                        ? '#111d26'
                        : '#dfe7eb',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: l.pct + '%',
                      height: '100%',
                      background: l.color,
                      borderRadius: '3px',
                    }}
                  />
                </div>

                <span
                  style={{
                    color: theme.text,
                    fontSize: '11px',
                    minWidth: '32px',
                    textAlign: 'right',
                  }}
                >
                  {l.pct}%
                </span>
              </div>
            )) : (
              <div style={{ color: theme.textMuted, fontSize: '11px' }}>No user data yet.</div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: '8px',
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            {[
              {
                l: 'Language',
                v: langNames[topLanguage] || topLanguage,
                c: theme.accent,
              },
              {
                l: 'Total learners',
                v: totalUsers.toLocaleString(),
                c: '#4ade80',
              },
              {
                l: 'New this week',
                v: newUsersThisWeek.toLocaleString(),
                c: '#ffc800',
              },
            ].map((i) => (
              <div
                key={i.l}
                style={{
                  background:
                    theme.mode === 'dark'
                      ? '#0a1218'
                      : '#f0f4f6',
                  borderRadius: '8px',
                  padding: '8px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '9px',
                  }}
                >
                  {i.l}
                </div>

                <div
                  style={{
                    color: i.c,
                    fontSize: '11px',
                    fontWeight: 700,
                    marginTop: '2px',
                  }}
                >
                  {i.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURE USAGE */}
      <div
        style={{
          background: theme.bgCard,
          border: `1px solid ${theme.border}`,
          borderRadius: '14px',
          padding: '18px',
        }}
      >
        <div
          style={{
            color: theme.textStrong,
            fontSize: '13px',
            fontWeight: 700,
            marginBottom: '14px',
          }}
        >
          Feature usage (last 7 days)
        </div>

        {scansThisWeek + gobotChatsThisWeek > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
              gap: '10px',
            }}
          >
            {features.map((f) => (
              <div
                key={f.label}
                style={{
                  background:
                    theme.mode === 'dark'
                      ? '#0a1218'
                      : '#f0f4f6',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    color: f.color,
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  {f.pct}%
                </div>

                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '10px',
                    marginTop: '4px',
                  }}
                >
                  {f.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: theme.textMuted, fontSize: '12px', padding: '12px 0' }}>No activity data yet.</div>
        )}
      </div>

    </div>
  );
}
