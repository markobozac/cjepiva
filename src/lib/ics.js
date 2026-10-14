/**
 * Calendar export helpers: RFC 5545 .ics generation and Google Calendar links.
 */
import { addDays } from './dates.js';

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

function icsStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes()
  )}${pad(d.getUTCSeconds())}Z`;
}

/** Escape TEXT values per RFC 5545 §3.3.11. */
function esc(text = '') {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (UTF-8 aware, never splits a multi-byte char). */
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * @param {Array} events [{ uid, title, description, start: Date, end?: Date, yearly?: boolean }]
 * @param {string} calName
 */
export function buildICS(events, calName) {
  const stamp = icsStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cjepiva.hr//Vodic za cijepljenje//HR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  for (const e of events) {
    // All-day event; DTEND is exclusive, so +1 day.
    const endExclusive = addDays(e.start, 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@cjepiva.hr`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
      `DTEND;VALUE=DATE:${icsDate(endExclusive)}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.description)}`,
      'TRANSP:TRANSPARENT'
    );
    if (e.yearly) lines.push('RRULE:FREQ=YEARLY;COUNT=10');
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(e.title)}`,
      'TRIGGER:-P3D',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadFile(content, filename, mime = 'text/calendar;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Google Calendar "add event" template link for an all-day event. */
export function googleCalendarUrl({ title, description, start, yearly }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${icsDate(start)}/${icsDate(addDays(start, 1))}`,
    details: description,
  });
  if (yearly) params.set('recur', 'RRULE:FREQ=YEARLY;COUNT=10');
  return `https://calendar.google.com/calendar/render?${params}`;
}
