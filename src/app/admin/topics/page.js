'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
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
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!db) return undefined;

    const unsubscribe = onSnapshot(
      query(collection(db, 'topics'), orderBy('order', 'asc')),
      (snapshot) => {
        setTopics(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setLoadError('');
      },
      (error) => setLoadError(`Unable to load topics: ${error.message}`),
    );

    return unsubscribe;
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

  const startEdit = (topic) => {
    setEditingId(topic.id);
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

  const handleSave = async () => {
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

    setSaving(true);
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

      if (editingId) {
        await updateDoc(doc(db, 'topics', editingId), payload);
      } else {
        let topicId = slugify(form.name);
        if (!topicId) throw new Error('Topic name must contain letters or numbers.');
        if (topics.some((t) => t.id === topicId)) {
          topicId = `${topicId}_${Date.now().toString(36)}`;
        }
        await setDoc(doc(db, 'topics', topicId), payload);
      }

      cancelForm();
    } catch (error) {
      setFormError(error.message || 'Unable to save topic.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (topic) => {
    if (!db) return;
    if (!window.confirm(`Delete "${topic.name}"? This removes it from the app immediately.`)) return;
    await deleteDoc(doc(db, 'topics', topic.id));
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

  const searchQuery = search.trim().toLowerCase();
  const filteredTopics = searchQuery ? topics.filter((topic) => (topic.name || '').toLowerCase().includes(searchQuery)) : topics;

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

      {showForm && (
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.accentBorder}`, borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ color: theme.accent, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '14px' }}>
            {editingId ? 'Edit topic' : 'New topic'}
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
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 2, padding: '9px', borderRadius: '8px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create topic'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredTopics.length === 0 ? (
          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '24px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
            {topics.length === 0 ? 'No topics yet. Add one to publish it to the app.' : 'No topics match your search.'}
          </div>
        ) : (
          filteredTopics.map((topic) => (
            <div key={topic.id} style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '14px 16px' }}>
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
                        <span style={{ background: 'rgba(255,193,7,.12)', color: '#f59e0b', border: '1px solid rgba(255,193,7,.25)', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 600 }}>
                          PREMIUM
                        </span>
                      )}
                    </div>

                    <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                      {(topic.words?.length || 0)} word{(topic.words?.length || 0) === 1 ? '' : 's'} · order {topic.order ?? 0}
                    </div>
                  </div>
                </div>

                {isModerator && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(topic)}
                      style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.accent, fontSize: '11px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(topic)}
                      style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${theme.dangerMuted}`, background: 'rgba(255,76,76,.06)', color: theme.danger, fontSize: '11px', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
