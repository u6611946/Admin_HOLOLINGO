'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';

const cols = '1.5fr 2.5fr 1fr';

function formatFeedbackDate(value) {
  if (!value) return '—';

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('th-TH');
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('th-TH');
  }

  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toLocaleDateString('th-TH');
  }

  return String(value);
}

export default function FeedbackPage() {
  const { theme } = useTheme();
  const [feedback, setFeedback] = useState([]);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'feedback'), (snapshot) => {
      const docs = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          user: data.name || data.user || data.userName || data.displayName || data.email || 'ผู้ใช้',
          message: data.message || data.body || data.comment || data.text || data.thaiMessage || 'ไม่มีข้อความ',
          date: formatFeedbackDate(data.created_at || data.createdAt || data.created || data.date || data.timestamp),
        };
      });

      setFeedback(docs);
    });

    return unsubscribe;
  }, []);

  return (
    <div
      style={{
        padding: '24px',
        background: theme.bgPage,
        minHeight: '100vh',
        color: theme.text,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
        }}
      >
        <div>
          <div
            style={{
              color: theme.textStrong,
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            Feedback
          </div>

          <div
            style={{
              color: theme.textMuted,
              fontSize: '11px',
              marginTop: '2px',
            }}
          >
            {feedback.length} items from live data
          </div>
        </div>
      </div>

      <div
        style={{
          background: theme.bgCard,
          border: `1px solid ${theme.border}`,
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: '8px',
            padding: '10px 16px',
            background: theme.bgInput,
          }}
        >
          {['User', 'Message', 'Date'].map((h) => (
            <div
              key={h}
              style={{
                color: theme.textMuted,
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                fontWeight: 600,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {feedback.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              color: theme.textMuted,
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            No feedback yet in the database
          </div>
        ) : (
          feedback.map((item, index) => (
            <div
              key={item.id || `${item.user}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: cols,
                gap: '8px',
                padding: '12px 16px',
                borderTop: `1px solid ${theme.border}`,
                alignItems: 'center',
                background: index % 2 === 1 ? theme.bgInput : 'transparent',
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
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'rgba(0,229,255,.12)',
                    color: theme.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(item.user || 'ผ').charAt(0).toUpperCase()}
                </div>

                <div
                  style={{
                    color: theme.text,
                    fontSize: '12px',
                  }}
                >
                  {item.user}
                </div>
              </div>

              <div
                style={{
                  color: theme.text,
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                {item.message}
              </div>

              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '12px',
                }}
              >
                {item.date}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}