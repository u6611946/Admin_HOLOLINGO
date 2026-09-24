'use client';
import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useTheme } from '../../ThemeContext';

const plans = [
  { id: 'free', name: 'Free', price: '฿0', period: 'forever', accentKey: 'free', features: ['Free topics only', 'Limited topic library'] },
  { id: 'premium', name: 'Premium', price: '฿99', period: 'per month', accentKey: 'premium', features: ['Unlock all topic packages', 'New topics as they release', 'Full topic library access'] },
  { id: 'annual', name: 'Annual', price: '฿990', period: 'per year', accentKey: 'annual', features: ['Everything in Premium', 'Save ~17% vs monthly', 'Full topic library access'] },
];

const tokenPackages = [
  { id: 'starter', name: 'Starter', tokens: 100, price: '฿20', bonus: null },
  { id: 'popular', name: 'Popular', tokens: 550, price: '฿100', bonus: '+50 bonus', highlight: true },
  { id: 'best-value', name: 'Best Value', tokens: 1300, price: '฿200', bonus: '+300 bonus' },
];

export default function SubscriptionPage() {
  const { theme } = useTheme();

  const planColor = { free: theme.textMuted, premium: theme.accent, annual: '#a78bfa' };
  const statusStyle = {
    active: { color: '#4ade80', bg: 'rgba(74,222,128,.1)', border: 'rgba(74,222,128,.2)' },
    expired: { color: theme.danger, bg: theme.dangerMuted + '22', border: theme.dangerMuted },
    cancelled: { color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
  };

  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subs, setSubs] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [showPurchaseFilter, setShowPurchaseFilter] = useState(false);
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState('all');
  const [purchasePackageFilter, setPurchasePackageFilter] = useState('all');

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      const nextSubs = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      setSubs(nextSubs);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!db) {
      return undefined;
    }

    const unsubscribe = onSnapshot(collection(db, 'purchases'), (snapshot) => {
      const nextPurchases = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      setPurchases(nextPurchases);
    });

    return unsubscribe;
  }, []);

  const packageNameFor = (p) => {
    if (p.type === 'token_package') {
      const pkg = tokenPackages.find((t) => t.id === p.packageId);
      return pkg ? `${pkg.name} (${pkg.tokens.toLocaleString()} tokens)` : (p.packageId || '—');
    }
    const plan = plans.find((pl) => pl.id === p.packageId);
    return plan ? plan.name : (p.packageId || '—');
  };

  const filteredSubs = useMemo(() => {
    return subs.filter((s) => {
      const user = (s.user || s.name || s.email || '').toLowerCase();
      const matchesSearch = user.includes(search.trim().toLowerCase());
      const matchesPlan = planFilter === 'all' || (s.plan || '').toLowerCase() === planFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || (s.status || '').toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [subs, search, planFilter, statusFilter]);

  const activeFilterCount = (planFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const purchasePackageOptions = [
    ...plans.filter((p) => p.id !== 'free').map((p) => ({ id: p.id, name: p.name })),
    ...tokenPackages.map((t) => ({ id: t.id, name: t.name })),
  ];

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const user = (p.user || p.name || p.email || '').toLowerCase();
      const matchesSearch = user.includes(purchaseSearch.trim().toLowerCase());
      const matchesType = purchaseTypeFilter === 'all' || p.type === purchaseTypeFilter;
      const matchesPackage = purchasePackageFilter === 'all' || p.packageId === purchasePackageFilter;
      return matchesSearch && matchesType && matchesPackage;
    });
  }, [purchases, purchaseSearch, purchaseTypeFilter, purchasePackageFilter]);

  const activePurchaseFilterCount = (purchaseTypeFilter !== 'all' ? 1 : 0) + (purchasePackageFilter !== 'all' ? 1 : 0);

  const planUserCount = (planId) => subs.filter((s) => (s.plan || '').toLowerCase() === planId).length;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyRevenue = purchases
    .filter((p) => (p.purchasedAt || '').startsWith(monthKey))
    .reduce((sum, p) => sum + (Number(p.amountBaht) || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: theme.textStrong, fontSize: '20px', fontWeight: 700 }}>Subscription</div>
        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '3px' }}>Manage plans and subscriber details</div>
      </div>

      <div style={{ display: 'flex', gap: '4px', background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '4px', marginBottom: '24px', width: 'fit-content' }}>
        {['overview', 'subscribers', 'purchases'].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', background: activeTab === t ? theme.accentBg : 'transparent', color: activeTab === t ? theme.accent : theme.textMuted, fontSize: '13px', fontWeight: activeTab === t ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', transition: 'all .15s' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Monthly revenue', value: `฿${monthlyRevenue.toLocaleString()}`, sub: 'this calendar month', color: theme.accent },
              { label: 'Active subscribers', value: String(subs.filter((s) => (s.status || '').toLowerCase() === 'active').length), sub: 'premium + annual', color: '#4ade80' },
            ].map((s) => (
              <div key={s.label} style={{ background: `linear-gradient(160deg, ${s.color}1f 0%, ${theme.bgCard} 55%)`, border: `1px solid ${s.color}40`, borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ color: s.color, fontSize: '20px', fontWeight: 700 }}>{s.value}</div>
                <div style={{ color: theme.text, fontSize: '12px', marginTop: '2px' }}>{s.label}</div>
                <div style={{ color: theme.textMuted, fontSize: '10px', marginTop: '2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {plans.map((p) => {
              const c = planColor[p.accentKey];
              return (
                <div key={p.id} style={{ background: `linear-gradient(160deg, ${c}1f 0%, ${theme.bgCard} 55%)`, border: `1px solid ${c}40`, borderRadius: '14px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: c }} />
                  <div style={{ color: c, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>{p.name}</div>
                  <div style={{ color: theme.textStrong, fontSize: '22px', fontWeight: 700 }}>{p.price}</div>
                  <div style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '14px' }}>{p.period}</div>
                  <div style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '10px', paddingBottom: '10px', borderBottom: `1px solid ${c}20` }}>
                    <span style={{ color: c, fontSize: '18px', fontWeight: 700 }}>{planUserCount(p.id).toLocaleString()}</span> users
                  </div>
                  {p.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <span style={{ color: c, fontSize: '12px' }}>✓</span>
                      <span style={{ color: theme.textMuted, fontSize: '12px' }}>{f}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div style={{ color: theme.textStrong, fontSize: '14px', fontWeight: 700, margin: '28px 0 4px' }}>Token packages</div>
          <div style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '14px' }}>One-time top-ups — 1 battle costs 20 tokens</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {tokenPackages.map((t) => {
              const c = '#fbbf24';
              return (
                <div key={t.id} style={{ background: `linear-gradient(160deg, ${c}1f 0%, ${theme.bgCard} 55%)`, border: t.highlight ? `1px solid ${c}` : `1px solid ${c}40`, borderRadius: '14px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: c }} />
                  {t.highlight && (
                    <div style={{ position: 'absolute', top: '10px', right: '14px', background: `${c}20`, color: c, border: `1px solid ${c}50`, borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Most popular
                    </div>
                  )}
                  <div style={{ color: c, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>{t.name}</div>
                  <div style={{ color: theme.textStrong, fontSize: '22px', fontWeight: 700 }}>{t.tokens.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: theme.textMuted }}>tokens</span></div>
                  <div style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '14px' }}>{t.bonus || ' '}</div>
                  <div style={{ color: theme.text, fontSize: '18px', fontWeight: 700, paddingTop: '10px', borderTop: `1px solid ${c}20` }}>{t.price}</div>
                </div>
              );
            })}
          </div>
        </>
      ) : activeTab === 'subscribers' ? (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', position: 'relative' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user name..." style={{ flex: 1, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 14px', color: theme.text, fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => setShowFilter((v) => !v)} style={{ background: activeFilterCount > 0 ? theme.accentBg : theme.bgCard, border: activeFilterCount > 0 ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 16px', color: activeFilterCount > 0 ? theme.accent : theme.textMuted, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} ▾
            </button>

            {showFilter && (
              <div style={{ position: 'absolute', top: '46px', right: 0, zIndex: 10, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '14px', width: '220px' }}>
                <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Plan</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {['all', 'free', 'premium', 'annual'].map((p) => (
                    <button key={p} onClick={() => setPlanFilter(p)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', border: planFilter === p ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, color: planFilter === p ? theme.accent : theme.textMuted, background: planFilter === p ? theme.accentBg : 'transparent' }}>
                      {p}
                    </button>
                  ))}
                </div>

                <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {['all', 'active', 'expired', 'cancelled'].map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', border: statusFilter === s ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, color: statusFilter === s ? theme.accent : theme.textMuted, background: statusFilter === s ? theme.accentBg : 'transparent' }}>
                      {s}
                    </button>
                  ))}
                </div>

                <button onClick={() => { setPlanFilter('all'); setStatusFilter('all'); }} style={{ width: '100%', padding: '7px 0', borderRadius: '7px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.textMuted, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${theme.border}` }}>
              {['User', 'Plan', 'Started', 'Expires', 'Status'].map((h) => (
                <div key={h} style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {filteredSubs.length === 0 ? (
              <div style={{ padding: '24px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>No subscribers match your search or filters.</div>
            ) : (
              filteredSubs.map((s, i) => {
                const st = statusStyle[(s.status || '').toLowerCase()] || statusStyle.active;
                const pc = planColor[(s.plan || '').toLowerCase()] || theme.accent;
                return (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < filteredSubs.length - 1 ? `1px solid ${theme.border}` : 'none', alignItems: 'center' }}>
                    <div style={{ color: theme.textStrong, fontSize: '13px', fontWeight: 500 }}>{s.user || s.name || s.email || 'Unknown user'}</div>
                    <div>
                      <span style={{ background: `${pc}15`, color: pc, border: `1px solid ${pc}30`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', textTransform: 'capitalize' }}>{(s.plan || 'free').toLowerCase()}</span>
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: '12px' }}>{s.started || '—'}</div>
                    <div style={{ color: theme.textMuted, fontSize: '12px' }}>{s.expires || '—'}</div>
                    <div>
                      <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', textTransform: 'capitalize' }}>{(s.status || 'active').toLowerCase()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', position: 'relative' }}>
            <input value={purchaseSearch} onChange={(e) => setPurchaseSearch(e.target.value)} placeholder="Search by user name..." style={{ flex: 1, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 14px', color: theme.text, fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => setShowPurchaseFilter((v) => !v)} style={{ background: activePurchaseFilterCount > 0 ? theme.accentBg : theme.bgCard, border: activePurchaseFilterCount > 0 ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 16px', color: activePurchaseFilterCount > 0 ? theme.accent : theme.textMuted, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Filter{activePurchaseFilterCount > 0 ? ` (${activePurchaseFilterCount})` : ''} ▾
            </button>

            {showPurchaseFilter && (
              <div style={{ position: 'absolute', top: '46px', right: 0, zIndex: 10, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '14px', width: '240px' }}>
                <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {[{ id: 'all', name: 'All' }, { id: 'topic_premium', name: 'Topic premium' }, { id: 'token_package', name: 'Token package' }].map((t) => (
                    <button key={t.id} onClick={() => setPurchaseTypeFilter(t.id)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', border: purchaseTypeFilter === t.id ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, color: purchaseTypeFilter === t.id ? theme.accent : theme.textMuted, background: purchaseTypeFilter === t.id ? theme.accentBg : 'transparent' }}>
                      {t.name}
                    </button>
                  ))}
                </div>

                <div style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Package</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {[{ id: 'all', name: 'All' }, ...purchasePackageOptions].map((pkg) => (
                    <button key={pkg.id} onClick={() => setPurchasePackageFilter(pkg.id)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', border: purchasePackageFilter === pkg.id ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, color: purchasePackageFilter === pkg.id ? theme.accent : theme.textMuted, background: purchasePackageFilter === pkg.id ? theme.accentBg : 'transparent' }}>
                      {pkg.name}
                    </button>
                  ))}
                </div>

                <button onClick={() => { setPurchaseTypeFilter('all'); setPurchasePackageFilter('all'); }} style={{ width: '100%', padding: '7px 0', borderRadius: '7px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.textMuted, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.6fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${theme.border}` }}>
              {['User', 'Type', 'Package', 'Amount', 'Date'].map((h) => (
                <div key={h} style={{ color: theme.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {filteredPurchases.length === 0 ? (
              <div style={{ padding: '24px 16px', color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>
                {purchases.length === 0 ? 'No purchases yet.' : 'No purchases match your search or filters.'}
              </div>
            ) : (
              filteredPurchases
                .slice()
                .sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || ''))
                .map((p, i) => {
                  const isToken = p.type === 'token_package';
                  const tc = isToken ? '#fbbf24' : theme.accent;
                  return (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.6fr 1fr 1fr', padding: '12px 16px', borderBottom: i < filteredPurchases.length - 1 ? `1px solid ${theme.border}` : 'none', alignItems: 'center' }}>
                      <div style={{ color: theme.textStrong, fontSize: '13px', fontWeight: 500 }}>{p.user || p.name || p.email || 'Unknown user'}</div>
                      <div>
                        <span style={{ background: `${tc}15`, color: tc, border: `1px solid ${tc}30`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px' }}>{isToken ? 'Token package' : 'Topic premium'}</span>
                      </div>
                      <div style={{ color: theme.text, fontSize: '12px' }}>{packageNameFor(p)}</div>
                      <div style={{ color: theme.textMuted, fontSize: '12px' }}>{p.amountBaht != null ? `฿${p.amountBaht}` : '—'}</div>
                      <div style={{ color: theme.textMuted, fontSize: '12px' }}>{p.purchasedAt || '—'}</div>
                    </div>
                  );
                })
            )}
          </div>
        </>
      )}
    </div>
  );
}