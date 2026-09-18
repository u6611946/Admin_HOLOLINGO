'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';

export default function FlaggedPage() {
  const { theme } = useTheme();
  const [issues, setIssues] = useState([]);
  const [feedback, setFeedback] = useState([]);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const flaggedUnsub = onSnapshot(collection(db, 'flagged'), (snapshot) => {
      const docs = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      setIssues(docs);
    });

    const feedbackUnsub = onSnapshot(collection(db, 'feedback'), (snapshot) => {
      const docs = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      setFeedback(docs);
    });

    return () => {
      flaggedUnsub();
      feedbackUnsub();
    };
  }, []);

  const sectionLabelStyle = {
    color: theme.textMuted,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    marginBottom: '8px',
  };

  return (
    <div style={{ padding: '24px', background: theme.bgPage, minHeight: '100vh', color: theme.text }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: theme.danger, fontSize: '18px', fontWeight: 700 }}>Flagged items</div>
        <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '2px' }}>
          {issues.length} flagged issue{issues.length === 1 ? '' : 's'} from the live app
        </div>
      </div>

      <div style={sectionLabelStyle}>Critical — content errors</div>

      {issues.length === 0 ? (
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '16px', color: theme.textMuted }}>
          No flagged issues yet.
        </div>
      ) : (
        issues.map((item) => (
          <div key={item.id} style={{ background: theme.mode === 'light' ? 'rgba(217,72,72,.06)' : 'rgba(255,76,76,.06)', border: theme.mode === 'light' ? '1px solid rgba(217,72,72,.20)' : '1px solid rgba(255,76,76,.20)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: theme.text, fontSize: '12px', fontWeight: 600 }}>{item.title || item.label || 'Flagged item'}</div>
              <div style={{ color: theme.textMuted, fontSize: '10px', marginTop: '2px' }}>{item.description || item.message || item.sub || 'No description provided.'}</div>
            </div>

            <Link href="/admin/words" style={{ background: theme.mode === 'light' ? 'rgba(217,72,72,.10)' : 'rgba(255,76,76,.15)', border: theme.mode === 'light' ? '1px solid rgba(217,72,72,.25)' : '1px solid rgba(255,76,76,.30)', borderRadius: '8px', padding: '5px 12px', color: theme.danger, fontSize: '11px', textDecoration: 'none' }}>
              Review
            </Link>
          </div>
        ))
      )}

      <div style={{ ...sectionLabelStyle, margin: '18px 0 8px' }}>User feedback</div>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        {feedback.length === 0 ? (
          <div style={{ padding: '18px 16px', color: theme.textMuted, fontSize: '12px' }}>No user feedback yet.</div>
        ) : (
          feedback.map((item, index) => (
            <div key={item.id || index} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: index < feedback.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,229,255,.12)', color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                {(item.name || item.user || 'U').charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ color: theme.text, fontSize: '12px', fontWeight: 600 }}>{item.name || item.user || 'User'}</div>
                <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '3px' }}>{item.message || item.body || item.comment || 'No message provided.'}</div>
              </div>

              <Link href="/admin/feedback" style={{ background: theme.bgCard, border: `1px solid ${theme.borderStrong}`, borderRadius: '6px', padding: '3px 8px', color: theme.textMuted, fontSize: '10px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
                Reply
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}