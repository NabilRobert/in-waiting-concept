// The Ball as a Potionomics-style haggle. The rival dances first and sets the mark to beat,
// then you bring his Composure below it before the Music runs out.
import { makeRng, STANCES, TRAINERS, movesKnown } from "./rules.js";

// Three rounds of three waltzes. Every round is played, and your Hearts decide the ending.
export const ROUNDS = 3, WALTZES_PER_ROUND = 3;
export const WALTZES = [
  { composure: 92, pass: 46, lead: 3 }, { composure: 116, pass: 56, lead: 4 }, { composure: 138, pass: 66, lead: 4 },
  { composure: 120, pass: 56, lead: 4 }, { composure: 146, pass: 66, lead: 5 }, { composure: 172, pass: 76, lead: 5 },
  { composure: 148, pass: 66, lead: 5 }, { composure: 176, pass: 76, lead: 6 }, { composure: 204, pass: 86, lead: 6 },
];
export const MAX_HEARTS = WALTZES.length * 2;
const FALTER_MUSIC = 4, FALTER_FLUSTER = 12;
export const MUSIC_START = 10, HAND_SIZE = 5, FLUSTER_LIMIT = 24, FLUSTER_PER_CARD = 8;
export const DECK_LIMIT = 14;
export const BEATS = ["Step", "Turn", "Pose"];
const SWEPT_HEARTS = 2, PASS_HEARTS = 1, TANGO_TENSION = 1, WALTZ_POISE = 2, DUENDE_BONUS = 4, RHYTHM_BONUS = 1;
export const RIVAL_MOVES = ["Close embrace", "Whirl", "Promenade", "Stolen touch", "Final pose", "The dip"];
export const HEARTS_TO_WIN = 8;
export const RUIN = [[15, "Ruined", "The rival's scheming is exposed before the whole court, and her family's name goes with her."],
  [12, "Disgraced", "She leaves the Ball in tears, and the court is already whispering about why."],
  [HEARTS_TO_WIN, "Humbled", "She loses the prince, but keeps her name. She will not forget this."]];
const CARDS_FIRST = 4, CARDS_MAX = 5, FLOURISH = 7, RECOVER = 3, SWEPT_CALM = 4, BREATHER = 8;
const GUARDED_DAMAGE = 0.8, FORWARD_LEAD = 1.5, PROUD_RECOVERY = 3, ALOOF_PENALTY = 1;
export const STANCE_TEXT = {
  Forward: "His moves hit harder",
  Guarded: "Your cards Charm 20% less",
  Proud: "He regains 3 Composure each measure",
  Aloof: "1 fewer step each measure",
};

// Each move: name, damage, and what else it does. The style decides its role.
const MOVES = {
  Flamenco: [
    { name: "Heel stamp", dmg: 7, fluster: 1, draw: 1, text: "Big hit. +1 Fluster" },
    { name: "Whirl", dmg: 12, fluster: 1, text: "Big hit. +2 Fluster" },
    { name: "Final pose", dmg: 18, fluster: 2, text: "Huge hit. +3 Fluster" },
  ],
  Waltz: [
    { name: "Steady frame", dmg: 6, poise: 6, music: 1, draw: 1, text: "+6 Poise. +1 Music" },
    { name: "Graceful lead", dmg: 8, poise: 5, heal: 5, text: "+5 Poise. Heals 5 Fluster" },
    { name: "Promenade", dmg: 11, poise: 9, music: 2, text: "+9 Poise. +2 Music" },
  ],
  Tango: [
    { name: "Close embrace", dmg: 5, unbalance: 1, draw: 1, text: "Unbalance him: +1 to every later card" },
    { name: "Sharp turn", dmg: 6, unbalance: 2, text: "Unbalance him: +2 to every later card" },
    { name: "The dip", dmg: 8, unbalance: 3, text: "Unbalance him: +3 to every later card" },
  ],
  Minuet: [
    { name: "Lingering glance", dmg: 5, finish: 0.1, music: 1, draw: 1, text: "+10% of the Composure he's lost. +1 Music" },
    { name: "Soft whisper", dmg: 6, finish: 0.15, skip: true, text: "+15% of lost Composure. Cancels his next move" },
    { name: "Stolen touch", dmg: 8, finish: 0.3, text: "+30% of the Composure he's lost" },
  ],
};

