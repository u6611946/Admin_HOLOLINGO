'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';

const cols = '1.2fr 1.8fr 0.8fr 0.8fr 1.3fr';

const statusColors = {
  pending: '#ffc800',
  reviewed: '#4ade80',
  resolved: '#4ade80',
  dismissed: '#8a97a3',
};

function formatReportDate(value) {
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

export default function ReportsPage() {
  const { theme } = useTheme();
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'flagged'), (snapshot) => {
      const docs = snapshot.docs.map((document) => {
        const data = document.data();
        const status = (data.status || 'pending').toLowerCase();
        return {
          id: document.id,
          reporter: data.reporterName || data.reporter || data.name || data.userName || data.displayName || data.email || 'ผู้ใช้',
          target: data.targetType || data.contentType || data.reportedType || null,
          reason: data.reason || data.category || data.type || 'Not specified',
          details: data.details || data.message || data.description || data.body || data.comment || '',
          status,
          date: formatReportDate(data.created_at || data.createdAt || data.created || data.date || data.timestamp),
        };
      });

      setReports(docs);
    }, () => {
      setReports([]);
    });

    return unsubscribe;
  }, []);

  const setReportStatus = async (id, status) => {
    if (!db) return;
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'flagged', id), { status });
    } catch {
      // Firestore rules reject unauthorized changes — the snapshot listener keeps the UI in sync either way.
    } finally {
      setUpdatingId(null);
    }
  };

  const query = search.trim().toLowerCase();
  const filteredReports = query
    ? reports.filter((item) => item.reporter.toLowerCase().includes(query))
    : reports;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <div style={{ color: theme.textStrong, fontSize: '18px', fontWeight: 700 }}>Reports</div>
          <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '2px' }}>
            {filteredReports.length} of {reports.length} report{reports.length === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: theme.textMuted }}>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reporter…"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: theme.text, fontSize: '12px', width: '220px', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '8px', padding: '10px 16px', background: theme.bgInput }}>
          {['Reporter', 'Reason & details', 'Status', 'Date', 'Actions'].map((h) => (
            <div key={h} style={{ color: theme.textMuted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>{h}</div>
          ))}
        </div>

        {filteredReports.length === 0 ? (
          <div style={{ padding: '24px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
            {reports.length === 0 ? 'No reports yet in the database' : 'No reports match your search'}
          </div>
        ) : (
          filteredReports.map((item, index) => {
            const statusColor = statusColors[item.status] || '#8a97a3';
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,107,107,.12)', color: '#ff6b6b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                    {(item.reporter || 'ผ').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ color: theme.text, fontSize: '12px' }}>{item.reporter}</div>
                </div>

                <div style={{ color: theme.text, fontSize: '12px', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600 }}>{item.reason}{item.target ? ` · ${item.target}` : ''}</div>
                  {item.details && (
                    <div style={{ color: theme.textMuted, marginTop: '2px' }}>{item.details}</div>
                  )}
                </div>

                <span style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}33`, borderRadius: '10px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'capitalize', justifySelf: 'start' }}>{item.status}</span>

                <div style={{ color: theme.textMuted, fontSize: '12px' }}>{item.date}</div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {item.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => setReportStatus(item.id, 'resolved')}
                        disabled={updatingId === item.id}
                        style={{ background: 'rgba(74,222,128,.10)', border: '1px solid rgba(74,222,128,.25)', borderRadius: '8px', padding: '4px 10px', color: '#4ade80', fontSize: '10px', fontWeight: 600, cursor: 'pointer', opacity: updatingId === item.id ? 0.6 : 1 }}
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => setReportStatus(item.id, 'dismissed')}
                        disabled={updatingId === item.id}
                        style={{ background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '4px 10px', color: theme.textMuted, fontSize: '10px', fontWeight: 600, cursor: 'pointer', opacity: updatingId === item.id ? 0.6 : 1 }}
                      >
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setReportStatus(item.id, 'pending')}
                      disabled={updatingId === item.id}
                      style={{ background: 'rgba(255,200,0,.10)', border: '1px solid rgba(255,200,0,.25)', borderRadius: '8px', padding: '4px 10px', color: '#ffc800', fontSize: '10px', fontWeight: 600, cursor: 'pointer', opacity: updatingId === item.id ? 0.6 : 1 }}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
