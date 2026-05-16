/**
 * Step 0 — Curriculum Select
 * Cambridge IGCSE → zone flow (step 1 → 'zone' → step 2)
 * All others → straight to SubjectSelect (step 2)
 */
import { usePlanner } from '../context/PlannerContext.jsx';
import AuthHeaderButton from '../components/AuthHeaderButton.jsx';
import Footer from '../components/Footer.jsx';

const GROUPS = [
  {
    group: 'Cambridge (CAIE)',
    color: '#185FA5',
    curricula: [
      {
        id: 'cambridge',
        name: 'Cambridge IGCSE',
        desc: 'International General Certificate of Secondary Education',
        detail: 'Zone-based timetable · April – June 2026 · Zones 1–6 & UK',
        emoji: '🎓',
        note: null,
      },
    ],
  },
  {
    group: 'Pearson Edexcel',
    color: '#0066CC',
    curricula: [
      {
        id: 'edexcel-igcse',
        name: 'Edexcel International GCSE',
        desc: 'Codes: 4XX1 · for UK and international centres',
        detail: 'Single global timetable · May – June 2026',
        emoji: '📘',
        note: 'Same dates for all centres worldwide',
      },
      {
        id: 'edexcel-gcse',
        name: 'Edexcel GCSE (UK & International)',
        desc: 'Codes: 1XX0 · UK & international centres',
        detail: 'Same global timetable · May – June 2026',
        emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        note: 'Same timetable worldwide · different subject codes from International GCSE (which starts with 4)',
      },
      {
        id: 'edexcel-ial',
        name: 'Edexcel International A Level',
        desc: 'Codes: WXX · for UK and international centres',
        detail: 'Single global timetable · May – June 2026',
        emoji: '📗',
        note: 'Same dates for all centres worldwide',
      },
    ],
  },
  {
    group: 'IB Diploma Programme',
    color: '#009A44',
    curricula: [
      {
        id: 'ib-dp',
        name: 'IB Diploma Programme',
        desc: 'HL and SL papers across all six subject groups',
        detail: 'Zones A, B & C · same dates · April – May 2026',
        emoji: '🌍',
        note: 'All IB zones share identical exam dates — only local start times differ',
      },
    ],
  },
];

export default function CurriculumSelect() {
  const { setCurriculum, setStep, setZone, setCountry, setSelectedCodes, setEvents } = usePlanner();

  function handleSelect(id) {
    setCurriculum(id);
    setZone(null);
    setCountry(null);
    setSelectedCodes(new Set());
    setEvents([]);
    setStep(id === 'cambridge' ? 1 : 2);
  }

  return (
    <div className="page vs-page">
      <div className="wrap">
        <div className="vs-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="title">Exam Planner</p>
              <p className="vs-tagline">2026 · Plan your exam schedule</p>
            </div>
            <AuthHeaderButton />
          </div>
        </div>

        <p className="vs-prompt">Which curriculum are you studying?</p>
        <p className="vs-hint">Select your exam board and qualification to load the correct official timetable.</p>

        {GROUPS.map(({ group, color, curricula }) => (
          <div key={group} className="curr-group">
            <div className="curr-group-label" style={{ color }}>
              {group}
            </div>
            <div className="curriculum-grid">
              {curricula.map(c => (
                <button
                  key={c.id}
                  className="curriculum-card"
                  onClick={() => handleSelect(c.id)}
                >
                  <div className="curriculum-card-top">
                    <span className="curriculum-emoji">{c.emoji}</span>
                  </div>
                  <div className="curriculum-name">{c.name}</div>
                  <div className="curriculum-desc">{c.desc}</div>
                  <div className="curriculum-detail">{c.detail}</div>
                  {c.note && (
                    <div className="curriculum-note">ℹ {c.note}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="vs-footer-note" style={{ marginTop: 24 }}>
          Not sure which to pick? Your exam board is printed on your entry confirmation letter or timetable from school. Check your subject codes — Cambridge codes start with 0, Edexcel International with 4, Edexcel UK with 1, IB has no numeric code.
        </p>
        <Footer />
      </div>
    </div>
  );
}
