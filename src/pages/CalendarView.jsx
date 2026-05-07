/**
 * Step 2 — Calendar View
 */
import { useState, useEffect, useRef } from 'react';
import { dateKey, fmtDateLong, fmtDateShort, ZONE_INFO } from '../utils/timetable.js';
import { drawCalendarToCanvas } from '../utils/jpgExport.js';
import { usePlanner } from '../context/PlannerContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import AuthHeaderButton from '../components/AuthHeaderButton.jsx';
import GuestExpiryPopup from '../components/GuestExpiryPopup.jsx';

const MONTHS = [
  { y: 2026, m: 3, name: 'April 2026', id: 'c-apr' },
  { y: 2026, m: 4, name: 'May 2026',   id: 'c-may' },
  { y: 2026, m: 5, name: 'June 2026',  id: 'c-jun' },
];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const STALE_DAYS = 5;

export default function CalendarView() {
  const { zone, events, setEvents, setStep, cloudSynced } = usePlanner();
  const { user, openAuth, isSupabaseEnabled, pendingExport, clearPendingExport } = useAuth();

  // After Google OAuth redirect, auto-open export if that's what triggered sign-in
  useEffect(() => {
    if (pendingExport && user) {
      clearPendingExport();
      openExport();
    }
  }, [pendingExport, user]);

  const [selDate,    setSelDate]    = useState(null);
  const [panelOpen,  setPanelOpen]  = useState(true);
  const [evListOpen, setEvListOpen] = useState(true);
  const [curType,    setCurType]    = useState('exam');
  const [editId,     setEditId]     = useState(null);
  const [pendDel,    setPendDel]    = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMsg,  setExportMsg]  = useState('');
  const [sheetOpen,  setSheetOpen]  = useState(false);

  const [fSubj, setFSubj] = useState('');
  const [fTime, setFTime] = useState('');
  const [fDur,  setFDur]  = useState('');
  const [fNote, setFNote] = useState('');

  const [staleBanner,      setStaleBanner]      = useState(false);
  const [eventsPromptDone, setEventsPromptDone] = useState(false);

  const pendTimer = useRef(null);
  const subjRef   = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // Stale-data warning
  useEffect(() => {
    if (user || !isSupabaseEnabled) return;
    try {
      const saved = JSON.parse(localStorage.getItem('igcse-planner-v5') || '{}');
      if (!saved.savedAt) return;
      const ageMs = Date.now() - new Date(saved.savedAt).getTime();
      if (ageMs > STALE_DAYS * 86_400_000) setStaleBanner(true);
    } catch {}
  }, [user, isSupabaseEnabled]);

  // Events prompt: once at 3 manual events
  const manualEvents = events.filter(e => e.source !== 'timetable');
  useEffect(() => {
    if (user || !isSupabaseEnabled || eventsPromptDone) return;
    if (manualEvents.length >= 3) {
      openAuth('events');
      setEventsPromptDone(true);
    }
  }, [manualEvents.length, user, isSupabaseEnabled, eventsPromptDone]);

  // ── NO beforeprint/afterprint handlers ───────────────────────────────────
  // PDF fix: selDate is cleared before printing so React removes .sel from
  // the DOM before the print dialog opens. DOM manipulation fought React's
  // render cycle and caused the highlighted-cell bug.

  function pickDate(k) {
    setSelDate(k);
    setEditId(null);
    setFSubj(''); setFTime(''); setFDur(''); setFNote('');
    if (isMobile) setSheetOpen(true);
    else if (!panelOpen) setPanelOpen(true);
    setTimeout(() => subjRef.current?.focus(), 80);
  }

  function clearForm() {
    setFSubj(''); setFTime(''); setFDur(''); setFNote('');
    setEditId(null);
  }

  function cancelEdit() {
    setSelDate(null); setEditId(null); setPendDel(null);
    clearTimeout(pendTimer.current);
    clearForm();
    if (isMobile) setSheetOpen(false);
  }

  function saveEv() {
    if (!selDate || !fSubj.trim()) { subjRef.current?.focus(); return; }
    const ev = {
      id:       editId || String(Date.now()),
      date:     selDate, type: curType,
      subject:  fSubj.trim(), time: fTime.trim(),
      duration: fDur.trim(),  note: fNote.trim(),
      source:   editId ? (events.find(e => e.id === editId)?.source || 'manual') : 'manual',
    };
    setEvents(prev => editId ? prev.map(e => e.id === editId ? ev : e) : [...prev, ev]);
    clearForm();
    if (isMobile) setSheetOpen(false);
  }

  function startEdit(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    setEditId(id); setSelDate(ev.date); setCurType(ev.type);
    setFSubj(ev.subject); setFTime(ev.time || '');
    setFDur(ev.duration || ''); setFNote(ev.note || '');
    if (isMobile) setSheetOpen(true);
    else if (!panelOpen) setPanelOpen(true);
    setTimeout(() => subjRef.current?.focus(), 80);
  }

  function delEv(id) {
    if (pendDel === id) {
      clearTimeout(pendTimer.current);
      setEvents(prev => prev.filter(e => e.id !== id));
      if (editId === id) clearForm();
      setPendDel(null);
    } else {
      setPendDel(id);
      clearTimeout(pendTimer.current);
      pendTimer.current = setTimeout(() => setPendDel(null), 3000);
    }
  }

  // Export — MANDATORY sign-in if Supabase is enabled
  function handleExportClick() {
    if (!user && isSupabaseEnabled) {
      openAuth('export', { onSuccess: openExport });
      // No onSkip — export is gated on sign-in
    } else {
      openExport();
    }
  }

  function openExport()  { setExportOpen(true);  setExportMsg(''); }
  function closeExport() { setExportOpen(false); }

  function doPdf() {
    // beforeprint fires synchronously inside the browser's own print rendering
    // sequence — after window.print() is called but before the browser paints
    // the print layout. It is NOT in the JS task queue. The print engine is
    // therefore guaranteed to see a DOM with no .sel class.
    //
    // We manipulate the DOM directly (not via React state) because:
    //   1. React setState is asynchronous — a re-render may not have committed
    //      by the time beforeprint fires
    //   2. Direct classList manipulation is synchronous and immediately visible
    //      to the print pipeline
    //
    // {once:true} auto-removes each listener after it fires once, so repeated
    // exports can never accumulate stale listeners that fire out of order.

    window.addEventListener('beforeprint', () => {
      // Mark and strip every .sel cell synchronously
      document.querySelectorAll('.cd.sel').forEach(el => {
        el.dataset.wasSel = 'true';
        el.classList.remove('sel');
      });
    }, { once: true });

    window.addEventListener('afterprint', () => {
      // Restore .sel so the UI is unchanged after the dialog closes
      document.querySelectorAll('.cd[data-was-sel]').forEach(el => {
        el.classList.add('sel');
        delete el.dataset.wasSel;
      });
    }, { once: true });

    closeExport();
    window.print();
  }

  function doJpg() {
    setExportMsg('Drawing calendar…');
    setTimeout(() => {
      try {
        const zoneLabel = ZONE_INFO[zone]?.label || `Zone ${zone}`;
        const cv = drawCalendarToCanvas(events, zone, zoneLabel);
        cv.toBlob(blob => {
          if (!blob) { setExportMsg('Failed — try PDF.'); return; }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'igcse-planner-2026.jpg';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          setExportMsg('JPG downloaded!');
          setTimeout(closeExport, 900);
        }, 'image/jpeg', 0.96);
      } catch (e) {
        setExportMsg('Something went wrong — try PDF.');
        console.error(e);
      }
    }, 30);
  }

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const examCount    = events.filter(e => e.type === 'exam').length;
  const noteCount    = events.length - examCount;
  const zoneInfo     = ZONE_INFO[zone];

  const panelContent = (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <p className="card-title">{editId ? 'Edit event' : 'Add event'}</p>
        <p className="dsel">
          {selDate
            ? fmtDateLong(selDate) + (editId ? ' — editing' : '')
            : 'Tap a day to add →'}
        </p>
        <label className="fl">Type</label>
        <div className="trow">
          <button className={`tt${curType === 'exam'  ? ' ae' : ''}`} onClick={() => setCurType('exam')}>Exam</button>
          <button className={`tt${curType === 'study' ? ' as' : ''}`} onClick={() => setCurType('study')}>Study</button>
        </div>
        <label className="fl">Subject / title</label>
        <input ref={subjRef} type="text" value={fSubj}
          onChange={e => setFSubj(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveEv()}
          placeholder="e.g. Physics Paper 4" />
        {curType === 'exam' ? (
          <>
            <label className="fl">Session</label>
            <input type="text" value={fTime} onChange={e => setFTime(e.target.value)} placeholder="e.g. AM or 9:00" />
            <label className="fl">Duration</label>
            <input type="text" value={fDur}  onChange={e => setFDur(e.target.value)}  placeholder="e.g. 1h 15m" />
          </>
        ) : (
          <>
            <label className="fl">Note</label>
            <input type="text" value={fNote} onChange={e => setFNote(e.target.value)} placeholder="e.g. Revise thermodynamics" />
          </>
        )}
        <div className="btnrow">
          <button className="bsv" onClick={saveEv}>{editId ? 'Update' : 'Save'}</button>
          <button className="bclr" onClick={cancelEdit}>Clear</button>
        </div>
      </div>

      <div className="card ev-card">
        <div className="ev-hdr">
          <div className="ev-hdr-left">
            <p className="card-title">All events</p>
            {events.length > 0 && (
              <span className="evcnt">
                {examCount} exam{examCount !== 1 ? 's' : ''}, {noteCount} note{noteCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button className="ev-toggle" onClick={() => setEvListOpen(o => !o)}
            title={evListOpen ? 'Collapse' : 'Expand'} aria-expanded={evListOpen}>
            <span className="ev-toggle-arr" style={{ transform: evListOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </button>
        </div>
        {evListOpen && (
          sortedEvents.length === 0
            ? <p className="noev">No events yet.</p>
            : (() => {
                let lastD = '';
                return sortedEvents.map(ev => {
                  const dateLabel = ev.date !== lastD ? (lastD = ev.date, fmtDateShort(ev.date)) : null;
                  const isPend    = pendDel === ev.id;
                  return (
                    <div key={ev.id}>
                      {dateLabel && <p className="dgl">{dateLabel}</p>}
                      <div className="ei">
                        <span className={`ebg ${ev.type}`}>{ev.type}</span>
                        <span className="ei-label" title={ev.subject}>
                          {ev.subject}
                          {ev.time && <span className="ei-time"> {ev.time}</span>}
                        </span>
                        <button className="edt" onClick={() => startEdit(ev.id)}>edit</button>
                        <button className={`edl${isPend ? ' pd' : ''}`} onClick={() => delEv(ev.id)}>
                          {isPend ? 'sure?' : '×'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()
        )}
      </div>
    </>
  );

  return (
    <div className="page cal-page">
      <div className="wrap">
        {/* Header */}
        <div className="hdr">
          <div>
            <p className="title">April – June 2026</p>
            <p className="sub">
              IGCSE planner · {zoneInfo ? `${zoneInfo.label} (${zoneInfo.regions})` : `Zone ${zone}`} · tap any day to add an event · auto-saves
            </p>
          </div>
          <div className="cal-hdr-right">
            <span className="badge exam">Exam</span>
            <span className="badge study">Study</span>
            <button className="link-btn" onClick={() => setStep(2)}>← Subjects</button>
            <button className="link-btn" onClick={() => setStep(1)}>← Zone</button>
            <button className="exp-btn" onClick={handleExportClick}>Export</button>
            <AuthHeaderButton />
            {!isMobile && (
              <button className="tog" onClick={() => setPanelOpen(p => !p)}>
                <i className="tog-arr" style={{ transform: panelOpen ? '' : 'rotate(180deg)' }}>&#8594;</i>
                <span>{panelOpen ? 'Hide panel' : 'Show panel'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Stale-data warning banner */}
        {staleBanner && !user && (
          <div className="stale-banner">
            <span className="stale-icon">⚠️</span>
            <span>
              <strong>Your data may be at risk.</strong>&nbsp;
              Safari and some browsers clear local storage after 7 days of inactivity.
              Sign in to move your calendar to the cloud.
            </span>
            <button className="stale-cta"
              onClick={() => openAuth('protect', { onSuccess: () => setStaleBanner(false) })}>
              Sign in to protect it
            </button>
            <button className="stale-dismiss" onClick={() => setStaleBanner(false)}>×</button>
          </div>
        )}

        {/* Layout */}
        <div className="layout">
          <div className="cal-col">
            {MONTHS.map(({ y, m, name, id }) => {
              const first = new Date(y, m, 1).getDay();
              const total = new Date(y, m + 1, 0).getDate();
              return (
                <div key={id} id={id}>
                  <p className="mname">{name}</p>
                  <div className="cg">
                    {DAYS.map((d, i) => (
                      <div key={d} className={`ch${i === 0 || i === 6 ? ' wk' : ''}`}>{d}</div>
                    ))}
                    {Array.from({ length: first }, (_, i) => (
                      <div key={'e' + i} className="cd emp" />
                    ))}
                    {Array.from({ length: total }, (_, i) => {
                      const d   = i + 1;
                      const k   = dateKey(y, m, d);
                      const dow = new Date(y, m, d).getDay();
                      const isWk  = dow === 0 || dow === 6;
                      const isSel = selDate === k;
                      const evs   = events.filter(e => e.date === k);
                      const vis   = evs.slice(0, 3);
                      const extra = evs.length - 3;
                      return (
                        <div key={k}
                          className={`cd${isSel ? ' sel' : ''}${isWk ? ' wk' : ''}`}
                          onClick={() => pickDate(k)}>
                          <span className="dn">{d}</span>
                          <div className="evs">
                            {vis.map(ev => {
                              const lbl = ev.type === 'exam' && ev.time
                                ? `${ev.subject} ${ev.time}` : ev.subject;
                              return (
                                <span key={ev.id} className={`ep ${ev.type}`}
                                  title={`${ev.subject}${ev.time ? ' · ' + ev.time : ''}`}
                                  onClick={e => { e.stopPropagation(); startEdit(ev.id); }}>
                                  {lbl}
                                </span>
                              );
                            })}
                            {extra > 0 && <span className="more">+{extra} more</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {!isMobile && (
            <div className={`side-col${panelOpen ? '' : ' hidden'}`}>
              {panelContent}
            </div>
          )}
        </div>

        {isMobile && (
          <button className="fab" onClick={() => { setSheetOpen(true); setSelDate(null); }}>+</button>
        )}

        {isMobile && sheetOpen && (
          <>
            <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
            <div className="sheet">
              <div className="sheet-handle" />
              <div className="sheet-inner">{panelContent}</div>
            </div>
          </>
        )}
      </div>

      {/* Guest expiry popup — shown to signed-out users */}
      <GuestExpiryPopup />

      {/* Export modal */}
      {exportOpen && (
        <div className="exp-overlay" onClick={e => e.target === e.currentTarget && closeExport()}>
          <div className="exp-modal">
            <p className="card-title">Export calendar</p>
            <p className="exp-modal-sub">
              <strong>PDF</strong> — opens print dialog. Set paper to <strong>A4 portrait</strong> and
              turn off <em>Headers and footers</em>.<br />
              <strong>JPG</strong> — downloads a high-resolution A4 image.
            </p>
            <div className="exp-opts">
              <div className="exp-opt" onClick={doPdf}>
                <div className="exp-opt-icon">&#128196;</div>
                <span className="exp-opt-label">PDF</span>
                <span className="exp-opt-desc">Best for printing</span>
              </div>
              <div className="exp-opt" onClick={doJpg}>
                <div className="exp-opt-icon">&#128444;</div>
                <span className="exp-opt-label">JPG</span>
                <span className="exp-opt-desc">Best for sharing</span>
              </div>
            </div>
            {exportMsg && <p className="exp-progress">{exportMsg}</p>}
            <button className="exp-cancel" onClick={closeExport}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
