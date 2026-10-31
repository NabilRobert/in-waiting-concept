// A browser copy of prototype/in_waiting.py. Keep the numbers here in step with that file.
export const DAYS = 12, DAYS_PER_WEEK = 3;
export const SLOTS = ["Morning", "Afternoon", "Evening"];
export const BARS = ["Propriety", "Allure", "Nerve"];
export const BAND = [35, 70];
const START_BARS = [50, 45, 50], NIGHT_DRIFT = [-1, -3, -3];
export const STRAIN_LIMIT = 8, SUSPICION_LIMIT = 100, PRINCE_DEFENCE = 26;
const RIVAL_MOVES = 8, RIVAL_HIT = [10, 16];
export const TAGS = ["Debt", "Lover", "Faith", "Family"];
const STALE = [1, 0.7, 0.4], STREAK_BONUS = 0.1, STREAK_CAP = 5;
export const CONTACT_GIFT_EVERY = 4;
const FAVOUR_CAP = 2, FAVOUR_VALUE = 5;
export const GOOD_ENDING_STAIN = 3;
export const DANCES = 3;
const HAND_SIZE = 4, SECRET_VALUE = 2, HEARSAY_VALUE = 1, WEAKNESS_MULT = 2;
const RISK_BASE = 0.1, RISK_PER_CARD = 0.2, RISK_MIN = 0.05, RISK_PER_SUSPICION = 0.002, CALM = 0.15;
export const WHEEL_SLICES = 8;
const WHEEL_BASE_LUCKY = 2, WHEEL_CALM_SUSPICION = 30;
const MOVE_COSTS = [1, 3, 5, 7, 9, 11], BOLD_RISK = 0.1;
export const STANCES = { Forward: "Waltz", Guarded: "Flamenco", Proud: "Tango", Aloof: "Minuet" };
export const STANCE_TEXT = {
  Forward: "Pressing is 25% riskier",
  Guarded: "Your stake is halved when banked",
  Proud: "Recovers 5 Defence after the dance",
  Aloof: "Walks away after 2 cards",
};
const DECK_LIMIT = 16, COURT_SCORES = [[12, 2], [6, 1]], COURT_FAIL_SLICES = 2, HEAL = 8;
export const SCHOOL_TARGET = [4, 6, 8, 11, 14, 18];
const SCHOOL_SUSPICION = 4, SCHOOL_FAIL_NERVE = 2, SCHOOL_UPGRADE = 3;
const FORWARD_RISK = 0.25, PROUD_RECOVERY = 5, ALOOF_CARDS = 2, FIRST_MOVE_ANSWER = 0;
const SCANDAL_TRAINER = "Seamstress";
export const TRAINERS = {
  Laundress: ["Flamenco", [["Heel stamp", 5, "bold"], ["Whirl", 10, "bold"], ["Final pose", 16, "bold"]]],
  Steward: ["Waltz", [["Steady frame", 5, "calm"], ["Graceful lead", 10, "mend"], ["Promenade", 15, "guard"]]],
  Nursemaid: ["Tango", [["Close embrace", 4, "sure"], ["Sharp turn", 7, "sure"], ["The dip", 12, "sure"]]],
  Seamstress: ["Minuet", [["Lingering glance", 2, "charm"], ["Soft whisper", 8, "charm"], ["Stolen touch", 13, "charm"]]],
};
export const CONTACTS = { Laundress: "Lover", Steward: "Debt", Seamstress: "Faith", Nursemaid: "Family" };

