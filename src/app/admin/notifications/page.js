'use client';

import StatCard from '../../components/admin/StatCard';
import { useTheme } from '../../ThemeContext';

const recentPushes = [
  {
    dot: '#4ade80',
    title: 'Daily reminder',
    body: 'Your review words are waiting!',
    meta: 'Today · 1,284 users · 74% opened',
  },
  {
    dot: '#a78bfa',
    title: 'New challenge available',
    body: "Today's daily challenge is live — can you score 10/10?",
    meta: 'Yesterday · 1,284 users · 68% opened',
  },
  {
    dot: '#ffc800',
    title: 'Re-engagement push',
    body: 'We miss you! You have new words waiting.',
    meta: '3 days ago · 42 inactive users · 31% opened',
  },
];

export default function NotificationsPage() {
  const { theme } = useTheme();

  const inputStyle = {
    background: theme.bgInput,
    border: `1px solid ${theme.borderStrong}`,
    borderRadius: '9px',
    padding: '9px 12px',
    color: theme.text,
    fontSize: '12px',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
  };

  const labelStyle = {
    color: theme.textMuted,
    fontSize: '10px',
    marginBottom: '4px',
  };

  const cardStyle = {
    background: theme.bgCard,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '18px',
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
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            color: theme.textStrong,
            fontSize: '18px',
            fontWeight: 700,
          }}
        >
          Notifications
        </div>

        <div
          style={{
            color: theme.textMuted,
            fontSize: '11px',
            marginTop: '2px',
          }}
        >
          Send and schedule push messages to users
        </div>
      </div>

      {/* STATS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <StatCard
          icon="◯"
          num="1,284"
          label="Subscribed users"
          color={theme.accent}
        />

        <StatCard
          icon="%"
          num="74%"
          label="Open rate (last push)"
          delta="+6% vs avg"
          deltaUp
          color="#4ade80"
        />

        <StatCard
          icon="⊕"
          num="3"
          label="Scheduled pushes"
          color="#ffc800"
        />
      </div>

      {/* MAIN GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
        }}
      >
        {/* COMPOSE */}
        <div style={cardStyle}>
          <div
            style={{
              color: theme.textStrong,
              fontSize: '13px',
              fontWeight: 700,
              marginBottom: '14px',
            }}
          >
            Compose push notification
          </div>

          {/* TARGET AUDIENCE */}
          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Target audience</div>

            <input
              defaultValue="All users (1,284)"
              style={inputStyle}
            />
          </div>

          {/* MESSAGE TITLE */}
          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Message title</div>

            <input
              defaultValue="Keep learning today!"
              style={{
                ...inputStyle,
                border: `1px solid ${theme.accentBorder}`,
                color: theme.textStrong,
              }}
            />
          </div>

          {/* MESSAGE BODY */}
          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Message body</div>

            <textarea
              defaultValue="You have new words ready for review today. Open the app and continue learning!"
              rows={3}
              style={{
                ...inputStyle,
                resize: 'none',
              }}
            />
          </div>

          {/* SEND TIME + TYPE */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            {/* SEND TIME */}
            <div>
              <div style={labelStyle}>Send time</div>

              <input
                defaultValue="Today, 8:00 PM"
                style={inputStyle}
              />
            </div>

            {/* TYPE */}
            <div>
              <div style={labelStyle}>Type</div>

              <input
                defaultValue="Learning reminder"
                style={inputStyle}
              />
            </div>
          </div>

          {/* BUTTONS */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                flex: 1,
                background: theme.accent,
                border: 'none',
                borderRadius: '9px',
                padding: '11px',
                color: theme.mode === 'light' ? '#ffffff' : '#042c3a',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Schedule send
            </button>

            <button
              style={{
                background: theme.bgCard,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: '9px',
                padding: '11px 16px',
                color: theme.textMuted,
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Send now
            </button>
          </div>
        </div>

        {/* RECENT PUSHES */}
        <div style={cardStyle}>
          <div
            style={{
              color: theme.textStrong,
              fontSize: '13px',
              fontWeight: 700,
              marginBottom: '14px',
            }}
          >
            Recent pushes sent
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {recentPushes.map((p) => (
              <div
                key={p.title}
                style={{
                  background: theme.bgInput,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                {/* STATUS DOT */}
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: p.dot,
                    marginTop: '3px',
                    flexShrink: 0,
                  }}
                />

                <div>
                  {/* TITLE */}
                  <div
                    style={{
                      color: theme.text,
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {p.title}
                  </div>

                  {/* BODY */}
                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: '11px',
                      marginTop: '3px',
                    }}
                  >
                    {p.body}
                  </div>

                  {/* META */}
                  <div
                    style={{
                      color: theme.textFaint,
                      fontSize: '10px',
                      marginTop: '5px',
                    }}
                  >
                    {p.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}