'use client';

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';
import { useAdminRole } from '../../../lib/useAdminRole';

// Keep in sync with kTopicIcons in lib/topics_data.dart on the Flutter side —
// a topic saved with an icon key not in that map falls back to a generic
// question-mark icon in the app.
const ICON_OPTIONS = [
  { key: 'home_rounded', emoji: '🏠', label: 'Home' },
  { key: 'pets_rounded', emoji: '🐾', label: 'Animals' },
  { key: 'chair_rounded', emoji: '🪑', label: 'Furniture' },
  { key: 'restaurant_rounded', emoji: '🍽️', label: 'Food' },
  { key: 'directions_car_rounded', emoji: '🚗', label: 'Vehicles' },
  { key: 'checkroom_rounded', emoji: '👕', label: 'Clothing' },
  { key: 'kitchen_rounded', emoji: '🍳', label: 'Kitchen' },
  { key: 'bathtub_rounded', emoji: '🛁', label: 'Bathroom' },
  { key: 'school_rounded', emoji: '🎓', label: 'School / Education' },
  { key: 'work_rounded', emoji: '💼', label: 'Jobs / Occupations' },
  { key: 'family_restroom_rounded', emoji: '👪', label: 'Family' },
  { key: 'face_rounded', emoji: '🙂', label: 'Body parts' },
  { key: 'palette_rounded', emoji: '🎨', label: 'Colors' },
  { key: 'emoji_emotions_rounded', emoji: '😊', label: 'Emotions' },
  { key: 'wb_sunny_rounded', emoji: '☀️', label: 'Weather' },
  { key: 'park_rounded', emoji: '🌳', label: 'Nature / Outdoors' },
  { key: 'sports_soccer_rounded', emoji: '⚽', label: 'Sports' },
  { key: 'devices_rounded', emoji: '💻', label: 'Electronics' },
  { key: 'shopping_bag_rounded', emoji: '🛍️', label: 'Shopping' },
  { key: 'location_city_rounded', emoji: '🏙️', label: 'Places / City' },
];

const iconEmoji = (key) => ICON_OPTIONS.find((o) => o.key === key)?.emoji || '❔';

const slugify = (value) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Drafts live in their own collection so the app (which reads `topics`) never sees them.
// A draft whose id matches a published topic holds unpublished changes to that topic.
const DRAFTS = 'topic_drafts';

const emptyForm = {
  name: '',
  icon: ICON_OPTIONS[0].key,
  color: '#00C4C4',
  posX: '0.5',
  posY: '0.5',
  order: '0',
  isPremium: false,
  words: [{ word: '', translation: '' }],
};