const RHYTHMS = {
  Flamenco: { name: "Duende", rhythm: "Flamenco", text: "This waltz: Flamenco moves hit +4" },
  Waltz: { name: "Three-four time", rhythm: "Waltz", text: "This waltz: every card adds +2 Poise" },
  Tango: { name: "Tension", rhythm: "Tango", text: "This waltz: he gets +1 Unbalance each measure" },
  Minuet: { name: "Slow time", rhythm: "Minuet", text: "This waltz: each measure costs 1 less Music" },
};
const base = { dmg: 0, tag: "", style: "", rank: 0, kind: "", text: "", beat: "" };
export const FLUSTERED = () => ({ ...base, name: "Flustered", kind: "Flustered", dead: true, text: "She lost her nerve. Can't be played" });

// Every card is a Step, a Turn or a Pose. Playing them in that order is a phrase.
const BEAT_OF = {
  "Heel stamp": "Step", Whirl: "Turn", "Final pose": "Pose",
  "Steady frame": "Step", "Graceful lead": "Turn", Promenade: "Pose",
  "Close embrace": "Step", "Sharp turn": "Turn", "The dip": "Pose",
  "Lingering glance": "Step", "Soft whisper": "Turn", "Stolen touch": "Pose",
  "Prince's Favour": "Turn", "Deep curtsy": "Pose", "Final bow": "Pose", "Quick step": "Step", Encore: "Turn",
  "Propriety's Grace": "Step", "Allure's Grace": "Turn", "Nerve's Grace": "Pose",
  Duende: "Step", "Three-four time": "Step", Tension: "Step", "Slow time": "Step", "Find the rhythm": "Step",
};
const TAG_BEAT = { Debt: "Step", Family: "Step", Lover: "Turn", Faith: "Pose" };

export function makeDeck(build, run) {
  const deck = [];
  const whisper = (tag, label, value) => ({
    ...base, name: `${tag} ${label}`, tag, kind: label === "secret" ? "Secret" : "Hearsay",
    dmg: value * (tag === run.weakness ? 2 : 1), text: "Chain the same tag in a measure: +2 each",
  });
  for (const t of run.secrets) deck.push(whisper(t, "secret", 5));
  for (const t of run.hearsay) deck.push(whisper(t, "hearsay", 3));
  for (let i = 0; i < build.favours; i++) deck.push({ ...base, name: "Prince's Favour", kind: "Favour", dmg: 7, text: "A strong, simple hit" });
  for (const [who, lessons] of Object.entries(build.lessons)) {
    const style = TRAINERS[who][0];
    MOVES[style].slice(0, movesKnown(lessons)).forEach((m, i) => deck.push({ ...base, ...m, style, rank: i + 1, kind: `${style} move ${i + 1}` }));
  }
  deck.push({ ...base, name: "Deep curtsy", kind: "Closer", dmg: 5, closer: true, text: "Ends the waltz now. Unused Music calms her" });
  deck.push({ ...base, name: "Final bow", kind: "Closer", dmg: 8, closer: true, text: "A stronger finish. Ends the waltz now" });
  deck.push({ ...base, name: "Find the rhythm", kind: "Rhythm", dmg: 5, rhythm: "steady", text: "This waltz: every card hits +1" });
  for (const who of Object.keys(build.lessons)) {
    const style = TRAINERS[who][0];
    if (movesKnown(build.lessons[who]) >= 2) deck.push({ ...base, ...RHYTHMS[style], kind: "Rhythm", dmg: 5 });
  }
  deck.push({ ...base, name: "Quick step", kind: "Flourish", dmg: 5, steps: 2, draw: 1, text: "+2 steps this measure. Draw a card" });
  deck.push({ ...base, name: "Encore", kind: "Flourish", dmg: 5, music: 3, text: "So impressive the band plays on. +3 Music" });
  deck.push({ ...base, name: "Propriety's Grace", kind: "Grace", dmg: 5, poise: 4, music: 1, text: "+4 Poise. +1 Music" });
  deck.push({ ...base, name: "Allure's Grace", kind: "Grace", dmg: 5, text: "A clean hit" });
  deck.push({ ...base, name: "Nerve's Grace", kind: "Grace", dmg: 5, heal: 3, draw: 1, text: "Heals 3 Fluster. Draw a card" });
  return deck.map((c) => ({ ...c, beat: c.tag ? TAG_BEAT[c.tag] : BEAT_OF[c.name] }));
}

