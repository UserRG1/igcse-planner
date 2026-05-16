/**
 * Programmatic Canvas 2D JPG export — no html2canvas.
 * Draws a full A4 (300 dpi) calendar image for any curriculum date range.
 */
import { dateKey } from './timetable.js';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function ctext(ctx, t, x, y, mw) {
  if (ctx.measureText(t).width <= mw) { ctx.fillText(t, x, y); return; }
  let s = t;
  while (s.length > 0 && ctx.measureText(s + '\u2026').width > mw) s = s.slice(0, -1);
  ctx.fillText(s + '\u2026', x, y);
}

const FONT = 'system-ui,-apple-system,sans-serif';

/**
 * @param {Array}  events        - array of event objects
 * @param {Array}  months        - from getCalendarMonths(curriculum), e.g. [{y,m,name,id}]
 * @param {string} currShortLabel - e.g. "Cambridge IGCSE", "Edexcel IAL", "IB DP"
 * @param {string} zoneLabel     - e.g. "Zone 4" or "" for non-Cambridge
 */
export function drawCalendarToCanvas(events, months, currShortLabel = 'Exam Planner', zoneLabel = '') {
  // Build dynamic title: "April – June 2026" or "May – June 2026" etc.
  const firstName = months[0].name.split(' ')[0];
  const lastName  = months[months.length - 1].name.split(' ')[0];
  const titleStr  = months.length > 1
    ? `${firstName} \u2013 ${lastName} 2026`
    : `${firstName} 2026`;

  // Build subtitle
  const subtitleParts = ['Exam Planner', currShortLabel];
  if (zoneLabel) subtitleParts.push(zoneLabel);
  const subtitleStr = subtitleParts.join('  \u00b7  ');

  // Scale canvas height proportionally for 2- or 3-month layouts
  const A4W   = 2480;
  const MG    = 100;
  const cw    = A4W - MG * 2;

  const CELL_H = 182, MNH = 50, DHH = 40, MGAP = 26;
  const cellW  = Math.floor(cw / 7);

  // Pre-calculate total height needed
  let neededH = MG + 78 + 52 + 64; // title + subtitle + legend
  months.forEach((md, mi) => {
    if (mi > 0) neededH += MGAP;
    neededH += MNH + DHH; // month name + day headers
    const first = new Date(md.y, md.m, 1).getDay();
    const total = new Date(md.y, md.m + 1, 0).getDate();
    neededH += Math.ceil((first + total) / 7) * CELL_H;
  });
  neededH += MG; // bottom margin

  const A4H = Math.max(3508, neededH);

  const cv  = document.createElement('canvas');
  cv.width  = A4W;
  cv.height = A4H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#F1EFE8';
  ctx.fillRect(0, 0, A4W, A4H);

  const gx = MG + Math.floor((cw - cellW * 7) / 2);
  let cy = MG;

  // Title
  ctx.fillStyle = '#2C2C2A';
  ctx.font = `500 62px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(titleStr, MG, cy + 56);
  cy += 78;

  // Subtitle
  ctx.fillStyle = '#5F5E5A';
  ctx.font = `400 32px ${FONT}`;
  ctx.fillText(subtitleStr, MG, cy + 32);
  cy += 52;

  // Legend
  [['Exam', '#A32D2D', '#FCEBEB'], ['Study / note', '#185FA5', '#E6F1FB']].reduce((ox, [lbl, fg, bg]) => {
    ctx.font = `500 26px ${FONT}`;
    const tw = ctx.measureText(lbl).width, pw = tw + 36;
    ctx.fillStyle = bg; rrect(ctx, MG + ox, cy, pw, 40, 6); ctx.fill();
    ctx.fillStyle = fg; ctx.fillText(lbl, MG + ox + 18, cy + 27);
    return ox + pw + 14;
  }, 0);
  cy += 64;

  months.forEach((md, mi) => {
    if (mi > 0) cy += MGAP;

    // Month heading
    ctx.fillStyle = '#2C2C2A';
    ctx.font = `500 38px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(md.name, MG, cy + 36);
    cy += MNH;

    // Day headers
    DAYS.forEach((d, di) => {
      ctx.fillStyle = (di === 0 || di === 6) ? '#C4C2B8' : '#888780';
      ctx.font = `500 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(d, gx + di * cellW + cellW / 2, cy + 26);
    });
    cy += DHH;

    const first = new Date(md.y, md.m, 1).getDay();
    const total = new Date(md.y, md.m + 1, 0).getDate();
    let col = first, row = 0;

    for (let d = 1; d <= total; d++) {
      const dow  = new Date(md.y, md.m, d).getDay();
      const isWk = dow === 0 || dow === 6;
      const cx2  = gx + col * cellW;
      const cy2  = cy + row * CELL_H;
      const k    = dateKey(md.y, md.m, d);
      const evs  = events.filter(e => e.date === k);
      const vis  = evs.slice(0, 4);
      const extra = evs.length - 4;

      // Cell background
      ctx.fillStyle   = isWk ? '#FAF8F4' : '#FFFFFF';
      ctx.strokeStyle = 'rgba(0,0,0,0.09)';
      ctx.lineWidth   = 1.5;
      rrect(ctx, cx2 + 1, cy2 + 1, cellW - 2, CELL_H - 2, 7);
      ctx.fill(); ctx.stroke();

      // Day number
      ctx.fillStyle = isWk ? '#B8B6AE' : '#888780';
      ctx.font = `500 22px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(String(d), cx2 + 7, cy2 + 20);

      // Events
      vis.forEach((ev, ei) => {
        const py = cy2 + 26 + ei * 36, px = cx2 + 5, pw = cellW - 10;
        ctx.fillStyle = ev.type === 'exam' ? '#FCEBEB' : '#E6F1FB';
        rrect(ctx, px, py, pw, 30, 3); ctx.fill();
        ctx.fillStyle = ev.type === 'exam' ? '#993C1D' : '#185FA5';
        ctx.font = `400 17px ${FONT}`;
        const lbl = ev.type === 'exam' && ev.time ? `${ev.subject} ${ev.time}` : ev.subject;
        ctext(ctx, lbl, px + 5, py + 20, pw - 10);
      });

      if (extra > 0) {
        ctx.fillStyle = '#AEACA4';
        ctx.font = `400 15px ${FONT}`;
        ctx.fillText('+' + extra + ' more', cx2 + 7, cy2 + 26 + vis.length * 36 + 14);
      }

      col++; if (col === 7) { col = 0; row++; }
    }

    cy += Math.ceil((first + total) / 7) * CELL_H;
  });

  return cv;
}
