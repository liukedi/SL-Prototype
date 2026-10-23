// Ambient "hotel room" sound for the test scenario, generated with the Web Audio API
// (no audio file): soft brown noise (ventilation / distant traffic through the window),
// a faint 50 Hz mains hum, and a very slow swell so it doesn't sound static.
// Browsers only allow sound after a user gesture, so it starts on the first click / key.
// The on/off choice is remembered per browser.

const PREF_KEY = 'sl-proto-sound';
const VOLUME = 0.03; // overall level (0–1): kept very quiet, just a hint of room tone

function brownNoiseBuffer(ctx, seconds = 6) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // integrated white noise
    data[i] = last * 3.5;
  }
  // Cross-fade the loop seam so the loop doesn't click.
  const fade = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[i] = data[i] * t + data[data.length - fade + i] * (1 - t);
  }
  return buffer;
}

function buildGraph(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Room tone: brown noise, low-passed.
  const noise = ctx.createBufferSource();
  noise.buffer = brownNoiseBuffer(ctx);
  noise.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 700;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.9;
  noise.connect(lowpass).connect(noiseGain).connect(master);

  // Slow swell (ventilation cycling), ±15 %.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.15;
  lfo.connect(lfoDepth).connect(noiseGain.gain);

  // Faint mains hum (50 Hz + harmonic).
  const hum = ctx.createGain();
  hum.gain.value = 0.015;
  for (const [f, g] of [[50, 1], [100, 0.5]]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    const og = ctx.createGain();
    og.gain.value = g;
    osc.connect(og).connect(hum);
    osc.start();
  }
  hum.connect(master);

  noise.start();
  lfo.start();
  return master;
}

export function initAmbience(button) {
  let enabled = true;
  try { enabled = localStorage.getItem(PREF_KEY) !== 'off'; } catch { /* storage blocked */ }
  let ctx = null;
  let master = null;

  function apply() {
    button.classList.toggle('is-muted', !enabled);
    button.setAttribute('aria-pressed', String(enabled));
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(enabled ? VOLUME : 0, now + (enabled ? 2 : 0.4)); // fade
  }

  // Create / resume the audio on the first user gesture (browser autoplay rules).
  function start() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = buildGraph(ctx);
      window.slAudio = { ctx, master }; // for checking in the console
    }
    if (ctx.state === 'suspended') ctx.resume();
    apply();
  }
  const onFirstGesture = () => {
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
    start();
  };
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('keydown', onFirstGesture, true);

  button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch { /* ignore */ }
    start();
  });
  apply();
}