export function startBall(build, run, seed) {
  const rng = makeRng(seed + 2);
  const pool = makeDeck(build, run);
  const priority = (c) => (c.rank > 1 ? 5 : c.closer ? 4 : c.rhythm ? 3 : c.name === "Encore" || c.name === "Quick step" ? 3 : c.rank ? 2 : 1);
  const active = [...pool].sort((a, b) => priority(b) - priority(a) || b.dmg - a.dmg).slice(0, DECK_LIMIT);
  const stances = [];
  for (let i = 0; i < ROUNDS; i++) stances.push(...rng.sample(Object.keys(STANCES), WALTZES_PER_ROUND));
  return { rng, build, run, pool, active, stances, results: [], offset: 0, waltz: -1, fluster: Math.floor(build.suspicion / 10), dead: 0, result: "", swept: 0, closed: 0, hearts: 0, draw: [], discard: [], hand: [] };
}

function drawCards(s, n) {
  for (let i = 0; i < n; i++) {
    if (!s.draw.length) { s.draw = s.rng.shuffle(s.discard); s.discard = []; }
    if (!s.draw.length) return;
    s.hand.push(s.draw.pop());
  }
}

export function pickIntent(s) {
  const w = WALTZES[s.waltz];
  const roll = s.rng.random();
  if (roll < 0.6) return { type: "lead", value: w.lead + s.rng.randint(0, 3), text: "Takes the lead" };
  if (roll < 0.82) return { type: "recover", value: RECOVER, text: "Collects himself" };
  return { type: "pressure", value: 1, text: "Unsettles her" };
}

export function intentValue(s) {
  if (s.intent.type !== "lead") return s.intent.value;
  return Math.round(s.intent.value * (s.stance === "Forward" && !s.answered ? FORWARD_LEAD : 1));
}

// The rival dances first. Where she leaves his Composure is the mark you must beat.
// Where the rival had him after each measure of her own dance, for the current waltz.
export const rivalPace = (s, measure) => Math.round(s.max - (s.max - s.pass) * s.pace[Math.min(measure, s.pace.length) - 1]);
export const roundOf = (s) => Math.floor(s.waltz / WALTZES_PER_ROUND);
export const phaseOf = (s) => s.waltz % WALTZES_PER_ROUND;

export function nextWaltz(s) {
  s.waltz += 1;
  const w = WALTZES[s.waltz];
  if (phaseOf(s) === 0) {
    s.offset = s.rng.randint(-3, 3);
    s.rivalSteps = s.rng.sample(RIVAL_MOVES, 4);
    const weights = [s.rng.randint(3, 6), s.rng.randint(3, 6), s.rng.randint(3, 6), s.rng.randint(3, 6)];
    const total = weights.reduce((a, b) => a + b);
    let sum = 0;
    s.pace = weights.map((w) => (sum += w) / total);
    s.dead = 0;
  }
  s.stance = s.stances[s.waltz];
  s.max = w.composure; s.composure = w.composure;
  s.pass = Math.max(4, w.pass + s.offset);
  return s;
}

