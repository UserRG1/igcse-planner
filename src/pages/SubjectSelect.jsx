/**
 * Step 1 — Subject & Paper Selection
 * Loads timetable-zone{N}.json dynamically.
 * Each subject shows only the papers/variant that actually appear in that
 * zone's official Cambridge timetable — no duplicates across variants.
 */
import { useState, useEffect, useRef } from 'react';
import { loadZoneTimetable, buildTimetableEvents, fmtDateLong, ZONE_INFO } from '../utils/timetable.js';
import { usePlanner } from '../context/PlannerContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SubjectSelect() {
  const { zone, selectedCodes, setSelectedCodes, events, setEvents, setStep } = usePlanner();
  const { user, openAuth, isSupabaseEnabled } = useAuth();

  const [timetable, setTimetable] = useState(null);
  const [selected, setSelected]   = useState(() => new Set(selectedCodes));
  const [openIds, setOpenIds]      = useState(new Set());
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState(null);
  const authPromptFired            = useRef(false);

  useEffect(() => {
    setLoading(true);
    loadZoneTimetable(zone)
      .then(data => {
        setTimetable(data);
        // Auto-open subjects that already have selected papers
        if (selectedCodes.size > 0) {
          const autoOpen = new Set();
          data.subjects.forEach(s => {
            if (s.papers.some(p => selectedCodes.has(p.code))) autoOpen.add(s.id);
          });
          setOpenIds(autoOpen);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [zone]);

  // Auth prompt: fire once when user picks ≥5 papers and isn't signed in
  useEffect(() => {
    if (user || !isSupabaseEnabled || authPromptFired.current) return;
    if (selected.size >= 5) {
      authPromptFired.current = true;
      openAuth('subjects');
    }
  }, [selected.size, user, isSupabaseEnabled]);

  function togglePaper(code, checked) {
    setSelected(prev => {
      const n = new Set(prev);
      if (checked) n.add(code); else n.delete(code);
      return n;
    });
  }

  function selectAllPapers(subj, all) {
    setSelected(prev => {
      const n = new Set(prev);
      subj.papers.forEach(p => { if (all) n.add(p.code); else n.delete(p.code); });
      return n;
    });
  }

  function toggleOpen(id) {
    setOpenIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function handleConfirm() {
    if (!timetable) return;
    const importedEvents = buildTimetableEvents(timetable, selected);
    setSelectedCodes(new Set(selected));
    setEvents(prev => {
      const manual = prev.filter(e => e.source !== 'timetable');
      return [...manual, ...importedEvents];
    });
    setStep(3);
  }

  const totalSelected = selected.size;
  const zoneInfo = ZONE_INFO[zone];

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--t2)', fontSize: 14 }}>Loading Zone {zone} timetable…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ paddingTop: 48 }}>
        <div className="wrap">
          <p style={{ color: 'var(--exam-fg)', fontSize: 13 }}>Error loading timetable: {error}</p>
          <button className="link-btn" style={{ marginTop: 12 }} onClick={() => setStep(1)}>← Back to zone</button>
        </div>
      </div>
    );
  }

  const cats = timetable ? [...new Set(timetable.subjects.map(s => s.cat))] : [];

  return (
    <div className="page" id="pg1">
      <div className="wrap">
        <div className="hdr">
          <div>
            <p className="title">Choose your subjects</p>
            <p className="sub">
              Zone {zone} · {zoneInfo?.regions} · tick the papers you are sitting
            </p>
          </div>
          <button className="link-btn" onClick={() => setStep(1)}>← Zone</button>
        </div>

        {/* Zone info bar */}
        <div className="zone-bar">
          <span className="zone-icon">i</span>
          <span>
            <strong>{zoneInfo?.label} — {zoneInfo?.regions}.</strong>&nbsp;
            {zone === 'uk'
              ? <>UK zone includes all standard Zone 3 subjects plus UK-specific syllabuses (Latin, Swahili, First Language French, German, Thai, Turkish and more). Each subject shows only the papers and variant code from the official Cambridge UK timetable (PDF 745757).</>
              : <>Each subject shows only the papers and variant code that appear in the official Cambridge Zone {zone} timetable. The variant badge (e.g.&nbsp;
                  <span className="paper-variant-badge" style={{verticalAlign:'middle'}}>
                    V{zoneInfo?.variants[0]}
                  </span>
                  ) is the exact code your centre will use. All dates and sessions are from the Cambridge June 2026 Zone {zone} PDF.</>
            }
          </span>
        </div>

        {cats.map(cat => {
          const subjs = timetable.subjects.filter(s => s.cat === cat);
          return (
            <div className="cat-block" key={cat}>
              <div className="cat-label">{cat}</div>
              <div className="subj-grid">
                {subjs.map(s => {
                  const selCount = s.papers.filter(p => selected.has(p.code)).length;
                  const isSel    = selCount > 0;
                  const isOpen   = openIds.has(s.id);
                  return (
                    <div key={s.id} className={`sc${isSel ? ' sel' : ''}${isOpen ? ' open' : ''}`}>
                      <div
                        className="sc-hdr"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleOpen(s.id)}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleOpen(s.id)}
                      >
                        <span className="sc-dot" />
                        <span className="sc-name">{s.name}</span>
                        <span className="sc-code">{s.code}</span>
                        {selCount > 0 && <span className="sc-count">{selCount}</span>}
                        <span className="sc-arr">▾</span>
                      </div>

                      {isOpen && (
                        <div className="sc-papers">
                          <div className="papers-all-row">
                            <button className="papers-all-btn" onClick={() => selectAllPapers(s, true)}>Select all</button>
                            <button className="papers-all-btn" onClick={() => selectAllPapers(s, false)}>Deselect all</button>
                          </div>
                          {s.papers.map(p => {
                            const checked = selected.has(p.code);
                            const uid = 'cb-' + p.code.replace('/', '_');
                            return (
                              <div className="paper-row" key={p.code}>
                                <input
                                  className="paper-cb"
                                  type="checkbox"
                                  id={uid}
                                  checked={checked}
                                  onChange={e => togglePaper(p.code, e.target.checked)}
                                />
                                <label className="paper-info" htmlFor={uid}>
                                  <span className="paper-name">
                                    {p.name}
                                    {p.v > 0 && (
                                      <span className="paper-variant-badge"> V{p.v}</span>
                                    )}
                                  </span>
                                  <span className="paper-code">{p.code}</span>
                                  <span className="paper-meta">
                                    {fmtDateLong(p.date)} · {p.sess} · {p.dur}
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="pg1-footer">
        <div className="pg1-footer-inner">
          <div className="sel-summary">
            {totalSelected === 0
              ? 'No papers selected yet'
              : <><strong>{totalSelected} paper{totalSelected !== 1 ? 's' : ''}</strong> selected</>
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="skip-link" onClick={handleConfirm}>Skip →</button>
            <button className="next-btn" onClick={handleConfirm}>
              Continue to calendar →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
