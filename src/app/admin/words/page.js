"use client";
import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTheme } from "../../ThemeContext";

const cols = '1.2fr 1fr 0.9fr 1.8fr 0.7fr 0.9fr';

export default function WordsPage() {
  const { theme } = useTheme();

  const [words, setWords] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterMode, setFilterMode] = useState('all');
  const [form, setForm] = useState({ en:'', thai:'', phonetic:'', definition:'', pos:'Noun' });

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'words'), (snapshot) => {
      const nextWords = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          en: data.en || data.english || data.word || 'Unknown',
          thai: data.thai || data.translation || data.thaiTranslation || '',
          phonetic: data.phonetic || data.phonetics || '',
          definition: data.definition || data.description || '',
          pos: data.pos || data.partOfSpeech || 'Noun',
          scanned: Number(data.scanned || data.scanCount || 0),
          broken: Boolean(data.broken),
        };
      });
      setWords(nextWords);
    });

    return unsubscribe;
  }, []);

  const inputStyle = {
    width:'100%', background:theme.bgInput, border:`1px solid ${theme.border}`, borderRadius:'8px',
    padding:'10px 12px', color:theme.text, fontSize:'13px', fontFamily:'inherit', outline:'none',
    boxSizing:'border-box'
  };
  const labelStyle = { color:theme.accent, fontSize:'10px', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'6px', display:'block' };

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleAddWord() {
    if (!db || !form.en.trim() || !form.thai.trim()) return;

    const payload = {
      en: form.en.trim(),
      thai: form.thai.trim(),
      phonetic: form.phonetic.trim(),
      definition: form.definition.trim(),
      pos: form.pos,
      scanned: 0,
      broken: false,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'words'), payload);
    setForm({ en:'', thai:'', phonetic:'', definition:'', pos:'Noun' });
    setShowAddModal(false);
  }

  async function handleDeleteWord(wordId) {
    if (!db || !wordId) return;
    await deleteDoc(doc(db, 'words', wordId));
  }

  const visibleWords = words.filter(w => {
    if (filterMode === 'broken') return !!w.broken;
    if (filterMode === 'ok') return !w.broken;
    return true;
  });

  return (
    <div style={{padding:'24px', position:'relative'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
        <div>
          <div style={{color:theme.textStrong,fontSize:'18px',fontWeight:700}}>Word database</div>
          <div style={{color:theme.textMuted,fontSize:'11px',marginTop:'2px'}}>{words.length} words · synced from Firestore</div>
        </div>
        <div style={{display:'flex',gap:'8px',position:'relative'}}>
          <button onClick={() => setShowFilter(v => !v)} style={{background:theme.bgInput,border:`1px solid ${theme.border}`,borderRadius:'9px',padding:'8px 14px',color:theme.textMuted,fontSize:'12px',cursor:'pointer',fontFamily:'inherit'}}>
            Filter ▾
          </button>
          {showFilter && (
            <div style={{position:'absolute', top:'40px', left:0, zIndex:10, background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:'9px', minWidth:'160px', overflow:'hidden'}}>
              {[{key:'all',label:'All words'},{key:'broken',label:'Needs fixing'},{key:'ok',label:'OK only'}].map(opt => (
                <div key={opt.key} onClick={() => { setFilterMode(opt.key); setShowFilter(false); }}
                  style={{padding:'10px 14px', fontSize:'12px', cursor:'pointer', color: filterMode === opt.key ? theme.accent : theme.textMuted, background: filterMode === opt.key ? theme.accentBg : 'transparent'}}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setShowAddModal(true)} style={{background:theme.accent,border:'none',borderRadius:'9px',padding:'8px 16px',color:theme.bgPage,fontSize:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            + Add word
          </button>
        </div>
      </div>

      <div style={{background:theme.accentBg,border:`1px solid ${theme.accentBorder}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{color:theme.accent,fontSize:'12px'}}>{words.filter(w => w.broken).length} flagged items need review</span>
      </div>

      <div style={{background:theme.bgCard,border:`1px solid ${theme.border}`,borderRadius:'14px',overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:cols,gap:'8px',padding:'10px 16px',background:theme.bgInput}}>
          {['Word (EN)','Thai','Phonetic','Definition','Scanned','Actions'].map(h=>(
            <div key={h} style={{color:theme.textFaint,fontSize:'9px',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</div>
          ))}
        </div>

        {visibleWords.length === 0 ? (
          <div style={{ padding: '28px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
            No word data yet. Add a word or connect Firestore to populate the table.
          </div>
        ) : (
          visibleWords.map((w,i)=>(
            <div key={w.id || `${w.en}-${i}`} style={{display:'grid',gridTemplateColumns:cols,gap:'8px',padding:'11px 16px',borderTop:`1px solid ${theme.border}`,background:w.broken ? `${theme.danger}12` : i%2===1 ? theme.bgInput : 'transparent',alignItems:'center'}}>
              <div>
                <div style={{color:theme.text,fontSize:'12px'}}>{w.en}</div>
                <div style={{color:theme.textMuted,fontSize:'10px'}}>{w.pos || 'Noun'}</div>
              </div>
              <div style={{color:w.broken ? theme.danger : theme.text,fontSize:'12px'}}>{w.thai || '—'}</div>
              <div style={{color:theme.accent,fontSize:'12px'}}>{w.phonetic || '—'}</div>
              <div style={{color:theme.textMuted,fontSize:'11px',lineHeight:1.4}}>{w.definition || 'No definition provided'}</div>
              <div style={{color:w.broken ? theme.text : theme.accent,fontSize:'12px'}}>{Number(w.scanned || 0).toLocaleString()}</div>
              <div style={{display:'flex',gap:'4px'}}>
                <button onClick={() => handleDeleteWord(w.id)} style={{background:theme.bgInput,border:`1px solid ${theme.dangerMuted}`,borderRadius:'6px',padding:'3px 8px',color:theme.danger,fontSize:'10px',cursor:'pointer'}}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
          <div style={{background:theme.bgCard, border:`1px solid ${theme.border}`, borderRadius:'16px', padding:'24px', width:'420px', maxWidth:'90vw'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px'}}>
              <div>
                <div style={{color:theme.textStrong, fontSize:'16px', fontWeight:700}}>Add new word</div>
                <div style={{color:theme.textMuted, fontSize:'11px', marginTop:'2px'}}>Adds a new item to the Firestore word collection</div>
              </div>
              <span onClick={() => setShowAddModal(false)} style={{color:theme.textMuted, cursor:'pointer', fontSize:'16px'}}>✕</span>
            </div>

            <div style={{marginBottom:'14px'}}>
              <label style={labelStyle}>English word</label>
              <input style={inputStyle} value={form.en} onChange={e=>updateForm('en', e.target.value)} placeholder="e.g. Chair" />
            </div>
            <div style={{marginBottom:'14px'}}>
              <label style={labelStyle}>Thai translation</label>
              <input style={inputStyle} value={form.thai} onChange={e=>updateForm('thai', e.target.value)} placeholder="e.g. เก้าอี้" />
            </div>
            <div style={{marginBottom:'14px'}}>
              <label style={labelStyle}>Phonetic</label>
              <input style={inputStyle} value={form.phonetic} onChange={e=>updateForm('phonetic', e.target.value)} placeholder="/tʃɛr/" />
            </div>
            <div style={{marginBottom:'14px'}}>
              <label style={labelStyle}>Definition</label>
              <textarea style={{...inputStyle, minHeight:'70px', resize:'vertical'}} value={form.definition} onChange={e=>updateForm('definition', e.target.value)} placeholder="A piece of furniture used for sitting." />
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={labelStyle}>Part of speech</label>
              <div style={{display:'flex', gap:'8px'}}>
                {['Noun','Verb','Adjective'].map(pos => (
                  <button key={pos} onClick={() => updateForm('pos', pos)}
                    style={{flex:1, padding:'8px 0', borderRadius:'8px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit',
                      border: form.pos === pos ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`,
                      color: form.pos === pos ? theme.accent : theme.textMuted,
                      background: form.pos === pos ? theme.accentBg : theme.bgInput}}>
                    {pos}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={() => setShowAddModal(false)} style={{flex:1, padding:'11px 0', borderRadius:'9px', border:`1px solid ${theme.border}`, background:theme.bgInput, color:theme.textMuted, fontSize:'13px', cursor:'pointer', fontFamily:'inherit'}}>
                Cancel
              </button>
              <button onClick={handleAddWord} style={{flex:1, padding:'11px 0', borderRadius:'9px', border:`1px solid ${theme.accent}`, background:theme.accentBg, color:theme.accent, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                Add word
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}