export default function TopicsPage() {
  const { theme } = useTheme();
  const { isModerator } = useAdminRole();

  const [topics, setTopics] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewId, setPreviewId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!db) return undefined;

    const unsubscribeTopics = onSnapshot(
      query(collection(db, 'topics'), orderBy('order', 'asc')),
      (snapshot) => {
        setTopics(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setLoadError('');
      },
      (error) => setLoadError(`Unable to load topics: ${error.message}`),
    );

    const unsubscribeDrafts = onSnapshot(
      query(collection(db, DRAFTS), orderBy('order', 'asc')),
      (snapshot) => setDrafts(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
      (error) => setLoadError(`Unable to load drafts: ${error.message}`),
    );

    return () => {
      unsubscribeTopics();
      unsubscribeDrafts();
    };
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setWord = (index, field, value) => {
    setForm((p) => {
      const words = [...p.words];
      words[index] = { ...words[index], [field]: value };
      return { ...p, words };
    });
  };

  const addWordRow = () => setForm((p) => ({ ...p, words: [...p.words, { word: '', translation: '' }] }));

  const removeWordRow = (index) => setForm((p) => ({ ...p, words: p.words.filter((_, i) => i !== index) }));

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  // For a published topic with pending changes, edit the draft rather than the live version.
  const startEdit = (item) => {
    const topic = item.draft || item;
    setEditingId(item.id);
    setForm({
      name: topic.name || '',
      icon: topic.icon || ICON_OPTIONS[0].key,
      color: topic.color || '#00C4C4',
      posX: String(topic.pos_x ?? 0.5),
      posY: String(topic.pos_y ?? 0.5),
      order: String(topic.order ?? 0),
      isPremium: !!topic.is_premium,
      words: topic.words?.length ? topic.words.map((w) => ({ word: w.word || '', translation: w.translation || '' })) : [{ word: '', translation: '' }],
    });
    setFormError('');
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  };

  const publishedIds = new Set(topics.map((t) => t.id));
  const draftsById = Object.fromEntries(drafts.map((d) => [d.id, d]));

  // Strip admin-only and UI-only fields so they never reach the stored doc.
  const toPublished = ({ id, updated_at, isPublished, draft, ...data }) => data;

  const handleSave = async (mode) => {
    if (!db || !form.name.trim()) {
      setFormError('Topic name is required.');
      return;
    }

    const words = form.words
      .map((w) => ({ word: w.word.trim(), translation: w.translation.trim() }))
      .filter((w) => w.word);

    if (words.length === 0) {
      setFormError('Add at least one word.');
      return;
    }

    if (mode === 'publish' && !window.confirm(`Publish "${form.name.trim()}"? It will appear in the app immediately.`)) return;

    setSaving(mode);
    setFormError('');

    try {
      const payload = {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        pos_x: Number(form.posX) || 0,
        pos_y: Number(form.posY) || 0,
        order: Number(form.order) || 0,
        is_premium: form.isPremium,
        words,
      };

      let topicId = editingId;
      if (!topicId) {
        topicId = slugify(form.name);
        if (!topicId) throw new Error('Topic name must contain letters or numbers.');
        if (publishedIds.has(topicId) || draftsById[topicId]) {
          topicId = `${topicId}_${Date.now().toString(36)}`;
        }
      }

      if (mode === 'publish') {
        const batch = writeBatch(db);
        batch.set(doc(db, 'topics', topicId), payload, { merge: true });
        batch.delete(doc(db, DRAFTS, topicId));
        await batch.commit();
      } else {
        await setDoc(doc(db, DRAFTS, topicId), { ...payload, updated_at: serverTimestamp() });
      }

      cancelForm();
    } catch (error) {
      setFormError(error.message || 'Unable to save topic.');
    } finally {
      setSaving(null);
    }
  };

  const handlePublish = async (item) => {
    if (!db || !item.draft) return;
    const label = item.isPublished ? `Publish changes to "${item.draft.name}"?` : `Publish "${item.draft.name}"?`;
    if (!window.confirm(`${label} It will appear in the app immediately.`)) return;
    const batch = writeBatch(db);
    batch.set(doc(db, 'topics', item.id), toPublished(item.draft), { merge: true });
    batch.delete(doc(db, DRAFTS, item.id));
    await batch.commit();
  };

  const handleUnpublish = async (item) => {
    if (!db) return;
    if (!window.confirm(`Unpublish "${item.name}"? It will be removed from the app and kept as a draft.`)) return;
    const batch = writeBatch(db);
    // Keep any pending changes; otherwise the live version becomes the draft.
    if (!item.draft) batch.set(doc(db, DRAFTS, item.id), { ...toPublished(item), updated_at: serverTimestamp() });
    batch.delete(doc(db, 'topics', item.id));
    await batch.commit();
  };

  const handleDiscardDraft = async (item) => {
    if (!db) return;
    if (!window.confirm(`Discard unpublished changes to "${item.name}"? The live version stays as it is.`)) return;
    await deleteDoc(doc(db, DRAFTS, item.id));
  };

  const handleDelete = async (item) => {
    if (!db) return;
    const message = item.isPublished
      ? `Delete "${item.name}"? This removes it from the app immediately.`
      : `Delete draft "${item.draft.name}"?`;
    if (!window.confirm(message)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'topics', item.id));
    batch.delete(doc(db, DRAFTS, item.id));
    await batch.commit();
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

  // One row per topic id. `draft` is the unpublished version (a new topic, or pending changes to a live one).
  const items = [
    ...topics.map((t) => ({ ...t, isPublished: true, draft: draftsById[t.id] || null })),
    ...drafts.filter((d) => !publishedIds.has(d.id)).map((d) => ({ ...d, isPublished: false, draft: d })),
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const searchQuery = search.trim().toLowerCase();
  const filteredTopics = items.filter((item) => {
    if (statusFilter === 'published' && !item.isPublished) return false;
    if (statusFilter === 'drafts' && !item.draft) return false;
    const name = (item.draft || item).name || '';
    return !searchQuery || name.toLowerCase().includes(searchQuery);
  });

  const draftCount = drafts.length;

  const smallButton = (color, border, background) => ({
    padding: '6px 12px', borderRadius: '7px', border: `1px solid ${border}`, background, color, fontSize: '11px', cursor: 'pointer',
  });
  const badge = (color, background, border) => ({
    background, color, border: `1px solid ${border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 600,
  });

  const labelStyle = {
    color: theme.textMuted,
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: '6px',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '840px', color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>Topics</div>
          <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '3px' }}>
            Manage the vocabulary topics shown in the app&apos;s Topics screen
          </div>
        </div>

        {isModerator && !showForm && (
          <button
            onClick={startCreate}
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
            + New topic
          </button>
        )}
      </div>

      {loadError && (
        <div style={{ background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.25)', borderRadius: '10px', padding: '10px 14px', color: theme.danger, fontSize: '12px', marginBottom: '16px' }}>
          {loadError}
        </div>
      )}

      <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ color: theme.textMuted }}>⌕</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topics…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: theme.text, fontSize: '13px', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          ['all', 'All'],
          ['published', 'Published'],
          ['drafts', `Drafts${draftCount ? ` (${draftCount})` : ''}`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: `1px solid ${statusFilter === key ? theme.accentBorder : theme.border}`,
              background: statusFilter === key ? theme.accentBg : 'transparent',
              color: statusFilter === key ? theme.accent : theme.textMuted,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.accentBorder}`, borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ color: theme.accent, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '14px' }}>
            {editingId ? (publishedIds.has(editingId) ? 'Edit topic — live in app' : 'Edit draft') : 'New topic'}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={labelStyle}>Name</div>
            <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Colors" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={labelStyle}>Icon</div>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.icon} onChange={(e) => set('icon', e.target.value)}>
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.emoji} {opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Color</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#00C4C4'}
                  onChange={(e) => set('color', e.target.value)}
                  style={{ width: '38px', height: '36px', border: `1px solid ${theme.border}`, borderRadius: '8px', background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <input style={inputStyle} value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="#00C4C4" />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={labelStyle}>Map X (0–1)</div>
              <input type="number" min="0" max="1" step="0.01" style={inputStyle} value={form.posX} onChange={(e) => set('posX', e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Map Y (0–1)</div>
              <input type="number" min="0" max="1" step="0.01" style={inputStyle} value={form.posY} onChange={(e) => set('posY', e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Order</div>
              <input type="number" style={inputStyle} value={form.order} onChange={(e) => set('order', e.target.value)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer', color: theme.text, fontSize: '13px' }}>
            <input type="checkbox" checked={form.isPremium} onChange={(e) => set('isPremium', e.target.checked)} />
            Premium topic (locked for free users)
          </label>

          <div style={{ marginBottom: '10px' }}>
            <div style={labelStyle}>Words</div>

            {form.words.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input style={inputStyle} value={w.word} onChange={(e) => setWord(i, 'word', e.target.value)} placeholder="Word (English)" />
                <input style={inputStyle} value={w.translation} onChange={(e) => setWord(i, 'translation', e.target.value)} placeholder="Translation" />
                <button
                  onClick={() => removeWordRow(i)}
                  disabled={form.words.length === 1}
                  style={{
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    background: 'transparent',
                    color: theme.textMuted,
                    cursor: form.words.length === 1 ? 'not-allowed' : 'pointer',
                    opacity: form.words.length === 1 ? 0.4 : 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              onClick={addWordRow}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: 'transparent',
                color: theme.textMuted,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              + Add word
            </button>
          </div>

          {formError && <div style={{ color: theme.danger, fontSize: '11px', marginBottom: '12px' }}>{formError}</div>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              onClick={cancelForm}
              style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>

            <button
              onClick={() => handleSave('draft')}
              disabled={!!saving}
              style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving === 'draft' ? 'Saving…' : 'Save as draft'}
            </button>

            <button
              onClick={() => handleSave('publish')}
              disabled={!!saving}
              style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          </div>

          <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '10px' }}>
            Drafts are only visible here in the admin panel. {editingId && publishedIds.has(editingId) ? 'The live version stays unchanged until you publish.' : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredTopics.length === 0 ? (
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '24px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
            {items.length === 0 ? 'No topics yet. Add one to publish it to the app.' : 'No topics match your filters.'}
          </div>
        ) : (
          filteredTopics.map((item) => {
            // Show the version that would be published next: the draft if there is one, otherwise the live topic.
            const topic = item.draft || item;
            const previewing = previewId === item.id;
            return (
            <div key={item.id} style={{ background: theme.bgCard, border: `1px ${item.isPublished ? 'solid' : 'dashed'} ${item.draft ? theme.accentBorder : theme.border}`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: `${topic.color || '#00C4C4'}22`,
                      border: `1px solid ${topic.color || '#00C4C4'}55`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}
                  >
                    {iconEmoji(topic.icon)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ color: theme.textStrong, fontSize: '14px', fontWeight: 600 }}>{topic.name}</div>
                      {topic.is_premium && (
                        <span style={badge('#f59e0b', 'rgba(255,193,7,.12)', 'rgba(255,193,7,.25)')}>
                          PREMIUM
                        </span>
                      )}
                      {!item.isPublished && (
                        <span style={badge(theme.textMuted, 'transparent', theme.border)}>DRAFT</span>
                      )}
                      {item.isPublished && item.draft && (
                        <span style={badge(theme.accent, theme.accentBg, theme.accentBorder)}>UNPUBLISHED CHANGES</span>
                      )}
                    </div>

                    <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                      {(topic.words?.length || 0)} word{(topic.words?.length || 0) === 1 ? '' : 's'} · order {topic.order ?? 0}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => setPreviewId(previewing ? null : item.id)} style={smallButton(theme.textMuted, theme.border, 'transparent')}>
                    {previewing ? 'Hide preview' : 'Preview'}
                  </button>

                  {isModerator && (
                    <>
                      {item.draft && (
                        <button onClick={() => handlePublish(item)} style={{ ...smallButton(theme.accent, theme.accentBorder, theme.accentBg), fontWeight: 600 }}>
                          {item.isPublished ? 'Publish changes' : 'Publish'}
                        </button>
                      )}

                      <button onClick={() => startEdit(item)} style={smallButton(theme.accent, theme.accentBorder, theme.accentBg)}>
                        Edit
                      </button>

                      {item.isPublished && item.draft && (
                        <button onClick={() => handleDiscardDraft(item)} style={smallButton(theme.textMuted, theme.border, 'transparent')}>
                          Discard changes
                        </button>
                      )}

                      {item.isPublished && (
                        <button onClick={() => handleUnpublish(item)} style={smallButton(theme.textMuted, theme.border, 'transparent')}>
                          Unpublish
                        </button>
                      )}

                      <button onClick={() => handleDelete(item)} style={smallButton(theme.danger, theme.dangerMuted, 'rgba(255,76,76,.06)')}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {previewing && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ ...labelStyle, marginBottom: '10px' }}>
                    {item.draft ? 'Draft preview — not visible in the app' : 'Live in app'}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: theme.textMuted, fontSize: '11px', marginBottom: '12px' }}>
                    <span>Icon: {iconEmoji(topic.icon)} {topic.icon}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Color:
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: topic.color || '#00C4C4', display: 'inline-block' }} />
                      {topic.color}
                    </span>
                    <span>Map: ({topic.pos_x ?? 0}, {topic.pos_y ?? 0})</span>
                    <span>{topic.is_premium ? 'Premium' : 'Free'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                    {(topic.words || []).map((w, i) => (
                      <div key={i} style={{ background: theme.bgInput, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '7px 10px', fontSize: '12px' }}>
                        <div style={{ color: theme.textStrong, fontWeight: 600 }}>{w.word}</div>
                        <div style={{ color: theme.textMuted }}>{w.translation || '—'}</div>
                      </div>
                    ))}
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
