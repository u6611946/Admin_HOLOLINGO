'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import StatCard from '../../components/admin/StatCard';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';

const settings = [
  {
    label: 'Gobot enabled for all users',
    sub: 'Show Gobot tab in app nav',
    defaultOn: true,
  },
  {
    label: 'Save word from chat',
    sub: 'Allow "save word" pills in chat',
    defaultOn: true,
  },
  {
    label: 'Quiz mode in chat',
    sub: 'Enable quiz prompts inside Gobot',
    defaultOn: true,
  },
  {
    label: 'Scoped to saved vocab only',
    sub: "Bot uses only the user's own saved words",
    defaultOn: true,
  },
];

const convCols = '1.5fr 3fr 0.8fr 1fr';

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (value) => {
  const date = asDate(value);
  if (!date) return false;
  return date.toDateString() === new Date().toDateString();
};

const getUserInitials = (name) => {
  const base = String(name || 'U').trim();
  if (!base) return 'U';
  return base.charAt(0).toUpperCase();
};

const getQuestionType = (text) => {
  const message = String(text || '').toLowerCase();
  if (!message) return 'General';
  if (/(sentence|use .* in a sentence|in a sentence)/.test(message)) return 'Sentence';
  if (/(difference|compare|meaning|translate|translation)/.test(message)) return 'Meaning';
  if (/(quiz|test|review|practice)/.test(message)) return 'Quiz';
  if (/(save|remember|word)/.test(message)) return 'Save word';
  if (/(how do i say|say .* in|what is .* in)/.test(message)) return 'Translation';
  return 'General';
};

