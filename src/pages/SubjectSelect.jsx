/**
 * Step 2 — Subject & Paper Selection
 * Handles all curricula: Cambridge IGCSE, Edexcel IGCSE/IAL, IB DP.
 */
import { useState, useEffect, useRef } from 'react';
import {
  loadZoneTimetable, loadCurriculumData,
  buildEventsForCurriculum, flattenCategories,
  fmtDateLong, ZONE_INFO, CURRICULUM_INFO,
} from '../utils/timetable.js';
import { usePlanner } from '../context/PlannerContext.jsx';
import { useAuth }    from '../context/AuthContext.jsx';
import AuthHeaderButton from '../components/AuthHeaderButton.jsx';
import Footer           from '../components/Footer.jsx';

export default function SubjectSelect() {
  const { zone, curriculum, selectedCodes, setSelectedCodes, setEvents, setStep } = usePlanner();
  const { user, openAuth, isSupabaseEnabled } = useAuth();

  const [timetable, setTimetable] = useState(null);
  const [subjects,  setSubjects]  = useState([]);  // flat array with .cat
  const [selected,  setSelected]  = useState(() => new Set(selectedCodes));
  const [openIds,   setOpenIds]   = useState(new Set());
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState('');
  const authPromptFired           = useRef(false);

  const isCambridge = curriculum === 'cambridge';
  const isIB        = curriculum === 'ib-dp';
  const isEdexcelUK = curriculum === 'edexcel-gcse';

  // ── Load timetable data ───────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    const p = isCambridge
      ? loadZoneTimetable(zone)
      : loadCurriculumData(curriculum);

    p.then(data => {
      setTimetable(data);

      // Flatten to unified subjects[] with .cat
      let flat;
      if (isCambridge) {
        flat = data.subjects; // already flat; .cat already on each subject
      } else {
        flat = flattenCategories(data);
      }
      setSubjects(flat);

      // Auto-open subjects that already have selections
      if (selectedCodes.size > 0) {
        const autoOpen = new Set();
        flat.forEach(s => {
          if (s.papers.some(p => selectedCodes.has(p.code))) autoOpen.add(s.id);
        });
        setOpenIds(autoOpen);
      }
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [zone, curriculum]);

  // ── Auth prompt at 5+ papers ──────────────────────────────────────────────
  useEffect(() => {
    if (user || !isSupabaseEnabled || authPromptFired.current) return;
    if (selected.size >= 5) {
      authPromptFired.current = true;
      openAuth('subjects');
    }
  }, [selected.size, user, isSupabaseEnabled]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
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

  // IB-specific: select/deselect only one level's papers.
  // 'SL' → pure SL + shared HL/SL papers (both are sat by SL students).
  // 'HL' → pure HL + shared HL/SL papers (both are sat by HL students).
  function selectLevelPapers(subj, level, all) {
    setSelected(prev => {
      const n = new Set(prev);
      subj.papers
        .filter(p => p.level === level || p.level === 'HL/SL')
        .forEach(p => { if (all) n.add(p.code); else n.delete(p.code); });
      return n;
    });
  }

  function toggleOpen(id) {
    setOpenIds(prev => {
      const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
    });
  }

  // ── Confirm → build events → calendar ────────────────────────────────────
  function handleConfirm() {
    if (!timetable) return;
    const importedEvents = buildEventsForCurriculum(curriculum, timetable, selected);
    setSelectedCodes(new Set(selected));
    setEvents(prev => {
      const manual = prev.filter(e => e.source !== 'timetable');
      return [...manual, ...importedEvents];
    });
    setStep(3);
  }

  // ── Back navigation ───────────────────────────────────────────────────────
  function handleBack() {
    if (isCambridge) setStep('zone');
    else             setStep(0);
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredSubjects = q
    ? subjects.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.papers.some(p => p.name.toLowerCase().includes(q))
      )
    : subjects;

  // Group by category
  const cats = [...new Set(filteredSubjects.map(s => s.cat))];

  const totalSelected = selected.size;
  const currInfo      = CURRICULUM_INFO[curriculum] || {};
  const zoneInfo      = isCambridge ? ZONE_INFO[zone] : null;

  // ── Subtitle line ─────────────────────────────────────────────────────────
  const subtitle = isCambridge
    ? `Zone ${zone} · ${zoneInfo?.regions} · ${currInfo.session}`
    : currInfo.session;

  // ── Info bar copy ─────────────────────────────────────────────────────────
  function InfoBar() {
    if (isCambridge) {
      return (
        <div className="zone-bar">
          <span className="zone-icon">i</span>
          <span>
            <strong>{zoneInfo?.label} — {zoneInfo?.regions}.</strong>&nbsp;
            {zone === 'uk'
              ? 'UK zone includes all standard Zone 3 subjects plus UK-specific syllabuses. Each subject shows only the papers from the official Cambridge UK timetable (PDF 745757).'
              : <>Each subject shows only the papers and variant from the official Cambridge Zone {zone} timetable.
                  The variant badge (e.g.&nbsp;<span className="paper-variant-badge" style={{verticalAlign:'middle'}}>V{zoneInfo?.variants[0]}</span>)
                  is the exact code your centre uses.</>
            }
          </span>
        </div>
      );
    }
    if (curriculum === 'edexcel-igcse') {
      return (
        <div className="zone-bar">
          <span className="zone-icon">i</span>
          <span>
            <strong>Pearson Edexcel International GCSE — single global timetable.</strong>&nbsp;
            All dates are from the official Edexcel Summer 2026 timetable. No zone system applies.
          </span>
        </div>
      );
    }
    if (curriculum === 'edexcel-ial') {
      return (
        <div className="zone-bar">
          <span className="zone-icon">i</span>
          <span>
            <strong>Pearson Edexcel International Advanced Levels — single global timetable.</strong>&nbsp;
            Select the individual units you are sitting. All dates are from the official Edexcel Summer 2026 timetable.
          </span>
        </div>
      );
    }
    if (isEdexcelUK) {
      return (
        <div className="zone-bar">
          <span className="zone-icon">i</span>
          <span>
            <strong>Pearson Edexcel GCSE — UK & International.</strong>&nbsp;
            Subject codes begin with <strong>1</strong> (e.g. 1MA1, 1BI0). Single global timetable — same dates for UK and international centres. Different qualification from Edexcel International GCSE (codes begin with 4).
          </span>
        </div>
      );
    }
    if (isIB) {
      return (
        <div className="zone-bar">
          <span className="zone-icon">i</span>
          <span>
            <strong>IB Diploma Programme — May 2026.</strong>&nbsp;
            All IB zones (A, B, C) follow identical exam dates; only local start times differ.
            Select both the subject <em>and</em> the level (HL or SL) you are sitting.
          </span>
        </div>
      );
    }
    return null;
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
        <p style={{ color:'var(--t2)', fontSize:14 }}>Loading {currInfo.label || curriculum} timetable…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page" style={{ paddingTop:48 }}>
        <div className="wrap">
          <p style={{ color:'var(--exam-fg)', fontSize:13 }}>Error loading timetable: {error}</p>
          <button className="link-btn" style={{ marginTop:12 }} onClick={handleBack}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page" id="pg1">
      <div className="wrap">
        {/* Header */}
        <div className="hdr">
          <div>
            <p className="title">Choose your subjects</p>
            <p className="sub">{subtitle} · tick the papers you are sitting</p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <AuthHeaderButton />
            <button className="link-btn" onClick={handleBack}>
              {isCambridge ? '← Zone' : '← Curriculum'}
            </button>
          </div>
        </div>

        <InfoBar />

        {/* Search */}
        <div style={{ margin:'12px 0' }}>
          <input
            className="country-search"
            type="search"
            placeholder="Search subjects or papers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* No results */}
        {cats.length === 0 && (
          <p style={{ color:'var(--t3)', fontSize:13, marginTop:24 }}>
            No subjects match &ldquo;{search}&rdquo;
          </p>
        )}

        {/* Subject categories */}
        {cats.map(cat => {
          const subjs = filteredSubjects.filter(s => s.cat === cat);
          return (
            <div className="cat-block" key={cat}>
              <div className="cat-label">{cat}</div>
              <div className="subj-grid">
                {subjs.map(s => {
                  const selCount = s.papers.filter(p => selected.has(p.code)).length;
                  const isSel    = selCount > 0;
                  const isOpen   = openIds.has(s.id);
                  return (
                    <div key={s.id} className={`sc${isSel?' sel':''}${isOpen?' open':''}`}>
                      <div
                        className="sc-hdr"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleOpen(s.id)}
                        onKeyDown={e => (e.key==='Enter'||e.key===' ') && toggleOpen(s.id)}
                      >
                        <span className="sc-dot" />
                        <span className="sc-name">{s.name}</span>
                        <span className="sc-code">{s.code}</span>
                        {selCount > 0 && <span className="sc-count">{selCount}</span>}
                        <span className="sc-arr">▾</span>
                      </div>

                      {isOpen && (() => {
                        // Paper row renderer.
                        // inColumn=true  → inside an IB SL or HL column:
                        //   • hides the level badge (column header already says SL/HL)
                        //   • hides the internal IB code (e.g. "physics-hl-p1" — meaningless to students)
                        // inColumn=false (default) → shared/cross-level papers and all non-IB curricula:
                        //   • shows level badge and code as normal
                        const PaperRow = (p, inColumn = false) => {
                          const checked    = selected.has(p.code);
                          const uid        = 'cb-' + p.code.replace(/[/\s]/g, '_');
                          const showBadge  = isIB && p.level && !inColumn;
                          const showCode   = !isIB || !inColumn;
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
                                  {isCambridge && p.v > 0 && (
                                    <span className="paper-variant-badge"> V{p.v}</span>
                                  )}
                                  {showBadge && (
                                    <span className={`paper-level-badge paper-level-${p.level.replace('/','').toLowerCase()}`}> {p.level}</span>
                                  )}
                                </span>
                                {showCode && (
                                  <span className="paper-code">{p.code}</span>
                                )}
                                <span className="paper-meta">
                                  {fmtDateLong(p.date)} · {p.sess === 'Window' ? '📅 Exam window' : p.sess} · {p.dur}
                                </span>
                              </label>
                            </div>
                          );
                        };

                        // IB: split into SL (left) and HL (right) columns.
                        // Papers marked HL/SL appear in both columns — both sets of
                        // students sit them. No shared section above the split.
                        if (isIB) {
                          const slPapers = s.papers.filter(p => p.level === 'SL' || p.level === 'HL/SL');
                          const hlPapers = s.papers.filter(p => p.level === 'HL' || p.level === 'HL/SL');
                          return (
                            <div className="sc-papers sc-papers--ib">
                              <div className="ib-level-cols">
                                <div className="ib-level-col">
                                  <div className="ib-level-col-header ib-level-col-header--sl">SL — Standard Level</div>
                                  <div className="ib-col-actions">
                                    <button className="papers-all-btn" onClick={() => selectLevelPapers(s, 'SL', true)}>Select all</button>
                                    <button className="papers-all-btn" onClick={() => selectLevelPapers(s, 'SL', false)}>Deselect all</button>
                                  </div>
                                  {slPapers.length > 0
                                    ? slPapers.map(p => PaperRow(p, true))
                                    : <p className="ib-level-empty">No SL papers</p>
                                  }
                                </div>
                                <div className="ib-level-col">
                                  <div className="ib-level-col-header ib-level-col-header--hl">HL — Higher Level</div>
                                  <div className="ib-col-actions">
                                    <button className="papers-all-btn" onClick={() => selectLevelPapers(s, 'HL', true)}>Select all</button>
                                    <button className="papers-all-btn" onClick={() => selectLevelPapers(s, 'HL', false)}>Deselect all</button>
                                  </div>
                                  {hlPapers.length > 0
                                    ? hlPapers.map(p => PaperRow(p, true))
                                    : <p className="ib-level-empty">No HL papers</p>
                                  }
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // All other curricula: original linear list
                        return (
                          <div className="sc-papers">
                            <div className="papers-all-row">
                              <button className="papers-all-btn" onClick={() => selectAllPapers(s, true)}>Select all</button>
                              <button className="papers-all-btn" onClick={() => selectAllPapers(s, false)}>Deselect all</button>
                            </div>
                            {s.papers.map(p => PaperRow(p))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Footer />

      {/* Sticky footer */}
      <div className="pg1-footer">
        <div className="pg1-footer-inner">
          <div className="sel-summary">
            {totalSelected === 0
              ? 'No papers selected yet'
              : <><strong>{totalSelected} paper{totalSelected!==1?'s':''}</strong> selected</>
            }
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="skip-link" onClick={handleConfirm}>Skip →</button>
            <button className="next-btn" onClick={handleConfirm}>Continue to calendar →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