const act = (name, group, bars, suspicion, slots, stain, note) => ({ name, group, bars, suspicion, slots, stain, note });
export const ACTIONS = [
  act("Etiquette drill", "Court", [10, -3, -3], 0, SLOTS, 0, "Propriety up, she tires"),
  act("Gown and beauty", "Court", [-3, 10, -2], 0, SLOTS, 0, "Allure up, a little improper"),
  act("Tea and counsel", "Court", [-1, -2, 10], 0, ["Morning", "Evening"], 0, "Nerve up"),
  act("Arrange an encounter", "Court", [-2, 14, -6], 0, ["Afternoon"], 0, "Big Allure, reveals a Ball stance, earns a Prince's Favour at Allure 40+"),
  act("Audience with the Queen Mother", "Court", [2, -2, -5], 0, ["Morning"], 0, "Once a week, needs Propriety 50+. Prince's Defence -1"),
  ...Object.entries(CONTACTS).map(([who, tag]) =>
    act(`Help the ${who}`, "Servants", [1, 0, 0], -12, SLOTS, 0, `Suspicion -12. Every ${CONTACT_GIFT_EVERY} visits: ${tag} hearsay`)),
  ...Object.entries(TRAINERS).map(([who, [style]]) =>
    act(`Lesson with the ${who}`, "Dance", [who === SCANDAL_TRAINER ? -2 : 0, 0, -3], 0, ["Afternoon"], who === SCANDAL_TRAINER ? 1 : 0,
      `Learn ${style}. Too sore for dirty actions tonight`)),
  act("Dance school", "Dance", [0, 0, 0], SCHOOL_SUSPICION, ["Evening"], 0, "Sneak out masked and dance the next rank. Win to upgrade your best move"),
  act("Ask the staff", "Servants", [0, 0, 0], 0, SLOTS, 0, "Shows the rival's moves for today and tomorrow"),
  act("Intercept", "Court", [0, 0, -2], 0, SLOTS, 0, "Blocks her move today, but only if you have seen it"),
  act("Watch the rival", "Intrigue", [0, 0, 0], 4, SLOTS, 1, "Shows her next 3 days of moves"),
  act("Eavesdrop", "Intrigue", [0, 0, 0], 6, SLOTS, 1, "+1 secret, +2 on Salon days"),
  act("Search her rooms", "Intrigue", [0, 0, 0], 15, ["Evening"], 3, "+2 secrets and reveals her weakness"),
  act("Blackmail", "Intrigue", [0, 0, 0], 6, SLOTS, 3, "Spend 1 secret: +12 to your lowest bar"),
  act("Spread a rumour", "Intrigue", [0, 0, 0], 9, SLOTS, 4, "Spend 1 secret: Prince's Defence -2"),
];

// Seeded randomness, so a retry of the same month plays out the same way.
export function makeRng(seed) {
  let a = (seed * 2654435761) >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randint = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  const choice = (list) => list[Math.floor(random() * list.length)];
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const sample = (list, n) => shuffle([...list]).slice(0, n);
  return { random, randint, choice, shuffle, sample };
}

const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const pyRound = (x) => {
  const f = Math.floor(x), d = x - f;
  return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f;
};
export const inBand = (b) => b >= BAND[0] && b <= BAND[1];
const count = (obj, key) => obj[key] || 0;
const lowest = (run) => run.bars.indexOf(Math.min(...run.bars));

export function newRun(seed) {
  const rng = makeRng(seed);
  const run = {
    bars: [...START_BARS], suspicion: 0, strain: 0, defence: PRINCE_DEFENCE, stain: 0, streak: 0, favours: 0, day: 1,
    secrets: [], hearsay: [], secretDeck: range(1, 80).map(() => rng.choice(TAGS)),
    wheel: range(1, DAYS).map(() => rng.random()), contacts: {}, lessons: {}, sore: false, stances: [], seed,
    schoolRank: 0, upgrades: {}, stancesKnown: 0, weakness: rng.choice(TAGS), weaknessKnown: false,
    rival: {}, seen: new Set(), venues: {}, uses: {}, blockedToday: false, lost: "", finalDefence: 0,
  };
  for (const day of rng.sample(range(2, DAYS), RIVAL_MOVES)) {
    run.rival[day] = { target: rng.choice([0, 1, 2, null]), hit: rng.randint(...RIVAL_HIT) };
  }
  for (const day of rng.sample(range(1, DAYS), 6)) {
    run.venues[day] = Object.keys(run.venues).length % 2 ? "Hunt" : "Salon";
  }
  run.stances = rng.sample(Object.keys(STANCES), DANCES);
  return run;
}

export function clone(run) {
  return {
    ...run, bars: [...run.bars], secrets: [...run.secrets], hearsay: [...run.hearsay], secretDeck: [...run.secretDeck],
    wheel: [...run.wheel], contacts: { ...run.contacts }, lessons: { ...run.lessons }, upgrades: { ...run.upgrades },
    seen: new Set(run.seen), uses: { ...run.uses },
  };
}