export function startWaltz(s) {
  s.composure = s.max;
  s.measure = 0; s.music = MUSIC_START; s.answered = false; s.unbalance = 0; s.waltzResult = ""; s.rhythms = [];
  if (s.waltz > 0) s.fluster = Math.max(0, s.fluster - BREATHER);
  s.flusterCards = Math.floor(s.fluster / FLUSTER_PER_CARD);
  s.hand = []; s.discard = [];
  s.draw = s.rng.shuffle([...s.active, ...Array.from({ length: s.dead + s.flusterCards }, FLUSTERED)]);
  return startMeasure(s);
}

// Dev tool: forces his stance for the current waltz.
export function setStance(s, stance) {
  s.stance = stance;
  s.stances[s.waltz] = stance;
  s.answered = false;
}

export function toggleCard(s, card) {
  if (s.active.includes(card)) s.active.splice(s.active.indexOf(card), 1);
  else if (s.active.length < DECK_LIMIT) s.active.push(card);
}

function startMeasure(s) {
  s.measure += 1;
  s.poise = 0; s.playedCount = 0; s.bonusSteps = 0; s.phrase = 0; s.phraseCards = []; s.tag = ""; s.chain = 0; s.skip = false;
  s.discard.push(...s.hand); s.hand = [];
  drawCards(s, HAND_SIZE);
  s.intent = pickIntent(s);
  if (s.rhythms.includes("Tango")) s.unbalance += TANGO_TENSION;
  return s;
}

export const cardsAllowed = (s) => s.bonusSteps + Math.min(CARDS_MAX, CARDS_FIRST + s.measure - 1) - (s.stance === "Aloof" && !s.answered ? ALOOF_PENALTY : 0);
export const isFree = (s, card) => s.phrase > 0 && card.beat === BEATS[s.phrase];
export const stepsLeft = (s) => Math.max(0, cardsAllowed(s) - s.playedCount);
export const canPlay = (s, card) => !card.dead && !s.waltzResult && (isFree(s, card) || s.playedCount < cardsAllowed(s));

export function damageOf(s, card) {
  let dmg = card.dmg + s.unbalance;
  if (s.rhythms.includes("steady")) dmg += RHYTHM_BONUS;
  if (s.rhythms.includes("Flamenco") && card.style === "Flamenco") dmg += DUENDE_BONUS;
  if (card.tag) dmg += (card.tag === s.tag ? s.chain : 0) * 2;
  if (card.finish) dmg += Math.floor((s.max - s.composure) * card.finish);
  if (!card.dmg && !card.finish) return 0;
  if (s.stance === "Guarded" && !s.answered && !(card.style === STANCES[s.stance] && card.rank > 1)) dmg = Math.floor(dmg * GUARDED_DAMAGE);
  return dmg;
}

export function play(s, card) {
  const events = [];
  const answers = card.style === STANCES[s.stance] && card.rank > 1 && !s.answered;
  if (answers) s.answered = true;
  const dmg = damageOf(s, card);
  const free = isFree(s, card);
  s.hand.splice(s.hand.indexOf(card), 1);
  s.discard.push(card);
  if (!free) s.playedCount += 1;
  if (card.tag) { s.chain = card.tag === s.tag ? s.chain + 1 : 1; s.tag = card.tag; }
  s.composure = Math.max(0, s.composure - dmg);
  s.poise += (card.poise || 0) + (s.rhythms.includes("Waltz") ? WALTZ_POISE : 0);
  s.music += card.music || 0;
  s.bonusSteps += card.steps || 0;
  if (card.rhythm) s.rhythms.push(card.rhythm);
  s.fluster = Math.max(0, s.fluster + (card.fluster || 0) - (card.heal || 0));
  s.unbalance += card.unbalance || 0;
  s.skip = s.skip || Boolean(card.skip);
  if (card.draw) drawCards(s, card.draw);
  events.push({ type: "played", card, dmg, answers, free });
  if (card.beat === BEATS[s.phrase]) {
    s.phrase += 1;
    s.phraseCards.push(card);
  } else {
    s.phrase = card.beat === "Step" ? 1 : 0;
    s.phraseCards = card.beat === "Step" ? [card] : [];
  }
  if (s.phrase === BEATS.length) {
    const bonus = FLOURISH + s.unbalance;
    s.composure = Math.max(0, s.composure - bonus);
    events.push({ type: "flourish", bonus, cards: s.phraseCards });
    s.phrase = 0; s.phraseCards = [];
  }
  if (s.fluster >= FLUSTER_LIMIT) events.push(falter(s));
  if (s.composure === 0) { events.push(...sweep(s)); return events; }
  if (card.closer) events.push(...closeWaltz(s));
  return events;
}

