// The Ball's music. Each dance style can have its own song, and the songs crossfade between waltzes.
// trim matches each song's loudness to the flamenco theme, measured with a loudness check.
const SONGS = {
  Flamenco: { file: "assets/bailon-de-palmas.mp3", trim: 1 },
  Waltz: { file: "assets/bailon-de-tres-accordion.mp3", trim: 0.87 },
};
const FIRST_SONG = "Flamenco";
const SHOE = "assets/reference/encore-tap.wav";
export const BAR_MS = 985;   // one 1-2-3 bar, used to time the dancers
const FULL = 0.62, QUIET = 0.26, FADE = 0.4, CROSSFADE = 1.2;
const SHOE_GAIN = 1.6, DIP = 0.18, DIP_HOLD = 0.8, DIP_RETURN = 0.55;
let shoePlays = 0, princeHits = 0, clapPlays = 0;
const sfxPlayed = {};
const SILENT_TEST = new URLSearchParams(location.search).has("silent");   // runs all audio without being heard
let ctx = null, master = null, songBus = null, meter = null, shoeBuffer = null, current = null, wanted = false, muted = false, level = FULL, request = 0;
const buffers = {}, offsets = {};

function ensureContext() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted || SILENT_TEST ? 0 : 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  meter = ctx.createAnalyser();
  meter.fftSize = 2048;
  songBus = ctx.createGain();
  songBus.connect(meter);
  songBus.connect(master);
  master.connect(limiter).connect(ctx.destination);
  fetch(SHOE).then((r) => r.arrayBuffer()).then((data) => ctx.decodeAudioData(data)).then((audio) => { shoeBuffer = audio; });
}

// Browsers can pause audio after a tab switch or a device change, so any click wakes it again.
document.addEventListener("pointerdown", () => { if (ctx && ctx.state !== "running") ctx.resume(); });

function loadSong(style) {
  buffers[style] = buffers[style] || fetch(SONGS[style].file).then((r) => r.arrayBuffer()).then((data) => ctx.decodeAudioData(data));
  return buffers[style];
}

const songLevel = () => level * (current ? SONGS[current.style].trim : 1);

function fade(gain, value, seconds) {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + seconds);
}

function leave(track, seconds) {
  offsets[track.style] = (ctx.currentTime - track.startedAt) % track.buffer.duration;
  fade(track.gain, 0, seconds);
  track.source.stop(ctx.currentTime + seconds);
}

// Switches to a style's song. Styles without a song leave the current one playing.
export async function playStyle(style) {
  if (!SONGS[style] || current?.style === style) return;
  ensureContext();
  const ticket = ++request;
  const buffer = await loadSong(style);
  if (ticket !== request || !wanted) return;
  const previous = current;
  if (previous) leave(previous, CROSSFADE);
  const offset = (offsets[style] || 0) % buffer.duration;
  const source = ctx.createBufferSource(), gain = ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = 0;
  source.connect(gain).connect(songBus);
  source.start(0, offset);
  current = { style, source, gain, buffer, startedAt: ctx.currentTime - offset };
  fade(gain, songLevel(), previous ? CROSSFADE : FADE);
}

// A plain audio element, ready to play over the song the moment Encore lands.
const shoe = new Audio(SHOE);
shoe.preload = "auto";

export function playShoe({ dip = true } = {}) {
  ensureContext();
  if (!muted) {
    if (shoeBuffer) {
      const source = ctx.createBufferSource(), boost = ctx.createGain();
      source.buffer = shoeBuffer;
      boost.gain.value = SHOE_GAIN;
      source.connect(boost).connect(master);
      source.start();
      shoePlays += 1;
    } else {
      shoe.currentTime = 0;
      shoe.volume = 1;
      shoe.play().then(() => { shoePlays += 1; }).catch(() => {});
    }
  }
  if (dip) dipSong();
}

// The song dips for a moment so a big sound sits on top, without stopping.
function dipSong() {
  if (!current) return;
  const now = ctx.currentTime, gain = current.gain.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(songLevel() * DIP, now + 0.03);
  gain.setValueAtTime(songLevel() * DIP, now + DIP_HOLD);
  gain.linearRampToValueAtTime(songLevel(), now + DIP_HOLD + DIP_RETURN);
}

// A placeholder made in code: a low impact, a sharp whoosh and a dark chord.
export function playPrinceHit() {
  ensureContext();
  ctx.resume();
  dipSong();
  if (muted) return;
  princeHits += 1;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.95;
  out.connect(master);

  const thud = ctx.createOscillator(), thudGain = ctx.createGain();
  thud.type = "sine";
  thud.frequency.setValueAtTime(170, now);
  thud.frequency.exponentialRampToValueAtTime(42, now + 0.32);
  thudGain.gain.setValueAtTime(1, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  thud.connect(thudGain).connect(out);
  thud.start(now);
  thud.stop(now + 0.6);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const whoosh = ctx.createBufferSource(), band = ctx.createBiquadFilter(), whooshGain = ctx.createGain();
  whoosh.buffer = noise;
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(3200, now);
  band.frequency.exponentialRampToValueAtTime(320, now + 0.4);
  whooshGain.gain.setValueAtTime(0.5, now);
  whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  whoosh.connect(band).connect(whooshGain).connect(out);
  whoosh.start(now);

  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 1500;
  low.connect(out);
  [110, 130.8, 164.8, 220].forEach((freq) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain).connect(low);
    osc.start(now);
    osc.stop(now + 0.85);
  });
}