export function legal(run, slot) {
  return ACTIONS.filter((a) => {
    if (!a.slots.includes(slot) || (run.sore && a.stain)) return false;
    if ((a.name === "Blackmail" || a.name === "Spread a rumour") && !run.secrets.length) return false;
    if (a.name === "Audience with the Queen Mother" && (run.bars[0] < 50 || count(run.uses, a.name))) return false;
    return true;
  });
}

function visit(run, who) {
  run.contacts[who] = count(run.contacts, who) + 1;
  if (run.contacts[who] % CONTACT_GIFT_EVERY === 0) run.hearsay.push(CONTACTS[who]);
}

// Everything except the dance itself, so the planner can preview a day without playing it.
export function applyCore(run, a) {
  const mult = STALE[Math.min(count(run.uses, a.name), STALE.length - 1)] * (1 + STREAK_BONUS * Math.min(run.streak, STREAK_CAP));
  run.uses[a.name] = count(run.uses, a.name) + 1;
  a.bars.forEach((delta, i) => { run.bars[i] += delta > 0 ? pyRound(delta * mult) : delta; });
  run.suspicion = Math.max(0, run.suspicion + a.suspicion);
  run.stain += a.stain;

  const venue = run.venues[run.day];
  if (a.name === "Arrange an encounter") {
    if (venue === "Hunt") run.bars[1] += 6;
    if (run.bars[1] >= 40) run.favours = Math.min(FAVOUR_CAP, run.favours + 1);
    run.stancesKnown = Math.min(DANCES, run.stancesKnown + 1);
  } else if (a.name === "Audience with the Queen Mother") {
    run.defence -= 1;
  } else if (a.name.startsWith("Help the ")) {
    visit(run, a.name.slice("Help the ".length));
  } else if (a.name.startsWith("Lesson with the ")) {
    const who = a.name.slice("Lesson with the ".length);
    run.lessons[who] = count(run.lessons, who) + 1;
    run.sore = true;
    visit(run, who);
  } else if (a.name === "Intercept") {
    run.blockedToday = run.seen.has(run.day);
  } else if (a.name === "Ask the staff") {
    run.seen.add(run.day).add(run.day + 1);
  } else if (a.name === "Watch the rival") {
    for (let i = 0; i < 3; i++) run.seen.add(run.day + i);
  } else if (a.name === "Eavesdrop") {
    for (let i = 0; i < (venue === "Salon" ? 2 : 1); i++) run.secrets.push(run.secretDeck.pop());
  } else if (a.name === "Search her rooms") {
    run.secrets.push(run.secretDeck.pop(), run.secretDeck.pop());
    run.weaknessKnown = true;
  } else if (a.name === "Blackmail") {
    run.secrets.shift();
    run.bars[lowest(run)] += 12;
  } else if (a.name === "Spread a rumour") {
    run.secrets.shift();
    run.defence -= 2;
  }
  run.bars = run.bars.map((b) => Math.max(0, Math.min(100, b)));
  if (run.suspicion >= SUSPICION_LIMIT) run.lost = "caught";
}

export async function applyAction(run, a, io) {
  applyCore(run, a);
  if (a.name === "Dance school" && !run.lost) await danceSchool(run, io);
}

export function luckySlices(run, bonus = 0) {
  const safe = run.bars.filter(inBand).length;
  return Math.max(1, Math.min(WHEEL_SLICES - 1, WHEEL_BASE_LUCKY + safe + (run.suspicion < WHEEL_CALM_SUSPICION ? 1 : 0) + bonus));
}

export function fortune(run, index, bonus = 0) {
  const lucky = index < luckySlices(run, bonus);
  const i = index % 4;
  if (lucky) {
    if (i === 0) { run.secrets.push(run.secretDeck.pop()); return [true, "A secret falls into your lap"]; }
    if (i === 1) { run.favours = Math.min(FAVOUR_CAP, run.favours + 1); return [true, "The prince asks after her: +1 Prince's Favour"]; }
    if (i === 2) { run.suspicion = Math.max(0, run.suspicion - 15); return [true, "The staff close ranks: Suspicion -15"]; }
    run.defence -= 2;
    return [true, "The rival stumbles: Defence -2"];
  }
  if (i === 0) { run.suspicion += 12; return [false, "A maid talks: Suspicion +12"]; }
  if (i === 1) { run.bars[run.bars.indexOf(Math.max(...run.bars))] -= 12; return [false, "Whispers at court: your highest bar -12"]; }
  if (i === 2) { run.defence += 2; return [false, "The rival shines: Defence +2"]; }
  if (run.secrets.length) { run.secrets.shift(); return [false, "A letter goes missing: you lose a secret"]; }
  run.bars[lowest(run)] -= 8;
  return [false, "A bad evening: your lowest bar -8"];
}

