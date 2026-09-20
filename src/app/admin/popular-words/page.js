'use client';

import { useEffect, useState } from 'react';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/firebase';

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function PopularWordsPage() {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [words, setWords] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    let scanEntries = [];
    let savedCounts = {};

    const rebuild = () => {
      const totals = scanEntries.reduce((result, event) => {
        const key = event.word || event.wordText || event.term || event.label;
        if (!key) return result;

        const normalizedKey = key.toLowerCase();
        const date = asDate(event.created_at || event.timestamp || event.createdAt || event.date);
        const current = result[normalizedKey] || { id: normalizedKey, word: key, definition: '', searches: 0, saved: 0, lastScannedAt: null };
        current.searches += 1;
        if (event.definition) current.definition = event.definition;
        if (date && (!current.lastScannedAt || date > current.lastScannedAt)) current.lastScannedAt = date;
        result[normalizedKey] = current;
        return result;
      }, {});

      Object.values(totals).forEach((entry) => {
        entry.saved = savedCounts[entry.id] || 0;
      });

      setWords(Object.values(totals).sort((a, b) => b.searches - a.searches));
    };

    const scansUnsub = onSnapshot(collection(db, 'scan_history'), (snapshot) => {
      scanEntries = snapshot.docs.map((document) => document.data());
      setLoadError('');
      rebuild();
    }, (error) => {
      setLoadError(`Unable to load scan_history: ${error.message}`);
    });

    // saved_words docs live under users/{uid}/saved_words/{word}; the doc id is the word itself.
    const savedUnsub = onSnapshot(collectionGroup(db, 'saved_words'), (snapshot) => {
      savedCounts = snapshot.docs.reduce((counts, document) => {
        const key = document.id.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});
      rebuild();
    }, (error) => {
      setLoadError((current) => current || `Unable to load saved_words: ${error.message}`);
    });

    return () => {
      scansUnsub();
      savedUnsub();
    };
  }, []);

  const filtered = words.filter((word) => word.word.toLowerCase().includes(search.toLowerCase()));

  const totalSearches = words.reduce((sum, word) => sum + Number(word.searches || 0), 0);
  const uniqueWords = words.length;
  const totalSaved = words.reduce((sum, word) => sum + Number(word.saved || 0), 0);

  return (
    <div style={{ padding: '24px', color: theme.text }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>Popular words</div>
        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '3px' }}>Most searched and saved words by users</div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.25)', borderRadius: '10px', padding: '10px 14px', color: theme.danger, fontSize: '12px', marginBottom: '16px' }}>{loadError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total searches', value: totalSearches.toLocaleString(), sub: 'all time', color: '#ffc800' },
          { label: 'Total saved', value: totalSaved.toLocaleString(), sub: 'by users', color: '#4ade80' },
          { label: 'Unique words', value: uniqueWords.toLocaleString(), sub: 'in database', color: '#a78bfa' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: `linear-gradient(160deg, ${item.color}1f 0%, ${theme.bgCard} 55%)`,
              border: `1px solid ${item.color}40`,
              borderRadius: '12px',
              padding: '14px 16px',
            }}
          >
            <div style={{ color: item.color, fontSize: '20px', fontWeight: 700 }}>{item.value}</div>
            <div style={{ color: theme.text, fontSize: '12px', marginTop: '2px' }}>{item.label}</div>
            <div style={{ color: theme.textMuted, fontSize: '10px', marginTop: '2px' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search words…"
          style={{ flex: 1, minWidth: '180px', background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '8px 12px', color: theme.text, fontSize: '13px', outline: 'none' }}
          onFocus={(event) => {
            event.target.style.borderColor = theme.accentBorder;
          }}
          onBlur={(event) => {
            event.target.style.borderColor = theme.border;
          }}
        />
      </div>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '10px', padding: '10px 16px', background: theme.bgInput }}>
          {['Word', 'Definition', 'Searches', 'Saved', 'Last scanned'].map((header) => (
            <div key={header} style={{ color: theme.textFaint, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.07em' }}>{header}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '28px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>No popular word data available yet.</div>
        ) : (
          filtered.map((word) => (
            <div key={word.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '10px', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${theme.border}` }}>
              <div style={{ color: theme.textStrong, fontSize: '13px', fontWeight: 600 }}>{word.word}</div>
              <div style={{ color: theme.textMuted, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{word.definition || '—'}</div>
              <div style={{ color: theme.text, fontSize: '13px' }}>{word.searches.toLocaleString()}</div>
              <div style={{ color: theme.text, fontSize: '13px' }}>{word.saved.toLocaleString()}</div>
              <div style={{ color: theme.textMuted, fontSize: '12px' }}>{word.lastScannedAt ? word.lastScannedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}