const formatTimestamp = (date) => {
  if (!date) return 'Unknown';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function GobotPage() {
  const { theme } = useTheme();
  const [toggles, setToggles] = useState(settings.map((s) => s.defaultOn));
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    });

    const chatsUnsub = onSnapshot(collectionGroup(db, 'chat_history'), (snapshot) => {
      const docs = snapshot.docs.map((document) => ({
        id: document.id,
        userId: document.ref.parent.parent?.id || null,
        ...document.data(),
      }));
      setMessages(docs);
    });

    return () => {
      usersUnsub();
      chatsUnsub();
    };
  }, []);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const conversations = useMemo(() => {
    const byUser = new Map();

    messages.forEach((message) => {
      if (!message.userId) return;
      const date = asDate(message.created_at || message.createdAt || message.timestamp);
      const existing = byUser.get(message.userId) || { userId: message.userId, count: 0, lastAt: null, lastContent: '' };
      existing.count += 1;
      if (!existing.lastAt || (date && date > existing.lastAt)) {
        existing.lastAt = date;
        existing.lastContent = message.content || '';
      }
      byUser.set(message.userId, existing);
    });

    return [...byUser.values()]
      .sort((a, b) => (b.lastAt?.getTime() || 0) - (a.lastAt?.getTime() || 0))
      .slice(0, 8)
      .map((conversation) => {
        const user = usersById.get(conversation.userId);
        const name = user?.name || user?.email || 'Unknown user';
        return {
          id: conversation.userId,
          initial: getUserInitials(name),
          color: '#00e5ff',
          bg: 'rgba(0,229,255,.12)',
          name,
          last: conversation.lastContent || 'No message',
          msgs: conversation.count,
          lastAt: formatTimestamp(conversation.lastAt),
        };
      });
  }, [messages, usersById]);

  const messagesToday = messages.filter((message) => isSameDay(message.created_at || message.createdAt || message.timestamp)).length;
  const activeChatters = new Set(messages.map((message) => message.userId).filter(Boolean)).size;
  const avgMessagesPerUser = activeChatters ? (messages.length / activeChatters).toFixed(1) : '0.0';

  const questionTypes = useMemo(() => {
    const userMessages = messages.filter((message) => message.role === 'user');
    const counts = {};
    userMessages.forEach((message) => {
      const label = getQuestionType(message.content);
      counts[label] = (counts[label] || 0) + 1;
    });

    const entries = Object.entries(counts)
      .map(([label, count], index) => ({
        label: `"${label}"`,
        pct: userMessages.length ? Math.max(8, Math.round((count / userMessages.length) * 100)) : 0,
        color: ['#00e5ff', '#a78bfa', '#4ade80', '#ffc800', '#ff6b6b'][index % 5],
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    if (entries.length === 0) {
      return [
        { label: '"General"', pct: 100, color: '#00e5ff' },
      ];
    }

    return entries;
  }, [messages]);

  const toggleSetting = (index) => {
    setToggles((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleExportLog = () => {
    const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ['User', 'Last message', 'Messages', 'Last active'],
      ...conversations.map((conversation) => [
        conversation.name,
        conversation.last,
        conversation.msgs,
        conversation.lastAt,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'gobot-conversations.csv';
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div
      style={{
        padding: '24px',
        background: theme.bgPage,
        minHeight: '100vh',
        color: theme.text,
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            color: theme.textStrong,
            fontSize: '18px',
            fontWeight: 700,
          }}
        >
          Gobot AI
        </div>

        <div
          style={{
            color: theme.textMuted,
            fontSize: '11px',
            marginTop: '2px',
          }}
        >
          AI tutor configuration & analytics
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <StatCard
          icon={
            <Image
              src="/robot 1.png"
              alt="Robot"
              width={20}
              height={20}
              style={{ objectFit: 'contain' }}
            />
          }
          num={messagesToday.toLocaleString()}
          label="Messages today"
          delta={messages.length ? `${messages.length.toLocaleString()} total` : 'No live data'}
          deltaUp
          color={theme.accent}
        />

        <StatCard
          icon={
            <Image
              src="/message.png"
              alt="Message"
              width={20}
              height={20}
              style={{ objectFit: 'contain' }}
            />
          }
          num={avgMessagesPerUser}
          label="Avg messages/user"
          delta={activeChatters ? `${activeChatters.toLocaleString()} active chatters` : 'No data'}
          deltaUp
          color="#4ade80"
        />

        <StatCard
          icon="✓"
          num={activeChatters.toLocaleString()}
          label="Active chatters"
          delta={messages.length ? 'live from Firestore' : 'No data'}
          deltaUp
          color="#a78bfa"
        />

        <StatCard
          icon={
            <Image
              src="/check1.png"
              alt="Check"
              width={20}
              height={20}
              style={{ objectFit: 'contain' }}
            />
          }
          num={messages.length.toLocaleString()}
          label="Total messages logged"
          delta={messages.length ? 'live from Firestore' : 'No data'}
          deltaUp
          color="#ffc800"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
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
            Most asked question types
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {questionTypes.map((q) => (
              <div
                key={q.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    color: theme.text,
                    fontSize: '12px',
                    minWidth: '200px',
                  }}
                >
                  {q.label}
                </span>

                <div
                  style={{
                    flex: 1,
                    height: '5px',
                    background: theme.bgInput,
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: q.pct + '%',
                      height: '100%',
                      background: q.color,
                      borderRadius: '3px',
                    }}
                  />
                </div>

                <span
                  style={{
                    color: q.color,
                    fontSize: '11px',
                    minWidth: '32px',
                    textAlign: 'right',
                  }}
                >
                  {q.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

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
            Gobot configuration
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {settings.map((s, i) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '11px 0',
                  borderBottom: i < settings.length - 1 ? `1px solid ${theme.border}` : 'none',
                }}
              >
                <div>
                  <div
                    style={{
                      color: theme.text,
                      fontSize: '12px',
                    }}
                  >
                    {s.label}
                  </div>

                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: '10px',
                      marginTop: '2px',
                    }}
                  >
                    {s.sub}
                  </div>
                </div>

                <div
                  onClick={() => toggleSetting(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      toggleSetting(i);
                    }
                  }}
                  style={{
                    width: '40px',
                    height: '24px',
                    borderRadius: '12px',
                    position: 'relative',
                    flexShrink: 0,
                    cursor: 'pointer',
                    background: toggles[i] ? theme.accent : theme.toggleOff,
                    border: toggles[i] ? 'none' : `1px solid ${theme.toggleOffBorder}`,
                    transition: 'background .2s',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: toggles[i] ? 'calc(100% - 21px)' : '3px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: toggles[i] ? '#fff' : theme.toggleKnobOff,
                      transition: 'left .2s',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              color: theme.textStrong,
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            Recent Gobot conversations
          </div>

          <button
            onClick={handleExportLog}
            style={{
              background: theme.bgCard,
              border: `1px solid ${theme.borderStrong}`,
              borderRadius: '7px',
              padding: '5px 12px',
              color: theme.accent,
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Export log ›
          </button>
        </div>

        <div
          style={{
            background: theme.bgInput,
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: convCols,
              gap: '8px',
              padding: '8px 14px',
              background: theme.bgInput,
            }}
          >
            {['User', 'Last message', 'Messages', 'Last active'].map((h) => (
              <div
                key={h}
                style={{
                  color: theme.textMuted,
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '.07em',
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {conversations.length === 0 ? (
            <div style={{ padding: '20px 14px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
              No Gobot chat data yet in Firestore.
            </div>
          ) : (
            conversations.map((c, i) => (
              <div
                key={c.id || c.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: convCols,
                  gap: '8px',
                  padding: '10px 14px',
                  borderTop: `1px solid ${theme.border}`,
                  alignItems: 'center',
                  background: i % 2 === 1 ? theme.bgPage : 'transparent',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c.bg,
                      color: c.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {c.initial}
                  </div>

                  <span
                    style={{
                      color: theme.text,
                      fontSize: '12px',
                    }}
                  >
                    {c.name}
                  </span>
                </div>

                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '11px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.last}
                </div>

                <div
                  style={{
                    color: theme.accent,
                    fontSize: '12px',
                  }}
                >
                  {c.msgs}
                </div>

                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '11px',
                  }}
                >
                  {c.lastAt}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