async function soloDance(run, rng, deck, stance, io, ctx) {
  const [banked, left] = await waltz(run, rng, deck, [], stance, io, { ...ctx, number: 1, defence: 999 });
  return banked + 999 - left;
}

async function courtDance(run, io) {
  const rng = makeRng(run.seed * 100 + run.day);
  const stance = rng.choice(Object.keys(STANCES));
  const deck = rng.shuffle(buildDeck(run));
  await io.danceStart({ kind: "court", stance, deck });
  const score = await soloDance(run, rng, deck, stance, io, { kind: "court", heal: true });
  let bonus = -COURT_FAIL_SLICES;
  if (score > 0) bonus = (COURT_SCORES.find(([needed]) => score >= needed) || [0, 0])[1];
  await io.danceEnd({ kind: "court", score, bonus, text: score > 0 ? `You score ${score}: ${bonus >= 0 ? "+" : ""}${bonus} lucky slices` : "Caught out in front of the court: -2 lucky slices" });
  return bonus;
}

async function danceSchool(run, io) {
  if (run.schoolRank >= SCHOOL_TARGET.length) return;
  const rng = makeRng(run.seed * 100 + run.day + 50);
  const stance = rng.choice(Object.keys(STANCES));
  const target = SCHOOL_TARGET[run.schoolRank];
  const deck = rng.shuffle(buildDeck(run));
  await io.danceStart({ kind: "school", stance, deck, target });
  const score = await soloDance(run, rng, deck, stance, io, { kind: "school", heal: false, target });
  let text;
  if (score >= target) {
    run.schoolRank += 1;
    const moves = knownMoves(run);
    text = `You climb to rank ${run.schoolRank}.`;
    if (moves.length) {
      const best = moves.reduce((a, b) => (b.value > a.value ? b : a));
      run.upgrades[best.name] = count(run.upgrades, best.name) + 1;
      text += ` ${best.name} grows stronger.`;
    }
  } else {
    run.bars[2] = Math.max(0, run.bars[2] - SCHOOL_FAIL_NERVE);
    text = `You score ${score} of ${target} and limp home. Nerve -${SCHOOL_FAIL_NERVE}.`;
  }
  await io.danceEnd({ kind: "school", score, won: score >= target, text });
  io.log(text, score >= target ? "good" : "bad");
}

async function courtEvent(run, io) {
  const bonus = await courtDance(run, io);
  let index = Math.floor(run.wheel.pop() * WHEEL_SLICES);
  const [lucky, text] = fortune(clone(run), index, bonus);
  const lucky0 = luckySlices(run, bonus);
  const respin = await io.wheel({ lucky: lucky0, index, wasLucky: lucky, text, canNudge: !lucky && run.secrets.length > 0 });
  if (respin) {
    run.secrets.shift();
    index = Math.floor(run.wheel.pop() * WHEEL_SLICES);
  }
  const [isLucky, finalText] = fortune(run, index, bonus);
  if (respin) await io.wheel({ lucky: luckySlices(run, bonus), index, wasLucky: isLucky, text: finalText, canNudge: false });
  run.bars = run.bars.map((b) => Math.max(0, b));
  io.log(`Fortune's Wheel: ${finalText}`, isLucky ? "good" : "bad");
}