// A placeholder made in code: two sharp flamenco claps.
export function playClap() {
  ensureContext();
  ctx.resume();
  dipSong();
  if (muted) return;
  clapPlays += 1;
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  [0, 0.17].forEach((start, index) => {
    // A clap is a few tiny bursts close together, then a short ring.
    [0, 0.012, 0.024].forEach((burst) => {
      const when = ctx.currentTime + start + burst;
      const source = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = noise;
      band.type = "bandpass";
      band.frequency.value = 1500;
      band.Q.value = 1.1;
      const peak = (index ? 1.5 : 1.15) * (burst === 0.024 ? 1 : 0.65);
      gain.gain.setValueAtTime(peak, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + (burst === 0.024 ? 0.13 : 0.012));
      source.connect(band).connect(gain).connect(master);
      source.start(when);
      source.stop(when + 0.16);
    });
  });
}

export function startMusic() {
  ensureContext();
  ctx.resume();
  wanted = true;
  Object.keys(SONGS).forEach(loadSong);
  return playStyle(current?.style || FIRST_SONG);
}

export function setQuiet(quiet) {
  level = quiet ? QUIET : FULL;
  if (current) fade(current.gain, songLevel(), FADE);
}

export function stopMusic() {
  wanted = false;
  request += 1;
  if (!current) return;
  leave(current, FADE);
  current = null;
}

export function resetMusic() {
  Object.keys(offsets).forEach((style) => { offsets[style] = 0; });
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  return muted;
}

// Interface sounds, all made in code so they match. Each one is short and sits under the music.
function tone(freq, length, volume, type = "sine", delay = 0, endFreq = 0) {
  const start = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + length);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

function swish(length, volume, from, to, delay = 0) {
  const start = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
  source.buffer = buffer;
  band.type = "bandpass";
  band.Q.value = 1;
  band.frequency.setValueAtTime(from, start);
  band.frequency.exponentialRampToValueAtTime(to, start + length);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + length * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(band).connect(gain).connect(master);
  source.start(start);
}

const arpeggio = (notes, gap, length, volume) => notes.forEach((f, i) => tone(f, length, volume, "triangle", i * gap));
const SOUNDS = {
  click: () => { tone(520, 0.05, 0.1, "triangle"); swish(0.03, 0.05, 2600, 1800); },
  hover: () => tone(1250, 0.025, 0.03),
  cardHover: () => { swish(0.07, 0.06, 2400, 4200); tone(880, 0.04, 0.035, "triangle"); },
  swoosh: () => { swish(0.13, 0.2, 450, 2800); swish(0.2, 0.17, 2800, 500, 0.11); },
  cardPlay: () => { swish(0.16, 0.2, 3200, 700); tone(392, 0.09, 0.09, "triangle", 0.05); },
  charm: () => tone(660, 0.13, 0.08, "sine", 0.06, 990),
  poise: () => { tone(1760, 0.2, 0.05); tone(2350, 0.26, 0.035); },
  block: () => { tone(1320, 0.28, 0.1, "triangle"); tone(1980, 0.34, 0.06); swish(0.08, 0.1, 3000, 1500); },
  draw: () => [0, 0.07, 0.14].forEach((d) => swish(0.06, 0.09, 3400, 2000, d)),
  measure: () => { tone(294, 0.16, 0.13, "triangle"); tone(220, 0.22, 0.1, "triangle", 0.1); },
  answer: () => arpeggio([659, 988], 0.09, 0.22, 0.11),
  recover: () => tone(330, 0.28, 0.1, "sine", 0, 494),
  fluster: () => tone(520, 0.3, 0.09, "sawtooth", 0, 260),
  falter: () => { tone(180, 0.5, 0.2, "sawtooth", 0, 70); swish(0.3, 0.14, 900, 200); },
  pass: () => arpeggio([523, 659, 784], 0.1, 0.32, 0.12),
  swept: () => arpeggio([523, 659, 784, 1047, 1319], 0.09, 0.5, 0.13),
  fail: () => arpeggio([392, 330, 262], 0.15, 0.38, 0.11),
  banner: () => swish(0.28, 0.14, 700, 2600),
  popupClose: () => swish(0.16, 0.1, 2600, 800),
  toggleOn: () => tone(740, 0.08, 0.09, "triangle", 0, 988),
  toggleOff: () => tone(740, 0.08, 0.08, "triangle", 0, 494),
  // Luna's little "mrrp" each time her bubble moves on.
  coach: () => { tone(620, 0.09, 0.15, "triangle", 0, 1040); tone(1040, 0.14, 0.13, "triangle", 0.08, 720); },
  rivalStep: () => tone(247, 0.14, 0.09, "triangle"),
};

export function sfx(name) {
  if (!ctx) return;
  sfxPlayed[name] = (sfxPlayed[name] || 0) + 1;
  if (!muted) SOUNDS[name]();
}

// Buttons sound on press and on hover wherever they are, so new buttons get sounds automatically.
let lastHover = null;
document.addEventListener("pointerdown", () => ensureContext(), true);
document.addEventListener("click", (event) => {
  const target = event.target.closest("button, summary");
  if (target && !target.matches(".card, .tile, :disabled")) sfx("click");
}, true);
document.addEventListener("pointerover", (event) => {
  const target = event.target.closest("button, summary");
  if (target === lastHover) return;
  lastHover = target;
  if (target && !target.matches(".card, :disabled")) sfx("hover");
});

function note(freq, start, length, volume) {
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.02);
}
export function playChime(notes = [659.3, 830.6, 987.8]) {
  if (ctx) notes.forEach((f, i) => note(f, ctx.currentTime + i * 0.09, 0.35, 0.09));
}
function signal() {
  if (!meter) return 0;
  const data = new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(data);
  return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
}
export const musicState = () => ({ signal: +signal().toFixed(4), gain: current ? +current.gain.gain.value.toFixed(3) : 0, muted, song: current?.style || "", running: ctx?.state, level, shoePlays, princeHits, clapPlays, sfxPlayed, shoeReady: shoe.readyState });
