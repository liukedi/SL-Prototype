// Shared markup for a departure row (favourite cards + stop page).
import { formatTime } from './departures.js';

export const CHEVRON = '<svg class="chevron" viewBox="0 0 10 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m1.5 1.5 7 7-7 7"/></svg>';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Line badge; its shape depends on the mode (boats: notched flag, tram/light rail: slanted).
export const lineBadgeHtml = (d) =>
  `<span class="line-badge line-badge--${esc(d.mode)}" style="background:${esc(d.color)}">${esc(d.line)}</span>`;

export const departureRowHtml = (d, now) => `
  <div class="departure">
    ${lineBadgeHtml(d)}
    <span class="departure__dest">${esc(d.destination)}</span>
    <span class="departure__time">${esc(formatTime(d.minutes, now))}</span>${CHEVRON}
  </div>`;

const WARN = '<svg width="26" height="24" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 2.2 22.2 19.8H1.8z" fill="#f59a3c" stroke="#f59a3c" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8.4v5.4" stroke="#2b221b" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.2" fill="#2b221b"/></svg>';

// Orange service-notice box (stop page, journey details).
export const noticeHtml = (text) => `<div class="notice">${WARN}<p>${esc(text)}</p></div>`;
// Small ⚠ after a line badge (journey results).
export const noticeMarkHtml = '<span class="notice-mark" aria-label="Service notice">' + WARN + '</span>';
