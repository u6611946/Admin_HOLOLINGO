'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';
import { useAdminRole } from '../../../lib/useAdminRole';

const statusStyle = {
  active: {
    bg: 'rgba(74,222,128,.12)',
    color: '#4ade80',
    border: 'rgba(74,222,128,.25)',
  },
  scheduled: {
    bg: 'rgba(0,229,255,.10)',
    color: '#00e5ff',
    border: 'rgba(0,229,255,.25)',
  },
  draft: {
    bg: 'rgba(100,116,139,.12)',
    color: '#64748b',
    border: 'rgba(100,116,139,.25)',
  },
  expired: {
    bg: 'rgba(248,113,113,.10)',
    color: '#f87171',
    border: 'rgba(248,113,113,.25)',
  },
};

const eventStatusStyle = {
  upcoming: { bg: 'rgba(0,229,255,.10)', color: '#00e5ff', border: 'rgba(0,229,255,.25)' },
  active: { bg: 'rgba(74,222,128,.12)', color: '#4ade80', border: 'rgba(74,222,128,.25)' },
  ended: { bg: 'rgba(100,116,139,.12)', color: '#64748b', border: 'rgba(100,116,139,.25)' },
};

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date) => date
  ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

const slugify = (value) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// One "word: definition" per line -> [{ word, definition }, ...], for the
// event's theme vocabulary that Coin Battle mixes into its questions.
const parseThemeWords = (text) => text
  .split('\n')
  .map((line) => {
    const [word, ...rest] = line.split(':');
    return { word: (word || '').trim(), definition: rest.join(':').trim() };
  })
  .filter((entry) => entry.word && entry.definition);