export async function endDay(run, io) {
  const move = run.rival[run.day];
  if (move) {
    if (run.blockedToday) {
      run.defence -= 1;
      io.log("You blocked the rival's move. The prince warms to your mistress: Defence -1.", "good");
    } else {
      run.defence += 1;
      if (move.target === null) {
        run.suspicion += move.hit;
        io.log(`The rival's maid watched you: Suspicion +${move.hit}, Defence +1.`, "bad");
      } else {
        run.bars[move.target] = Math.max(0, run.bars[move.target] - move.hit);
        io.log(`The rival struck: ${BARS[move.target]} -${move.hit}, Defence +1.`, "bad");
      }
    }
  }
  run.blockedToday = false;
  run.sore = false;
  if (run.day % DAYS_PER_WEEK === 0 && run.day < DAYS) await courtEvent(run, io);
  run.bars = run.bars.map((b, i) => Math.max(0, Math.min(100, b + NIGHT_DRIFT[i])));
  const outside = run.bars.filter((b) => !inBand(b)).length;
  run.strain += outside;
  run.streak = outside ? 0 : run.streak + 1;
  if (outside) io.log(`${outside} bar${outside > 1 ? "s" : ""} outside the safe zone: Strain +${outside}.`, "bad");
  if (run.strain >= STRAIN_LIMIT) run.lost = "collapse";
  if (run.suspicion >= SUSPICION_LIMIT) run.lost = "caught";
  if (run.day % DAYS_PER_WEEK === 0) run.uses = {};
  run.day += 1;
}

export function movesKnown(lessons) {
  let known = 0;
  for (const cost of MOVE_COSTS) {
    if (lessons < cost) break;
    lessons -= cost;
    known += 1;
  }
  return known;
}

export function lessonsToNext(lessons) {
  for (const cost of MOVE_COSTS) {
    if (lessons < cost) return cost - lessons;
    lessons -= cost;
  }
  return 0;
}

export function knownMoves(run) {
  const out = [];
  for (const [who, [style, moves]] of Object.entries(TRAINERS)) {
    moves.slice(0, movesKnown(count(run.lessons, who))).forEach(([name, value, power], i) => {
      const allure = power === "charm" ? Math.floor(run.bars[1] / 10) : 0;
      out.push({ name, value: value + allure + count(run.upgrades, name) * SCHOOL_UPGRADE, tag: "", power, style, rank: i + 1 });
    });
  }
  return out;
}

export function buildDeck(run) {
  const card = (tag, label, value) => ({ name: `${tag} ${label}`, value: value * (tag === run.weakness ? WEAKNESS_MULT : 1), tag, power: "", style: "", rank: 0 });
  const graces = [["Propriety's Grace", 2, "calm"], ["Allure's Grace", 3, "flair"], ["Nerve's Grace", 2, "guard"]];
  const deck = [
    ...run.secrets.map((t) => card(t, "secret", SECRET_VALUE)),
    ...run.hearsay.map((t) => card(t, "hearsay", HEARSAY_VALUE)),
    ...range(1, run.favours).map(() => ({ name: "Prince's Favour", value: FAVOUR_VALUE, tag: "", power: "", style: "", rank: 0 })),
    ...knownMoves(run),
  ];
  const fixed = run.bars.map((bar, i) => {
    const [name, value, power] = graces[i];
    return inBand(bar) ? { name, value, tag: "", power, style: "", rank: 0 } : { name: "Flaw", value: 0, tag: "", power: "flaw", style: "", rank: 0 };
  });
  deck.sort((a, b) => (b.rank > 1) - (a.rank > 1) || b.value - a.value);
  return [...deck.slice(0, DECK_LIMIT - fixed.length), ...fixed];
}

const pressRisk = (laid, calm, suspicion) => Math.max(RISK_MIN, RISK_BASE + RISK_PER_CARD * (laid - 1) + RISK_PER_SUSPICION * suspicion - calm);

