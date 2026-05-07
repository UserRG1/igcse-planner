/**
 * Step 0 — Location & Country Select
 * Auto-detects country via ipapi.co, lets user confirm or search from full list.
 */
import { useState, useEffect, useRef } from 'react';
import { loadCountries } from '../utils/timetable.js';
import { usePlanner } from '../context/PlannerContext.jsx';
import AuthHeaderButton from '../components/AuthHeaderButton.jsx';

export default function LocationSelect() {
  const { setCountry, setZone, setStep, setGeoData } = usePlanner();

  const [countries, setCountries]         = useState([]);
  const [detected, setDetected]           = useState(null);   // { name, code, zone }
  const [detecting, setDetecting]         = useState(true);
  const [query, setQuery]                 = useState('');
  const [selected, setSelected]           = useState(null);   // country object
  const [dropOpen, setDropOpen]           = useState(false);
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  // Load countries
  useEffect(() => {
    loadCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  // IP geolocation
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        setDetecting(false);
        setGeoData(data); // store full payload for profile saving
        if (data?.country_code) {
          setDetected({ code: data.country_code, name: data.country_name });
        }
      })
      .catch(() => setDetecting(false));
  }, []);

  // Once both countries and detected are available, find the match
  const detectedCountry = detected && countries.length
    ? (countries.find(c => c.code === detected.code) || null)
    : null;

  // Filtered list
  const filtered = query.length < 1
    ? countries
    : countries.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  function selectCountry(c) {
    setSelected(c);
    setQuery(c.name);
    setDropOpen(false);
  }

  function handleConfirm() {
    const chosen = selected || detectedCountry;
    if (!chosen) return;
    setCountry(chosen);
    setZone(chosen.zone);
    setStep(1);
  }

  function handleUseDetected() {
    if (!detectedCountry) return;
    setSelected(detectedCountry);
    setQuery(detectedCountry.name);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeCountry = selected || detectedCountry;

  return (
    <div className="page vs-page">
      <div className="wrap">
        <div className="vs-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="title">IGCSE Exam Planner</p>
              <p className="vs-tagline">Cambridge M/J 2026 · April – June</p>
            </div>
            <AuthHeaderButton />
          </div>
        </div>

        <p className="vs-prompt">Where are you sitting your exams?</p>
        <p className="vs-hint">
          We'll use your country to find the right Cambridge zone and timetable.
          Your data stays in your browser — nothing is sent to any server.
        </p>

        {/* Detected country suggestion */}
        {!detecting && detectedCountry && !selected && (
          <div className="detect-bar">
            <span className="zone-icon" style={{ marginRight: 8 }}>📍</span>
            <span>
              Detected: <strong>{detectedCountry.name}</strong>
              &nbsp;·&nbsp;Zone {detectedCountry.zone}
            </span>
            <button className="detect-use-btn" onClick={handleUseDetected}>
              Use this
            </button>
          </div>
        )}

        {detecting && (
          <div className="detect-bar">
            <span className="zone-icon" style={{ marginRight: 8 }}>📡</span>
            <span style={{ color: 'var(--t3)' }}>Detecting your location…</span>
          </div>
        )}

        {/* Country search dropdown */}
        <div className="country-picker">
          <label className="fl" style={{ marginBottom: 6 }}>Country</label>
          <div className="country-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="country-input"
              placeholder="Search country…"
              value={query}
              onChange={e => { setQuery(e.target.value); setDropOpen(true); setSelected(null); }}
              onFocus={() => setDropOpen(true)}
              autoComplete="off"
            />
            {query && (
              <button className="country-clear" onClick={() => { setQuery(''); setSelected(null); setDropOpen(false); }}>
                ×
              </button>
            )}
          </div>
          {dropOpen && filtered.length > 0 && (
            <div className="country-drop" ref={dropRef}>
              {filtered.map(c => (
                <div
                  key={c.code}
                  className={`country-opt${selected?.code === c.code ? ' active' : ''}`}
                  onMouseDown={() => selectCountry(c)}
                >
                  <span className="country-opt-name">{c.name}</span>
                  <span className="country-opt-zone">Zone {c.zone}</span>
                </div>
              ))}
            </div>
          )}
          {dropOpen && filtered.length === 0 && query && (
            <div className="country-drop">
              <div className="country-opt-empty">No results for "{query}"</div>
            </div>
          )}
        </div>

        {/* Selected indicator */}
        {activeCountry && (
          <div className="selected-country-bar">
            <span>✓</span>
            <span>
              <strong>{activeCountry.name}</strong>
              &nbsp;→&nbsp;Zone {activeCountry.zone}
            </span>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <button
            className="next-btn"
            onClick={handleConfirm}
            disabled={!activeCountry}
            style={{ opacity: activeCountry ? 1 : 0.45 }}
          >
            Continue →
          </button>
        </div>

        <p className="vs-footer-note" style={{ marginTop: 20 }}>
          Can't find your country? Select the closest zone manually on the next screen.
          The calendar is fully editable — you can always adjust exam dates by hand.
        </p>
      </div>
    </div>
  );
}
