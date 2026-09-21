'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';

const cols = '1.5fr 2.5fr 1fr 1fr';

const categories = [
  { value: 'all', label: 'All' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'bug', label: 'Reports' },
];

const categoryColors = { feedback: '#00e5ff', bug: '#ff6b6b' };
const categoryLabels = { feedback: 'Feedback', bug: 'Report' };

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
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'feedback'), (snapshot) => {
      const docs = snapshot.docs.map((document) => {
        const data = document.data();
        const category = (data.type || data.category || 'feedback').toLowerCase();
        return {
          id: document.id,
          user: data.name || data.user || data.userName || data.displayName || data.email || 'ผู้ใช้',
          message: data.message || data.body || data.comment || data.text || data.thaiMessage || 'ไม่มีข้อความ',
          category,
          date: formatFeedbackDate(data.created_at || data.createdAt || data.created || data.date || data.timestamp),
        };
      });

      setFeedback(docs);
    });

    return unsubscribe;
  }, []);

  const byCategory = activeCategory === 'all' ? feedback : feedback.filter((item) => item.category === activeCategory);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? byCategory.filter((item) => item.user.toLowerCase().includes(query) || item.date.toLowerCase().includes(query))
    : byCategory;

  const counts = feedback.reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + 1;
    return result;
  }, {});

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
          flexWrap: 'wrap',
          gap: '12px',
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
            {filtered.length} of {feedback.length} item{feedback.length === 1 ? '' : 's'} from live data
          </div>
        </div>

        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: theme.textMuted }}>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user or date…"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: theme.text, fontSize: '12px', width: '200px', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {categories.map((cat) => {
          const active = activeCategory === cat.value;
          const color = cat.value === 'all' ? theme.accent : categoryColors[cat.value];
          const count = cat.value === 'all' ? feedback.length : (counts[cat.value] || 0);
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: active ? `1px solid ${color}` : `1px solid ${theme.border}`,
                background: active ? `${color}20` : theme.bgInput,
                color: active ? color : theme.textMuted,
                fontSize: '12px',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                outline: 'none',
                transition: 'all .15s',
              }}
            >
              {cat.label} ({count})
            </button>
          );
        })}
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
          {['User', 'Message', 'Category', 'Date'].map((h) => (
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

        {filtered.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              color: theme.textMuted,
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            {feedback.length === 0 ? 'No feedback yet in the database' : query ? 'No items match your search' : 'No items in this category'}
          </div>
        ) : (
          filtered.map((item, index) => {
            const color = categoryColors[item.category] || theme.textMuted;
            return (
              <div
                key={item.id}
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

                <span
                  style={{
                    background: `${color}18`,
                    color,
                    border: `1px solid ${color}33`,
                    borderRadius: '10px',
                    padding: '3px 10px',
                    fontSize: '10px',
                    fontWeight: 600,
                    justifySelf: 'start',
                  }}
                >
                  {categoryLabels[item.category] || item.category}
                </span>

                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '12px',
                  }}
                >
                  {item.date}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