async function waltz(run, rng, deck, hand, stance, io, ctx) {
  let defence = ctx.defence;
  const draw = () => { while (hand.length < HAND_SIZE && deck.length) hand.push(deck.pop()); };
  draw();
  let stake = 0, chain = 0, tag = "", laid = 0, calm = 0, guard = false, mend = false, answer = 0, redrawn = false;
  for (;;) {
    if (stance === "Aloof" && answer < 1 && laid >= ALOOF_CARDS + (answer > 0 ? 1 : 0)) {
      await io.note("They lose interest and turn away.");
      break;
    }
    const playable = hand.filter((c) => c.power !== "flaw");
    let risk = laid ? pressRisk(laid, calm, run.suspicion) : 0;
    if (stance === "Forward" && laid) risk += FORWARD_RISK * (1 - answer);
    const canRedraw = !laid && !redrawn && deck.length > 0;
    if (!playable.length && !canRedraw) break;
    const card = await io.choose({ hand, playable, stake, chain, tag, risk, laid, answer, stance, canRedraw, defence, ctx, deckLeft: deck.length });
    if (card === null) break;
    if (card === "redraw") {
      deck.push(...hand);
      hand.length = 0;
      rng.shuffle(deck);
      draw();
      redrawn = true;
      continue;
    }
    hand.splice(hand.indexOf(card), 1);
    if (laid && card.power !== "charm" && rng.random() < risk) {
      if (guard) {
        guard = false;
        await io.struck({ blocked: true, stake });
      } else {
        stake = mend ? Math.floor(stake / 2) : 0;
        await io.struck({ blocked: false, stake, mended: mend });
        break;
      }
    }
    if (card.tag) {
      chain = card.tag === tag ? chain + 1 : 1;
      tag = card.tag;
    }
    if (card.power === "sure") defence -= card.value;
    else stake += card.value * (card.tag ? chain : 1);
    laid += 1;
    if (card.style === STANCES[stance]) answer = Math.max(answer, card.rank > 1 ? 1 : FIRST_MOVE_ANSWER);
    calm += card.power === "calm" ? CALM : card.power === "bold" ? -BOLD_RISK : 0;
    guard = guard || card.power === "guard";
    mend = mend || card.power === "mend";
    let healed = "";
    if (card.power === "mend" && ctx.heal) {
      const low = lowest(run);
      run.bars[low] += HEAL;
      healed = `${BARS[low]} +${HEAL}`;
    }
    await io.played({ card, stake, chain: Math.max(chain, 1), defence, healed });
    if (defence <= 0) break;
  }
  if (stance === "Guarded" && answer < 1) {
    stake = Math.floor(stake * (0.5 + answer / 2));
    await io.note(`The guard holds. Only ${stake} lands.`);
  }
  hand.splice(0, hand.length, ...hand.filter((c) => c.power !== "flaw"));
  return [stake, defence, answer];
}

export async function duel(run, seed, io) {
  const rng = makeRng(seed + 2);
  const deck = rng.shuffle(buildDeck(run));
  const hand = [];
  let defence = run.defence;
  for (let dance = 1; dance <= DANCES; dance++) {
    const stance = run.stances[dance - 1];
    await io.danceStart({ kind: "ball", stance, deck, dance, defence });
    const [stake, left, answer] = await waltz(run, rng, deck, hand, stance, io, { kind: "ball", number: dance, defence, heal: false });
    defence = left - stake;
    await io.banked({ stake, defence });
    if (stance === "Proud" && answer < 1 && defence > 0) {
      const recovered = Math.floor(PROUD_RECOVERY * (1 - answer));
      defence += recovered;
      await io.note(`He recovers ${recovered} Defence.`);
      await io.banked({ stake: 0, defence });
    }
    if (defence <= 0) break;
  }
  run.finalDefence = defence;
  await io.danceEnd({ kind: "ball", won: defence <= 0, defence });
}

export const won = (run) => !run.lost && run.finalDefence <= 0;

export function ending(run) {
  if (run.lost) return run.lost === "caught" ? "caught" : "collapse";
  if (!won(run)) return "lost";
  return run.stain <= GOOD_ENDING_STAIN ? "good" : "dark";
}

export function tease(run) {
  const all = [...run.secrets, ...run.hearsay];
  const counts = {};
  all.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  if (run.rival[run.day] && run.seen.has(run.day)) return "Your sources say she moves tomorrow.";
  if (run.venues[run.day] === "Hunt") return "The prince rides out tomorrow. He will be alone by afternoon.";
  if (run.venues[run.day] === "Salon") return "Tomorrow's salon will be full of loose tongues.";
  if (run.day % DAYS_PER_WEEK === 0) return `Court Dance tomorrow night. The wheel has ${luckySlices(run)} lucky slices so far.`;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top) return `One more ${top[0]} card would make a ${top[1] + 1}-card chain.`;
  return "Someone has been in your mistress's rooms.";
}