export default function AnnouncementsPage() {
  const { theme } = useTheme();
  const { isModerator } = useAdminRole();

  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    target: 'All users',
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);

  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ name: '', description: '', theme: '', startAt: '', endAt: '', rewardXp: '', rewardTokens: '', targetCount: '', themeWords: '' });
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventFormError, setEventFormError] = useState('');

  const [dailyWordsEventId, setDailyWordsEventId] = useState(null);
  const [dailyWordsText, setDailyWordsText] = useState('');
  const [savingDailyWords, setSavingDailyWords] = useState(false);
  const [dailyWordsError, setDailyWordsError] = useState('');
  const [dailyWordsSaved, setDailyWordsSaved] = useState(false);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const nextAnnouncements = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      setAnnouncements(nextAnnouncements);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const nextEvents = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      setEvents(nextEvents);
      setEventsError('');
    }, (error) => {
      setEventsError(`Unable to load events: ${error.message}`);
    });

    return unsubscribe;
  }, []);

  const now = new Date();
  const eventList = events.map((event) => {
    const startAt = asDate(event.start_at);
    const endAt = asDate(event.end_at);
    const status = endAt && now > endAt ? 'ended' : startAt && now < startAt ? 'upcoming' : 'active';
    return { ...event, startAt, endAt, status };
  }).sort((a, b) => (b.startAt?.getTime() || 0) - (a.startAt?.getTime() || 0));

  const set = (k, v) => {
    setForm((p) => ({
      ...p,
      [k]: v,
    }));
  };

  const handleCreate = async () => {
    if (!db || !form.title.trim() || !form.body.trim()) return;

    setSaving(true);

    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        target: form.target,
        status: form.status,
        created: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'announcements'), payload);

      setForm({
        title: '',
        body: '',
        target: 'All users',
        status: 'draft',
      });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id) => {
    if (!db || !id) return;

    const current = announcements.find((item) => item.id === id);
    if (!current) return;

    await updateDoc(doc(db, 'announcements', id), {
      status: current.status === 'active' ? 'draft' : 'active',
    });
  };

  const deleteAnn = async (id) => {
    if (!db || !id) return;
    await deleteDoc(doc(db, 'announcements', id));
  };

  const handleCreateEvent = async () => {
    if (!db || !eventForm.name.trim() || !eventForm.startAt || !eventForm.endAt) return;

    setSavingEvent(true);
    setEventFormError('');

    try {
      let eventId = slugify(eventForm.name);
      if (!eventId) throw new Error('Event name must contain letters or numbers.');
      if (events.some((event) => event.id === eventId)) {
        eventId = `${eventId}_${Date.now().toString(36)}`;
      }

      await setDoc(doc(db, 'events', eventId), {
        name: eventForm.name.trim(),
        description: eventForm.description.trim(),
        theme: eventForm.theme.trim(),
        start_at: new Date(eventForm.startAt),
        end_at: new Date(eventForm.endAt),
        reward_xp: Number(eventForm.rewardXp) || 0,
        reward_tokens: Number(eventForm.rewardTokens) || 0,
        target_count: Number(eventForm.targetCount) || 0,
        theme_words: parseThemeWords(eventForm.themeWords),
      });

      setEventForm({ name: '', description: '', theme: '', startAt: '', endAt: '', rewardXp: '', rewardTokens: '', targetCount: '', themeWords: '' });
      setShowEventForm(false);
    } catch (error) {
      setEventFormError(error.message || 'Unable to create event.');
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!db || !id) return;
    await deleteDoc(doc(db, 'events', id));
  };

  // Matches DailyBattleService.todayKey() in the app — UTC calendar day.
  const todayKeyUtc = () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const shuffle = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const openDailyWordsEditor = (eventId) => {
    setDailyWordsEventId(eventId);
    setDailyWordsText('');
    setDailyWordsError('');
    setDailyWordsSaved(false);
  };

  const handleSaveDailyWords = async () => {
    if (!db || !dailyWordsEventId) return;

    const lines = dailyWordsText.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length !== 10) {
      setDailyWordsError(`Need exactly 10 lines, got ${lines.length}.`);
      return;
    }

    const parsed = [];
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length !== 5 || parts.some((p) => !p)) {
        setDailyWordsError(`Each line needs 5 parts separated by "|": ${line}`);
        return;
      }
      const [thai, correct, wrong1, wrong2, wrong3] = parts;
      const options = shuffle([correct, wrong1, wrong2, wrong3]);
      parsed.push({ thai, options, correct_index: options.indexOf(correct) });
    }

    setSavingDailyWords(true);
    setDailyWordsError('');

    try {
      const date = todayKeyUtc();
      await Promise.all(
        parsed.map((word, index) =>
          setDoc(doc(db, 'events', dailyWordsEventId, 'daily_challenges', date, 'words', String(index)), word),
        ),
      );
      setDailyWordsSaved(true);
      setTimeout(() => setDailyWordsSaved(false), 1500);
    } catch (error) {
      setDailyWordsError(error.message || 'Unable to save today’s words.');
    } finally {
      setSavingDailyWords(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    padding: '9px 12px',
    color: theme.text,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        padding: '24px',
        color: theme.text,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <div
            style={{
              color: theme.textStrong,
              fontSize: '20px',
              fontWeight: 700,
            }}
          >
            Announcement status
          </div>

          <div
            style={{
              color: theme.textMuted,
              fontSize: '12px',
              marginTop: '3px',
            }}
          >
            Manage in-app announcements
          </div>
        </div>

        {isModerator && (
          <button
            onClick={() => setShowForm((p) => !p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              border: `1px solid ${theme.accentBorder}`,
              background: theme.accentBg,
              color: theme.accent,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New announcement
          </button>
        )}
      </div>

      {showForm && (
        <div
          style={{
            background: theme.bgCard,
            border: `1px solid ${theme.accentBorder}`,
            borderRadius: '14px',
            padding: '18px',
            marginBottom: '20px',
            maxWidth: '640px',
          }}
        >
          <div
            style={{
              color: theme.accent,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: '14px',
            }}
          >
            New announcement
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: theme.textMuted,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                marginBottom: '6px',
              }}
            >
              Title
            </div>

            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Announcement title"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: theme.textMuted,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                marginBottom: '6px',
              }}
            >
              Message
            </div>

            <textarea
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder="Announcement message…"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  marginBottom: '6px',
                }}
              >
                Target
              </div>

              <select
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                }}
                value={form.target}
                onChange={(e) => set('target', e.target.value)}
              >
                {['All users', 'Free users', 'Premium users', 'New users'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  marginBottom: '6px',
                }}
              >
                Status
              </div>

              <select
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                }}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {['draft', 'active', 'scheduled'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
            }}
          >
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: 'transparent',
                color: theme.textMuted,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                flex: 2,
                padding: '9px',
                borderRadius: '8px',
                border: `1px solid ${theme.accentBorder}`,
                background: theme.accentBg,
                color: theme.accent,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Creating…' : 'Create announcement'}
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '10px',
        }}
      >
        {announcements.length === 0 ? (
          <div
            style={{
              background: theme.bgCard,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '24px 16px',
              color: theme.textMuted,
              fontSize: '12px',
              textAlign: 'center',
              gridColumn: '1 / -1',
            }}
          >
            No announcements yet. Add one to start syncing with Firestore.
          </div>
        ) : (
          announcements.map((a) => {
            const st = statusStyle[a.status] || statusStyle.draft;

            return (
              <div
                key={a.id}
                style={{
                  background: theme.bgCard,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                      }}
                    >
                      <div
                        style={{
                          color: theme.textStrong,
                          fontSize: '14px',
                          fontWeight: 600,
                        }}
                      >
                        {a.title}
                      </div>

                      <span
                        style={{
                          background: st.bg,
                          color: st.color,
                          border: `1px solid ${st.border}`,
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {a.status}
                      </span>
                    </div>

                    <div
                      style={{
                        color: theme.textMuted,
                        fontSize: '12px',
                        marginBottom: '8px',
                      }}
                    >
                      {a.body}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                      }}
                    >
                      <span
                        style={{
                          color: theme.textMuted,
                          fontSize: '11px',
                        }}
                      >
                        ◉ {a.target}
                      </span>

                      <span
                        style={{
                          color: theme.textMuted,
                          fontSize: '11px',
                        }}
                      >
                        ▦ {a.created || 'Today'}
                      </span>
                    </div>
                  </div>

                  {isModerator && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() => toggleStatus(a.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          border: `1px solid ${theme.accentBorder}`,
                          background: theme.accentBg,
                          color: theme.accent,
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        {a.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => deleteAnn(a.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          border: `1px solid ${theme.dangerMuted}`,
                          background: 'rgba(255,76,76,.06)',
                          color: theme.danger,
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '32px', marginBottom: '16px' }}>
        <div>
          <div style={{ color: theme.textStrong, fontSize: '16px', fontWeight: 700 }}>Events</div>
          <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '3px' }}>Live campaigns from the events collection</div>
        </div>

        {isModerator && (
          <button
            onClick={() => { setEventFormError(''); setShowEventForm((p) => !p); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            + New event
          </button>
        )}
      </div>

      {showEventForm && (
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.accentBorder}`, borderRadius: '14px', padding: '18px', marginBottom: '20px', maxWidth: '640px' }}>
          <div style={{ color: theme.accent, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '14px' }}>New event</div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Name</div>
            <input style={inputStyle} value={eventForm.name} onChange={(e) => setEventForm((p) => ({ ...p, name: e.target.value }))} placeholder="Brew The Words" />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Description</div>
            <textarea rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} value={eventForm.description} onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))} placeholder="Brew a spooky vocabulary potion…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Start date</div>
              <input type="date" style={inputStyle} value={eventForm.startAt} onChange={(e) => setEventForm((p) => ({ ...p, startAt: e.target.value }))} />
            </div>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>End date</div>
              <input type="date" style={inputStyle} value={eventForm.endAt} onChange={(e) => setEventForm((p) => ({ ...p, endAt: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Theme</div>
              <input style={inputStyle} value={eventForm.theme} onChange={(e) => setEventForm((p) => ({ ...p, theme: e.target.value }))} placeholder="halloween" />
            </div>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Targets</div>
              <input type="number" min="0" style={inputStyle} value={eventForm.targetCount} onChange={(e) => setEventForm((p) => ({ ...p, targetCount: e.target.value }))} placeholder="8" />
            </div>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Reward XP</div>
              <input type="number" min="0" style={inputStyle} value={eventForm.rewardXp} onChange={(e) => setEventForm((p) => ({ ...p, rewardXp: e.target.value }))} placeholder="250" />
            </div>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Reward tokens</div>
              <input type="number" min="0" style={inputStyle} value={eventForm.rewardTokens} onChange={(e) => setEventForm((p) => ({ ...p, rewardTokens: e.target.value }))} placeholder="50" />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
              Theme words (Coin Battle) — one per line, &ldquo;word: definition&rdquo;
            </div>
            <textarea
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              value={eventForm.themeWords}
              onChange={(e) => setEventForm((p) => ({ ...p, themeWords: e.target.value }))}
              placeholder={'Snowman: A figure made of packed snow\nOrnament: A decoration hung on a tree\nSleigh: A vehicle pulled over snow'}
            />
            <div style={{ color: theme.textMuted, fontSize: '10px', marginTop: '4px' }}>
              Mixed into players&apos; own saved words when they battle during this event — optional, leave blank for none.
            </div>
          </div>

          {eventFormError && <div style={{ color: theme.danger, fontSize: '11px', marginBottom: '12px' }}>{eventFormError}</div>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowEventForm(false)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreateEvent} disabled={savingEvent} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: savingEvent ? 0.7 : 1 }}>
              {savingEvent ? 'Creating…' : 'Create event'}
            </button>
          </div>
        </div>
      )}

      {eventsError && (
        <div style={{ background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.25)', borderRadius: '10px', padding: '10px 14px', color: theme.danger, fontSize: '12px', marginBottom: '16px' }}>{eventsError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '10px' }}>
        {eventList.length === 0 ? (
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '24px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center', gridColumn: '1 / -1' }}>
            No events yet.
          </div>
        ) : (
          eventList.map((event) => {
            const st = eventStatusStyle[event.status] || eventStatusStyle.upcoming;
            return (
              <div key={event.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ color: theme.textStrong, fontSize: '14px', fontWeight: 600 }}>{event.name || event.id}</div>
                      <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{event.status}</span>
                      {event.theme && (
                        <span style={{ background: theme.bgInput, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '10px', textTransform: 'capitalize' }}>{event.theme}</span>
                      )}
                    </div>

                    {event.description && (
                      <div style={{ color: theme.textMuted, fontSize: '12px', marginBottom: '8px' }}>{event.description}</div>
                    )}

                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ color: theme.textMuted, fontSize: '11px' }}>▦ {formatDate(event.startAt)} – {formatDate(event.endAt)}</span>
                      {typeof event.target_count === 'number' && (
                        <span style={{ color: theme.textMuted, fontSize: '11px' }}>◎ {event.target_count} targets</span>
                      )}
                      {typeof event.reward_xp === 'number' && (
                        <span style={{ color: theme.textMuted, fontSize: '11px' }}>✦ {event.reward_xp} XP</span>
                      )}
                      {typeof event.reward_tokens === 'number' && (
                        <span style={{ color: theme.textMuted, fontSize: '11px' }}>◆ {event.reward_tokens} tokens</span>
                      )}
                    </div>
                  </div>

                  {isModerator && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => openDailyWordsEditor(event.id)}
                        style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.accent, fontSize: '11px', cursor: 'pointer' }}
                      >
                        Today&apos;s words
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${theme.dangerMuted}`, background: 'rgba(255,76,76,.06)', color: theme.danger, fontSize: '11px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {dailyWordsEventId === event.id && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${theme.border}` }}>
                    <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>
                      Daily Challenge — 10 lines, &ldquo;thai|correct|wrong1|wrong2|wrong3&rdquo; (sets today&apos;s, {todayKeyUtc()})
                    </div>
                    <textarea
                      rows={10}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                      value={dailyWordsText}
                      onChange={(e) => setDailyWordsText(e.target.value)}
                      placeholder={'แมว|Cat|Dog|Bird|Fish\nสุนัข|Dog|Cat|Horse|Cow\n… (10 lines total)'}
                    />
                    {dailyWordsError && (
                      <div style={{ color: theme.danger, fontSize: '11px', marginTop: '8px' }}>{dailyWordsError}</div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        onClick={() => setDailyWordsEventId(null)}
                        style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Close
                      </button>
                      <button
                        onClick={handleSaveDailyWords}
                        disabled={savingDailyWords}
                        style={{ flex: 2, padding: '9px', borderRadius: '8px', border: `1px solid ${dailyWordsSaved ? 'rgba(74,222,128,.35)' : theme.accentBorder}`, background: dailyWordsSaved ? 'rgba(74,222,128,.1)' : theme.accentBg, color: dailyWordsSaved ? '#4ade80' : theme.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: savingDailyWords ? 0.7 : 1 }}
                      >
                        {savingDailyWords ? 'Saving…' : dailyWordsSaved ? '✓ Saved' : "Save today's words"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}