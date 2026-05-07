/**
 * Step 0b — Zone Confirmation
 * Shows the detected zone, lets user confirm or override.
 * Supports numeric zones 1–6 and the special "uk" zone.
 */
import { useState } from 'react';
import { usePlanner } from '../context/PlannerContext.jsx';
import { ZONE_INFO } from '../utils/timetable.js';
import AuthHeaderButton from '../components/AuthHeaderButton.jsx';

const ZONE_KEYS = [1, 2, 3, 'uk', 4, 5, 6];

export default function ZoneConfirm() {
  const { country, zone, setZone, setStep } = usePlanner();
  const [manualMode, setManualMode] = useState(false);
  const [manualZone, setManualZone] = useState(zone);

  const confirmedZone = manualMode ? manualZone : zone;
  const info = ZONE_INFO[confirmedZone];

  function handleConfirm() {
    setZone(confirmedZone);
    setStep(2);
  }

  function handleBack() {
    setStep(0);
  }

  const zoneLabel = confirmedZone === 'uk' ? 'UK' : `Zone ${confirmedZone}`;

  return (
    <div className="page vs-page">
      <div className="wrap">
        <div className="hdr">
          <div>
            <p className="title">Confirm your zone</p>
            <p className="sub">Cambridge M/J 2026</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AuthHeaderButton />
            <button className="link-btn" onClick={handleBack}>← Country</button>
          </div>
        </div>

        {!manualMode ? (
          <>
            <div className="zone-confirm-card">
              <div className="zone-confirm-num">{info?.label}</div>
              <div className="zone-confirm-regions">{info?.regions}</div>
              {country && (
                <div className="zone-confirm-based">
                  Based on: <strong>{country.name}</strong>
                </div>
              )}
              <div className="zone-confirm-variants">
                Papers available:&nbsp;
                {info?.variants.map(v => (
                  <span key={v} className="variant-pill">V{v}</span>
                ))}
                {confirmedZone === 'uk' && (
                  <span style={{fontSize:10,color:'var(--t3)',marginLeft:6}}>
                    + UK-specific subjects (Latin, Swahili, First Language French/German/Thai/Turkish etc.)
                  </span>
                )}
              </div>
            </div>

            <div className="zone-confirm-actions">
              <button className="next-btn" onClick={handleConfirm}>
                Yes, continue with {zoneLabel} →
              </button>
              <button
                className="link-btn"
                style={{ marginTop: 12, display: 'block' }}
                onClick={() => setManualMode(true)}
              >
                No, choose a different zone
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16 }}>
              Select your Cambridge zone manually:
            </p>
            <div className="zone-manual-grid">
              {ZONE_KEYS.map(z => {
                const zi = ZONE_INFO[z];
                const isUk = z === 'uk';
                return (
                  <div
                    key={z}
                    className={`zone-manual-card${manualZone === z ? ' sel' : ''}${isUk ? ' uk' : ''}`}
                    onClick={() => setManualZone(z)}
                  >
                    <div className="zone-manual-num">{zi.label}</div>
                    <div className="zone-manual-regions">{zi.regions}</div>
                    <div style={{ marginTop: 6 }}>
                      {zi.variants.map(v => (
                        <span key={v} className="variant-pill">V{v}</span>
                      ))}
                    </div>
                    {isUk && (
                      <div style={{fontSize:9,color:'var(--study-fg)',marginTop:5}}>
                        Includes Latin, Swahili &amp; more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="next-btn" onClick={handleConfirm}>
                Confirm {manualZone === 'uk' ? 'UK' : `Zone ${manualZone}`} →
              </button>
              <button className="link-btn" onClick={() => setManualMode(false)}>
                Cancel
              </button>
            </div>
          </>
        )}

        <p className="vs-footer-note" style={{ marginTop: 20 }}>
          You can return here any time to change your zone. The calendar is fully editable
          if you are sitting exams across multiple zones.
        </p>
      </div>
    </div>
  );
}
