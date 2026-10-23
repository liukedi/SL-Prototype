// Scenario clock. The test scenario takes place in the evening, so "now" starts at
// CONFIG.scenarioTime (today, e.g. 18:30) when the page opens and then runs normally.
// Everything time-related uses it: status bar, departures, "Depart now", journeys.
// Set CONFIG.scenarioTime to null to use the computer's real time instead.
import { CONFIG } from './config.js';

const realStart = Date.now();
const start = (() => {
  if (!CONFIG.scenarioTime) return realStart;
  const [h, m] = CONFIG.scenarioTime.split(':').map(Number);
  const d = new Date(realStart);
  d.setHours(h, m, 0, 0);
  return d.getTime();
})();

export const now = () => new Date(start + (Date.now() - realStart));
export const nowMs = () => start + (Date.now() - realStart);
