'use client';
import { useState } from 'react';

interface IRData {
  rowIndex:         number;
  ir_id:            string;
  name:             string;
  level:            string;
  bv:               string;
  rsp_total:        string;
  parent_ir_id:     string;
  parent_name:      string;
  direct_downlines: string;
  left_right:       string;
  source:           string;
  email:            string;
  referrer_ir_id:   string;
}

export default function Home() {
  const [query,       setQuery]       = useState('');
  const [searching,   setSearching]   = useState(false);
  const [found,       setFound]       = useState<boolean | null>(null);
  const [data,        setData]        = useState<IRData | null>(null);
  const [searchError, setSearchError] = useState('');

  const [email,       setEmail]       = useState('');
  const [referrerId,  setReferrerId]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');
  const [saveMsgType, setSaveMsgType] = useState<'success' | 'error'>('success');
  const [saved,       setSaved]       = useState(false);

  // ── Search ────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (!q) return;

    setSearching(true);
    setSearchError('');
    setFound(null);
    setData(null);
    setSaveMsg('');
    setSaved(false);

    try {
      const res  = await fetch(`/api/search?ir_id=${encodeURIComponent(q)}`);
      const json = await res.json();

      if (!res.ok) {
        setSearchError(json.error ?? 'Search failed.');
        return;
      }

      setFound(json.found);
      if (json.found && json.data) {
        setData(json.data);
        // Pre-fill form with existing sheet values
        setEmail(json.data.email ?? '');
        setReferrerId(json.data.referrer_ir_id ?? '');
      }
    } catch {
      setSearchError('Network error. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // ── Save / Update ─────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    setSaving(true);
    setSaveMsg('');

    try {
      const res  = await fetch('/api/update', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rowIndex:       data.rowIndex,
          email:          email.trim(),
          referrer_ir_id: referrerId.trim().toUpperCase(),
        }),
      });
      const json = await res.json();

      if (res.ok) {
        setSaveMsg('✓ Details saved successfully to Google Sheets!');
        setSaveMsgType('success');
        setSaved(true);
        // Update local display
        setData(prev => prev ? { ...prev, email: email.trim(), referrer_ir_id: referrerId.trim().toUpperCase() } : prev);
      } else {
        setSaveMsg('⚠ ' + (json.error ?? 'Save failed.'));
        setSaveMsgType('error');
      }
    } catch {
      setSaveMsg('⚠ Network error. Please try again.');
      setSaveMsgType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setFound(null);
    setData(null);
    setSearchError('');
    setSaveMsg('');
    setSaved(false);
    setEmail('');
    setReferrerId('');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-[#1E1E1E] bg-[#0F0F0F]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{ boxShadow: '0 0 16px rgba(249,115,22,0.4)' }}>
              <span className="text-base font-black text-white">M</span>
            </div>
            <div>
              <h1 className="text-base font-black text-white leading-none">Magic AI Portal</h1>
              <p className="text-xs text-gray-600 leading-none mt-0.5">IR Data Lookup</p>
            </div>
          </div>
          <a href="/calculator" className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-500/20 hover:text-orange-200">
            MAGIC Calculator
          </a>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-8">

        {/* Hero */}
        {!data && (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-3xl mb-6"
              style={{ boxShadow: '0 0 30px rgba(249,115,22,0.1)' }}>
              <span className="text-4xl">🔍</span>
            </div>
            <h2 className="text-3xl font-black text-white mb-2">Search Your IR Details</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Enter your IR ID to view your details and update your email address and referrer.
            </p>
          </div>
        )}

        {/* ── Search bar ───────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              placeholder="Enter IR ID — e.g. IN109895"
              autoFocus
              maxLength={20}
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl pl-12 pr-4 py-3.5
                         text-white text-base font-mono tracking-wide placeholder-gray-600
                         focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30
                         transition-colors h-14"
            />
            {query && (
              <button type="button" onClick={handleReset}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-lg">
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="h-14 px-8 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                       text-white font-bold rounded-xl transition-all duration-150
                       disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 flex items-center gap-2"
          >
            {searching ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching…
              </>
            ) : 'Search'}
          </button>
        </form>

        {/* Search error */}
        {searchError && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-red-400 text-sm">
            ⚠ {searchError}
          </div>
        )}

        {/* ── NOT FOUND ────────────────────────────────────────── */}
        {found === false && (
          <div className="bg-[#141414] border border-yellow-500/20 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔎</div>
            <h3 className="text-xl font-bold text-white mb-2">IR ID Not Found</h3>
            <p className="text-gray-500 text-sm">
              <span className="text-yellow-400 font-mono font-bold">"{query}"</span> was not found
              in the database. Please check the IR ID and try again.
            </p>
          </div>
        )}

        {/* ── FOUND — Result card ──────────────────────────────── */}
        {found === true && data && (
          <div className="space-y-5 animate-slide-up">

            {/* IR Details card */}
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.1), 0 0 30px rgba(249,115,22,0.05)' }}>

              {/* Card header */}
              <div className="bg-gradient-to-r from-orange-500/15 to-transparent border-b border-[#2A2A2A] px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-orange-400 uppercase tracking-widest font-semibold mb-0.5">Found</p>
                  <h2 className="text-2xl font-black text-white">{data.name}</h2>
                  <p className="text-orange-400 font-mono font-bold">{data.ir_id}</p>
                </div>
                <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-400 font-black text-lg">
                    {data.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </span>
                </div>
              </div>

              {/* IR fields grid */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Level',            value: data.level || '—' },
                  { label: 'BV',               value: data.bv || '0' },
                  { label: 'RSP Total',         value: data.rsp_total || '0' },
                  { label: 'Direct Downlines',  value: data.direct_downlines || '0' },
                  { label: 'L/R',              value: data.left_right || '—' },
                  { label: 'Source',            value: data.source || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3.5">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-white font-bold truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Parent info */}
              {(data.parent_ir_id || data.parent_name) && (
                <div className="px-6 pb-6">
                  <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center text-gray-400 font-bold text-sm flex-shrink-0">
                      {(data.parent_name || 'P').split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">Parent / Upline</p>
                      <p className="text-white font-semibold truncate">{data.parent_name || '—'}</p>
                      <p className="text-gray-500 text-sm font-mono">{data.parent_ir_id || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Update form ──────────────────────────────────── */}
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">
                {data.email || data.referrer_ir_id ? 'Update Your Details' : 'Add Your Details'}
              </h3>
              <p className="text-gray-500 text-sm mb-5">
                {data.email || data.referrer_ir_id
                  ? 'Your details are already on file. You can update them below.'
                  : 'Fill in your email and referrer IR ID. This will be saved directly to the sheet.'}
              </p>

              {/* Show existing values if already filled */}
              {(data.email || data.referrer_ir_id) && !saved && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-5 space-y-1.5">
                  <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-2">Current Values on File</p>
                  {data.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-20">Email:</span>
                      <span className="text-green-300 font-medium">{data.email}</span>
                    </div>
                  )}
                  {data.referrer_ir_id && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-20">Referrer:</span>
                      <span className="text-green-300 font-mono font-medium">{data.referrer_ir_id}</span>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Email Address
                    {!data.email && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3
                               text-white placeholder-gray-600
                               focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30
                               transition-colors"
                  />
                </div>

                {/* Referrer IR ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">
                    Referrer IR ID
                  </label>
                  <input
                    type="text"
                    value={referrerId}
                    onChange={e => setReferrerId(e.target.value.toUpperCase())}
                    placeholder="e.g. AB506142"
                    maxLength={20}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3
                               text-white placeholder-gray-600 font-mono tracking-widest
                               focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30
                               transition-colors"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    The IR ID of the person who referred you. Leave blank if not applicable.
                  </p>
                </div>

                {/* Save message */}
                {saveMsg && (
                  <div className={`rounded-xl p-3.5 text-sm font-medium ${
                    saveMsgType === 'success'
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {saveMsg}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={saving || (!email && !referrerId)}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700
                               text-white font-bold rounded-xl py-3 transition-all duration-150
                               disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving…
                      </>
                    ) : saved ? '✓ Saved — Update Again' : (data.email || data.referrer_ir_id) ? 'Update Details' : 'Save Details'}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-3 bg-transparent border border-[#2A2A2A] hover:border-orange-500/50
                               text-gray-400 hover:text-white font-medium rounded-xl transition-all"
                  >
                    New Search
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E1E1E] py-4 text-center text-xs text-gray-700">
        Magic AI Portal · magic-ai.me
      </footer>
    </div>
  );
}