function finishWaltz(s, events) {
  s.results.push(s.waltzResult);
  if (s.waltz === WALTZES.length - 1) {
    s.result = s.hearts >= HEARTS_TO_WIN ? "won" : "lost";
    if (s.result === "won") events.push({ type: "won" });
  }
  return events;
}

function closeWaltz(s) {
  if (s.composure > s.pass) {
    s.waltzResult = "failed";
    return finishWaltz(s, [{ type: "failed" }]);
  }
  const calmed = Math.min(s.fluster, Math.max(0, s.music));
  s.fluster -= calmed;
  s.waltzResult = "closed"; s.closed += 1; s.hearts += PASS_HEARTS;
  return finishWaltz(s, [{ type: "closed", calmed }]);
}

// Too much Fluster doesn't end the dance. She misses a beat, loses time and momentum, then steadies.
function falter(s) {
  s.fluster = FALTER_FLUSTER;
  s.music -= FALTER_MUSIC;
  s.phrase = 0; s.phraseCards = [];
  s.dead += 1;
  s.discard.push(FLUSTERED());
  return { type: "falter", music: FALTER_MUSIC };
}

function sweep(s) {
  s.waltzResult = "swept";
  s.swept += 1; s.hearts += SWEPT_HEARTS;
  s.fluster = Math.max(0, s.fluster - SWEPT_CALM);
  return finishWaltz(s, [{ type: "swept" }]);
}

export function endMeasure(s) {
  const events = [];
  if (s.skip) {
    events.push({ type: "skipped" });
  } else if (s.intent.type === "lead") {
    const hit = intentValue(s), blocked = Math.min(s.poise, hit);
    s.fluster += hit - blocked;
    events.push({ type: "lead", hit, blocked, fluster: s.fluster });
  } else if (s.intent.type === "recover") {
    s.composure = Math.min(s.max, s.composure + s.intent.value);
    events.push({ type: "recover", value: s.intent.value, composure: s.composure });
  } else {
    s.discard.push(FLUSTERED());
    s.dead += 1;
    events.push({ type: "pressure" });
  }
  if (s.stance === "Proud" && !s.answered) {
    s.composure = Math.min(s.max, s.composure + PROUD_RECOVERY);
    events.push({ type: "proud", value: PROUD_RECOVERY, composure: s.composure });
  }
  const extra = Math.floor(s.fluster / FLUSTER_PER_CARD) - (s.flusterCards || 0);
  for (let i = 0; i < extra; i++) s.discard.push(FLUSTERED());
  if (extra > 0) { s.flusterCards = (s.flusterCards || 0) + extra; events.push({ type: "flustered", count: extra }); }
  if (s.fluster >= FLUSTER_LIMIT) events.push(falter(s));
  s.music -= Math.max(1, s.measure - (s.rhythms.includes("Minuet") ? 1 : 0));
  events.push({ type: "music", music: Math.max(0, s.music) });
  if (s.music <= 0) {
    if (s.composure <= s.pass) {
      s.waltzResult = "charmed"; s.hearts += PASS_HEARTS;
      events.push({ type: "charmed" });
      finishWaltz(s, events);
    } else {
      s.waltzResult = "failed"; events.push({ type: "failed" });
      finishWaltz(s, events);
    }
    return events;
  }
  startMeasure(s);
  return events;
}
