import { newRun, STANCES } from "./rules.js";
import { intentLine, reaction, greeting, momentLine, herLine } from "./lines.js";
import { startMusic, stopMusic, resetMusic, setQuiet, playStyle, toggleMute, playChime, playShoe, playPrinceHit, playClap, sfx, musicState } from "./audio.js";
import { TUTORIAL_BUILD, TUTORIAL_SETUP, RIVAL_TIP, RIVAL_DONE_TIP, CARD_TIP, startCoach, stopCoach, coachOn, coachHide, coachSay, coachWait, coachWaltz, coachAllows, coachPlayed, coachCheck, coachEnded, coachHighlight, coachLightsUp } from "./tutorial.js";
import { startBall as beginBall, ensureInHand, nextWaltz as advanceWaltz, setStance, roundOf, phaseOf, rivalPace, ROUNDS, WALTZES_PER_ROUND, MAX_HEARTS, HEARTS_TO_WIN, startWaltz, toggleCard, play, endMeasure, canPlay, cardsAllowed, stepsLeft, isFree, damageOf, intentValue, BEATS, WALTZES, MUSIC_START, FLUSTER_LIMIT, STANCE_TEXT, DECK_LIMIT, RUIN } from "./ball.js";

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STYLE_COLOUR = { Flamenco: "var(--flamenco)", Waltz: "var(--waltz)", Tango: "var(--tango)", Minuet: "var(--minuet)" };

// Each deck stands in for a month of preparation.
const BUILDS = [
  { name: "Flamenco specialist", accent: STYLE_COLOUR.Flamenco, note: "Huge hits, but she gets Flustered", lessons: { Laundress: 9 }, secrets: 5, hearsay: 1, favours: 1, suspicion: 20 },
  { name: "Waltz specialist", accent: STYLE_COLOUR.Waltz, note: "Blocks his moves, slower to finish", lessons: { Steward: 9 }, secrets: 5, hearsay: 1, favours: 1, suspicion: 20 },
  { name: "Tango specialist", accent: STYLE_COLOUR.Tango, note: "Unbalances him so every later card hits harder", lessons: { Nursemaid: 9 }, secrets: 5, hearsay: 1, favours: 1, suspicion: 20 },
  { name: "Minuet specialist", accent: STYLE_COLOUR.Minuet, note: "Gets stronger the lower his Composure falls", lessons: { Seamstress: 9 }, secrets: 4, hearsay: 1, favours: 2, suspicion: 20 },
  { name: "Two styles", accent: "var(--gold)", note: "Flamenco and Waltz, each to their 2nd move", lessons: { Laundress: 4, Steward: 4 }, secrets: 5, hearsay: 1, favours: 1, suspicion: 20 },
  { name: "Dabbler", accent: "var(--wild)", note: "One move from every style, none can answer a stance", lessons: { Laundress: 1, Steward: 1, Nursemaid: 1, Seamstress: 1 }, secrets: 6, hearsay: 2, favours: 1, suspicion: 20 },
  { name: "The spy", accent: "var(--secret)", note: "No lessons, many secrets, high Suspicion", lessons: {}, secrets: 11, hearsay: 0, favours: 1, suspicion: 60 },
];

function makeRun(build, seed) {
  const run = newRun(seed);
  run.bars = [50, 50, 50];
  run.lessons = { ...build.lessons };
  for (let i = 0; i < build.secrets; i++) run.secrets.push(run.secretDeck.pop());
  for (let i = 0; i < build.hearsay; i++) run.hearsay.push(run.secretDeck.pop());
    return run;
}

// --- The dancers -------------------------------------------------------------
// Each move shows one couple silhouette. Swap the numbers here to change which pose a move uses.
const POSE_IMAGE = {
  idle: 2,
  "Heel stamp": 7, Whirl: 6, "Final pose": 3,
  "Steady frame": 2, "Graceful lead": 4, Promenade: 5,
  "Close embrace": 3, "Sharp turn": 1, "The dip": 4,
  "Lingering glance": 8, "Soft whisper": 2, "Stolen touch": 8,
  Encore: 8, "Quick step": 7,
  whisper: 2, favour: 8, grace: 6,
  strike: 1, blocked: 3, win: 4, lose: 5,
};
const poseSrc = (name) => `assets/reference/poses/pose-${POSE_IMAGE[name] ?? POSE_IMAGE.idle}.png`;
[1, 2, 3, 4, 5, 6, 7, 8].forEach((n) => { new Image().src = `assets/reference/poses/pose-${n}.png`; });

let poseShown = "";
function setPose(name) {
  const src = poseSrc(name);
  if (src === poseShown) return;
  if (poseShown) sfx("swoosh");
  poseShown = src;
  $("mistress").setAttribute("href", src);
}

// --- Showing the Ball --------------------------------------------------------
let ball = null, session = 0, busy = false;

function show(id) {
  document.body.classList.toggle("in-tutorial", id === "ball" && coachOn());
  ["intro", "setup", "ball", "result"].forEach((s) => { $(s).hidden = s !== id; });
  window.scrollTo(0, 0);
}
function log(text, kind = "") {
  const li = document.createElement("li");
  li.textContent = text;
  li.className = kind;
  $("log").prepend(li);
}
function float(text, colour = "#fff") {
  const el = document.createElement("div");
  el.className = "floater";
  el.textContent = text;
  el.style.color = colour;
  $("floaters").append(el);
  setTimeout(() => el.remove(), 1100);
}
async function banner(title, small, ms = 1500) {
  sfx("banner");
  const el = $("banner");
  el.innerHTML = `${title}${small ? `<small>${small}</small>` : ""}`;
  el.hidden = false;
  await wait(ms);
  el.hidden = true;
}
function shake() {
  const el = $("stage");
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}
function aura(colour) {
  const el = $("mistress");
  if (!colour) {
    el.style.removeProperty("--aura");
    el.style.removeProperty("--aura-color");
    return;
  }
  el.style.setProperty("--aura", "13px");
  el.style.setProperty("--aura-color", colour);
}
// A full-screen moment for special cards. It stays up until the player closes it.
const STOMP_DELAY = 140;   // lets the card's tap finish, so the stomp lands on the artwork
const SPECIAL = new Set(["Encore", "Final pose", "Promenade", "The dip", "Stolen touch"]);
const KEY_IMAGES = { dance: "assets/reference/keyart.jpg", prince: "assets/reference/keyart-prince.jpg" };
Object.values(KEY_IMAGES).forEach((src) => { new Image().src = src; });

function keyArt({ kind, name, line, image = "dance", sound = playShoe }) {
  const el = $("keyArt");
  $("keyImage").src = KEY_IMAGES[image];
  $("keyKind").textContent = kind;
  $("keyName").textContent = name;
  $("keyLine").textContent = line;
  $("keyPetals").innerHTML = Array.from({ length: 16 }, () =>
    `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 0.9).toFixed(2)}s;animation-duration:${(1.5 + Math.random()).toFixed(2)}s"></i>`).join("");
  el.hidden = false;
  setTimeout(sound, STOMP_DELAY);
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  const close = $("keyClose");
  close.focus();
  return new Promise((resolve) => {
    close.onclick = () => { sfx("popupClose"); el.hidden = true; close.onclick = null; resolve(); };
  });
}

function cardColour(card) {
  if (card.kind === "Flourish") return "#e58fb0";
  if (card.kind === "Closer") return "#f1d48a";
  if (card.kind === "Rhythm") return "#8fd0d6";
  if (card.style) return STYLE_COLOUR[card.style];
  if (card.tag) return "var(--secret)";
  return "var(--wild)";
}
const cardKey = (card) => {
  if (card.style) return card.style;
  if (card.closer) return "closer";
  if (card.name === "Encore") return "encore";
  if (card.name === "Quick step") return "quick";
  if (card.name === "Prince's Favour") return "favour";
  if (card.kind === "Rhythm") return "rhythm";
  if (card.kind === "Secret") return "secret";
  if (card.kind === "Hearsay") return "hearsay";
  return "grace";
};
const poseFor = (card) => {
  if (POSE_IMAGE[card.name]) return card.name;
  if (card.name === "Prince's Favour") return "favour";
  return card.tag ? "whisper" : "grace";
};

function showComposure(value) {
  const left = value / ball.max;
  $("composureNum").textContent = `${value}/${ball.max}`;
  $("composureFill").style.width = `${left * 100}%`;
  $("statusWord").textContent = value <= ball.pass ? "Smitten" : left < 0.65 ? "Very interested" : left < 0.85 ? "Curious" : "Composed";
}
function showFluster(value) {
  $("flusterNum").textContent = `${value} / ${FLUSTER_LIMIT}`;
  $("flusterFill").style.width = `${Math.min(100, (value / FLUSTER_LIMIT) * 100)}%`;
}

function showMusic(value) {
  $("musicNum").textContent = `${value}`;
  $("musicCost").textContent = ball.waltzResult ? "" : `-${ball.measure} after this measure`;
  $("musicFill").style.width = `${Math.min(100, (value / MUSIC_START) * 100)}%`;
}

// Dance moves and their style's Rhythm card carry that style's emblem. Every other card shows its type.
const cardEmblem = (card) => (card.style || (STYLE_COLOUR[card.rhythm] ? card.rhythm : card.kind)).toLowerCase();

// A little picture for each card, using the same silhouette as its move.
function cardArt(card) {
  const name = card.dead ? "lose" : poseFor(card);
  const logo = `<img class="style-logo" src="assets/icons/${cardEmblem(card)}.svg" alt="${card.kind}">`;
  return `<span class="art-wrap"><img class="art" src="${poseSrc(name)}" alt="" aria-hidden="true">${logo}</span>`;
}

// Short card text in the style of Potionomics: just the effects.
function cardLines(s, card) {
  if (card.dead) return ["Can't be played"];
  const lines = [], dmg = damageOf(s, card);
  if (card.finish) lines.push(`Charm ${dmg}`, "More as he weakens");
  else if (dmg) lines.push(`Charm ${dmg}`);
  if (card.poise) lines.push(`Poise +${card.poise}`);
  if (card.music) lines.push(`Music +${card.music}`);
  if (card.steps) lines.push(`Steps +${card.steps}`);
  if (card.heal) lines.push(`Fluster -${card.heal}`);
  if (card.fluster) lines.push(`Fluster +${card.fluster}`);
  if (card.unbalance) lines.push(`Unbalance +${card.unbalance}`);
  if (card.draw) lines.push(`Draw ${card.draw}`);
  if (card.skip) lines.push("Cancel his next move");
  if (card.closer) lines.push("End the waltz");
  if (card.tag) lines.push("Chain: +2 per match");
  if (card.rhythm) lines.push({ steady: "All cards +1", Flamenco: "Flamenco +4", Waltz: "All cards: Poise +2", Tango: "Each measure: Unbalance +1", Minuet: "Music drains slower" }[card.rhythm], "Lasts this waltz");
  return lines;
}

// --- The prince talks and reacts ----------------------------------------------
let faceTimer = null, intentKey = "";

function moodFace() {
  const left = ball.composure / ball.max;
  return left < 0.3 ? "flustered" : left < 0.6 ? "charmed" : "calm";
}
// The reference portrait has one expression. To bring faces back, use one image per mood here.
function setFace(face) {
  $("princeFace").alt = `The prince, looking ${face}`;
}
function say(text, face) {
  const speech = $("speech"), portrait = $("princePortrait");
  speech.textContent = `"${text}"`;
  speech.hidden = false;
  speech.style.animation = "none";
  void speech.offsetWidth;
  speech.style.animation = "";
  setFace(face);
  portrait.classList.remove("react");
  void portrait.offsetWidth;
  portrait.classList.add("react");
  clearTimeout(faceTimer);
  faceTimer = setTimeout(() => { if (ball) setFace(moodFace()); }, 1700);
}
function herSay(text) {
  const el = $("herSpeech");
  el.textContent = `"${text}"`;
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
}
function clearTalk() {
  $("speech").hidden = true;
  $("herSpeech").hidden = true;
}

function renderIntent() {
  const s = ball, el = $("intent");
  const value = intentValue(s);
  const key = `${s.waltz}-${s.measure}`;
  if (key !== intentKey) {
    intentKey = key;
    if (s.measure > 1) say(intentLine(s.intent.type, phaseOf(s)), "calm");
  }
  const detail = s.intent.type === "lead" ? `Fluster +${value}`
    : s.intent.type === "recover" ? `Composure +${value}` : "Adds a Flustered card";
  el.className = `intent${s.skip ? " skipped" : ""}`;
  el.innerHTML = `<b class="intent-icon">${{ lead: "&#9876;", recover: "&#10010;", pressure: "&#10022;" }[s.intent.type]}</b><span>${detail}</span>`;
}

function renderHeader() {
  const s = ball;
  $("danceLabel").textContent = s.tutorial ? `Tutorial, waltz ${phaseOf(s) + 1} of ${WALTZES_PER_ROUND}` : `Round ${roundOf(s) + 1} of ${ROUNDS}, waltz ${phaseOf(s) + 1} of ${WALTZES_PER_ROUND}`;
  $("hearts").textContent = `${s.hearts} / ${s.waltzes.length * 2} Hearts`;
  $("passMark").style.left = `${(s.pass / s.max) * 100}%`;
}

function renderPace() {
  const s = ball, pace = rivalPace(s, s.measure), ahead = s.composure <= pace;
  $("paceMark").style.left = `${(pace / s.max) * 100}%`;
  const el = document.createElement("p");
  el.className = `pace${ahead ? " ahead" : ""}`;
  el.textContent = ahead ? `You've matched her pace for this measure (${pace}).` : `Charm ${s.composure - pace} more to match her pace this measure.`;
  $("stancePanel").append(el);
}

function renderProgramme() {
  const s = ball, list = $("programme"), start = roundOf(s) * WALTZES_PER_ROUND;
  const label = { swept: "Swept", closed: "Closed", charmed: "Passed", failed: "Failed" };
  list.innerHTML = "";
  s.stances.slice(start, start + WALTZES_PER_ROUND).forEach((stance, i) => {
    const li = document.createElement("li"), index = start + i;
    li.className = index < s.waltz ? "done" : index === s.waltz ? "now" : "";
    li.innerHTML = `<span>${i + 1}. ${stance}</span><span>${label[s.results[index]] || STANCES[stance] || ""}</span>`;
    list.append(li);
  });
}

// The hand rests low. Whichever card you point at is shown large in the middle.
function showZoom(el) {
  sfx("cardHover");
  const zoom = $("cardZoom");
  zoom.innerHTML = "";
  const copy = el.cloneNode(true);
  copy.disabled = false;
  copy.tabIndex = -1;
  copy.classList.toggle("is-faded", el.disabled);
  zoom.append(copy);
  const box = el.getBoundingClientRect();
  const half = zoom.firstChild.offsetWidth / 2 || 150;
  zoom.hidden = false;
  const width = zoom.firstChild.offsetWidth || half * 2;
  const centre = Math.max(width / 2 + 8, Math.min(innerWidth - width / 2 - 8, box.left + box.width / 2));
  zoom.style.left = `${centre}px`;
}
function hideZoom() {
  $("cardZoom").hidden = true;
}

function render() {
  const s = ball, answered = s.answered, needed = STANCES[s.stance];
  renderHeader();
  showComposure(s.composure);
  showMusic(s.music);
  $("steps").textContent = stepsLeft(s);
  $("stepsMax").textContent = `/${cardsAllowed(s)}`;
  $("drawCount").textContent = s.draw.length;
  $("discardCount").textContent = s.discard.length;
  document.querySelectorAll(".beat").forEach((el, i) => {
    el.classList.toggle("done", i < s.phrase);
    el.classList.toggle("next", i === s.phrase);
  });
  $("poise").textContent = s.poise;
  showFluster(s.fluster);
  $("deckLeft").textContent = `(${s.draw.length} left to draw)`;
  $("stancePanel").innerHTML = `<div class="stance-name">${s.stance}</div>
    <p>${STANCE_TEXT[s.stance]}.</p>
    ${needed ? `<p class="${answered ? "answered" : "need"}">${answered ? "Answered" : `Play a ${needed} move 2+ to answer`}</p>` : ""}`;
  renderProgramme();
  renderIntent();
  renderPace();

  const hand = $("hand");
  hand.innerHTML = "";
  hideZoom();
  for (const card of s.hand) {
    const el = document.createElement("button");
    const answers = !answered && card.style === needed && card.rank > 1;
    const free = !card.dead && isFree(s, card);
    el.className = `card${answers ? " answers" : ""}${free ? " free" : ""}${card.dead ? " dead" : ""}`;
    el.disabled = busy || !canPlay(s, card) || !coachAllows("play", card);
    el.dataset.name = card.name;
    el.style.setProperty("--c", cardColour(card));
    el.innerHTML = `${answers ? `<span class="ribbon">Answers</span>` : free ? `<span class="ribbon flow">Free</span>` : ""}
      <span class="name">${card.name}</span>
      ${cardArt(card)}
      <span class="body">
        ${card.beat ? `<span class="beat-tag">${card.beat}</span>` : ""}
        <span class="kind">${card.style || card.kind}</span>
        <ul class="effect">${cardLines(s, card).map((t) => `<li>${t}</li>`).join("")}</ul>
      </span>`;
    const spread = s.hand.indexOf(card) - (s.hand.length - 1) / 2;
    el.style.setProperty("--tilt", `${spread * 4}deg`);
    el.style.setProperty("--drop", `${Math.abs(spread) ** 2 * 5}px`);
    el.addEventListener("click", () => { hideZoom(); onPlay(card); });
    el.addEventListener("pointerenter", () => showZoom(el));
    el.addEventListener("pointerleave", hideZoom);
    hand.append(el);
  }
  $("endMeasure").disabled = busy || !coachAllows("end");
  $("endMeasure").textContent = s.music <= s.measure ? "End the waltz" : "End measure";
  coachHighlight();
}

async function runEvents(events, id) {
  for (const e of events) {
    if (id !== session) return;
    if (e.type === "played") {
      setPose(poseFor(e.card));
      aura(cardColour(e.card));
      sfx("cardPlay");
      if (e.card.name === "Heel stamp") playShoe({ dip: false });
      if (e.dmg) sfx("charm");
      if (e.card.poise) sfx("poise");
      if (e.dmg) float(`Charm ${e.dmg}`);
      else if (e.card.poise) float(`+${e.card.poise} Poise`, "#bfe3ff");
      if (e.card.music) float(`+${e.card.music} Music`, "#ffe2a8");
      if (e.card.steps) float(`+${e.card.steps} Steps`, "#ffe2a8");
      log(`${e.card.name}${e.dmg ? `: Composure -${e.dmg}` : ""}${e.card.poise ? `, Poise +${e.card.poise}` : ""}${e.card.music ? `, Music +${e.card.music}` : ""}${e.card.steps ? `, Steps +${e.card.steps}` : ""}.`);
      if (e.answers) { sfx("answer"); float(`${ball.stance} answered!`, "#ffe2a8"); log(`You answered his ${ball.stance} stance.`, "good"); }
      herSay(herLine(cardKey(e.card) in { Flamenco: 1, Waltz: 1, Tango: 1, Minuet: 1 } ? e.card.style : cardKey(e.card)));
      const said = reaction(e.answers ? "answered" : cardKey(e.card));
      say(said.text, e.dmg >= 12 || e.answers ? "surprised" : said.face);
      log(`He says: "${said.text}"`);
      render();
      if (SPECIAL.has(e.card.name)) await keyArt({ kind: e.card.style || e.card.kind, name: e.card.name, line: momentLine(e.card.name), sound: e.card.name === "Final pose" ? playClap : playShoe });
      else await wait(650);
      aura("");
    } else if (e.type === "flourish") {
      playChime();
      float(`Flourish! Charm ${e.bonus}`, "#ffe2a8");
      say(reaction("flourish").text, "surprised");
      log(`Flourish! ${e.cards.map((c) => c.name).join(", ")}: Charm ${e.bonus}.`, "good");
      aura("var(--gold)");
      showComposure(ball.composure);
      for (const card of e.cards) {
        setPose(poseFor(card));
        await wait(300);
      }
      aura("");
    } else if (e.type === "music") {
      showMusic(e.music);
    } else if (e.type === "skipped") {
      float("He is lost for words", "#ffe2a8");
      log("Your whisper stopped his next move.", "good");
      await wait(800);
    } else if (e.type === "lead") {
      setPose(e.hit > e.blocked ? "strike" : "blocked");
      shake();
      showFluster(e.fluster);
      { const said = reaction(e.hit > e.blocked ? "hit" : "blocked"); say(said.text, said.face); }
      float(e.hit > e.blocked ? `Fluster +${e.hit - e.blocked}` : "Blocked", e.hit > e.blocked ? "#ffb5a6" : "#bfe3ff");
      log(`He took the lead for ${e.hit}. Poise blocked ${e.blocked}.`, e.hit > e.blocked ? "bad" : "good");
      if (e.hit > e.blocked) await keyArt({ kind: "The prince takes the lead", name: `Fluster +${e.hit - e.blocked}`, line: momentLine("attack"), image: "prince", sound: playPrinceHit });
      else { sfx("block"); await wait(900); }
    } else if (e.type === "recover") {
      sfx("recover");
      setPose("idle");
      showComposure(e.composure);
      setFace("stern");
      float(`Composure +${e.value}`, "#ffb5a6");
      log(`He recovered ${e.value} Composure.`, "bad");
      await wait(800);
    } else if (e.type === "pressure") {
      sfx("fluster");
      setFace("amused");
      float("A Flustered card joins your deck", "#ffb5a6");
      log("He unsettled her. A Flustered card joined your deck.", "bad");
      await wait(800);
    } else if (e.type === "proud") {
      sfx("recover");
      showComposure(e.composure);
      float(`Composure +${e.value}`, "#ffb5a6");
      log(`His pride restored ${e.value} Composure.`, "bad");
      await wait(700);
    } else if (e.type === "flustered") {
      sfx("fluster");
      float("Flustered! A dead card joins your deck", "#ffb5a6");
      log("Fluster is rising. A dead card joined your deck.", "bad");
      await wait(700);
    } else if (e.type === "swept") {
      sfx("swept");
      setPose("win");
      say(reaction("swept").text, "flustered");
      log("Swept off his feet!", "good");
      await wait(1200);
      await banner("Swept off his feet!", "His Composure hits 0. +2 Hearts.", 1500);
    } else if (e.type === "charmed") {
      sfx("pass");
      setPose("favour");
      say(reaction("charmed").text, "charmed");
      log("You beat the rival's mark as the music ended.", "good");
      await wait(1000);
      await banner("You beat her mark", `Composure ${ball.composure} against her ${ball.pass}. +1 Heart.`, 1700);
    } else if (e.type === "closed") {
      sfx("pass");
      setPose("favour");
      say(reaction("closed").text, "charmed");
      log(`You closed the waltz early. Fluster -${e.calmed}.`, "good");
      await wait(1000);
      await banner("A perfect close", `She ends on her terms. +1 Heart. Fluster -${e.calmed}.`, 1700);
    } else if (e.type === "failed") {
      sfx("fail");
      setPose("lose");
      say(reaction("failed").text, "stern");
      log("You didn't beat the rival's mark.", "bad");
      await wait(1000);
      await banner("No Hearts this waltz", `Composure ${ball.composure}. The mark was ${ball.pass}. The Ball goes on.`, 1700);
    } else if (e.type === "falter") {
      sfx("falter");
      setPose("strike");
      shake();
      say(reaction("stumbled").text, "amused");
      showFluster(ball.fluster);
      showMusic(Math.max(0, ball.music));
      float(`She falters! Music -${e.music}`, "#ffb5a6");
      log(`She missed a beat. Music -${e.music}, your phrase is broken, and a Flustered card joins your deck.`, "bad");
      await wait(1100);
      setPose("idle");
    } else if (e.type === "won") {
      setPose("win");
    }
  }
}

async function afterEvents(id) {
  if (id !== session) return;
  const s = ball;
  if (s.result) return finish();
  if (s.waltzResult) return nextWaltz(id);
  busy = false;
  render();
  coachCheck(s.composure, s.pass);
}

async function onPlay(card) {
  if (busy) return;
  busy = true;
  const id = session;
  coachPlayed(card);
  const events = play(ball, card);
  render();
  await runEvents(events, id);
  await afterEvents(id);
}

async function onEndMeasure() {
  if (busy) return;
  busy = true;
  const id = session;
  $("hand").querySelectorAll(".card").forEach((el) => { el.disabled = true; });
  $("endMeasure").disabled = true;
  coachLightsUp();
  sfx("measure");
  const events = endMeasure(ball);
  await runEvents(events, id);
  if (id !== session) return;
  if (!ball.waltzResult && !ball.result) { setPose("idle"); sfx("draw"); coachEnded(); }
  await afterEvents(id);
}

// The rival takes the mistress's place on the left while it's her turn.
const LEFT_FACES = { mistress: "assets/reference/mistress.png", rival: "assets/reference/rival.png" };
Object.values(LEFT_FACES).forEach((src) => { new Image().src = src; });
function showOnLeft(who) {
  $("leftFace").src = LEFT_FACES[who];
  $("leftFace").alt = who === "rival" ? "The rival" : "Your mistress";
  $("leftName").textContent = who === "rival" ? "The Rival" : "Your Mistress";
  $("leftName").classList.toggle("rival-name", who === "rival");
}

const sleepOrSkip = (ms, skip) => Promise.race([wait(ms), skip]);

// The rival dances first, and the Composure she leaves him on is the mark to beat.
async function showRival(id) {
  const s = ball;
  let skipped = () => {};
  const skip = new Promise((resolve) => { skipped = resolve; });
  let isSkipped = false;
  const button = $("skip");
  button.hidden = false;
  button.onclick = () => { isSkipped = true; skipped(); };
  $("mistress").classList.add("rival");
  showOnLeft("rival");
  setQuiet(true);
  clearTalk();
  $("hand").innerHTML = "";
  $("play").hidden = true;
  $("phrase").hidden = true;
  renderHeader();
  renderProgramme();
  showComposure(s.max);
  $("passMark").style.opacity = 0;
  $("intent").hidden = true;
  setPose("idle");
  log(`Round ${roundOf(s) + 1}: the rival dances with the prince.`);
  coachSay(RIVAL_TIP);
  sfx("banner");
  const el = $("banner");
  el.innerHTML = `Round ${roundOf(s) + 1}: the rival takes the floor<small>Watch how far she gets. You must beat it.</small>`;
  el.hidden = false;
  await sleepOrSkip(1300, skip);
  el.hidden = true;
  $("paceMark").style.opacity = 0;
  let shown = s.max;
  for (let i = 0; i < s.rivalSteps.length && !isSkipped; i++) {
    if (id !== session) return;
    const next = rivalPace(s, i + 1);
    setPose(s.rivalSteps[i]);
    showComposure(next);
    sfx("rivalStep");
    float(`Measure ${i + 1}: Charm ${shown - next}`, "#ffd3da");
    log(`Rival, measure ${i + 1}: Charm ${shown - next}.`);
    shown = next;
    await sleepOrSkip(1150, skip);
  }
  if (id !== session) return;
  showComposure(s.pass);
  button.hidden = true;
  $("mistress").classList.remove("rival");
  $("passMark").style.opacity = 1;
  $("paceMark").style.opacity = .85;
  log(`She left his Composure at ${s.pass}.`);
  await banner(`She reached ${s.pass} in 4 measures`, "Same steps, same Music. Beat it.", 1500);
  if (id !== session) return;
  coachSay(RIVAL_DONE_TIP);
  await coachWait();
  if (id !== session) return;
  showOnLeft("mistress");
}

function renderEditor() {
  const s = ball, box = $("editorCards");
  $("editorTitle").textContent = `Dance Card: ${s.active.length} of ${DECK_LIMIT}`;
  const start = roundOf(s) * WALTZES_PER_ROUND;
  $("editorText").textContent = `Round ${roundOf(s) + 1}: he will be ${s.stances.slice(start, start + WALTZES_PER_ROUND).join(", then ")}. Tap cards to swap them.`;
  box.innerHTML = "";
  for (const card of s.pool) {
    const el = document.createElement("button");
    const on = s.active.includes(card);
    const start = roundOf(s) * WALTZES_PER_ROUND;
    const useful = card.rank > 1 && s.stances.slice(start, start + WALTZES_PER_ROUND).some((x) => STANCES[x] === card.style);
    el.className = `tile${on ? " on" : ""}${useful ? " good" : ""}`;
    el.style.setProperty("--c", cardColour(card));
    const logo = `<img class="tile-logo" src="assets/icons/${cardEmblem(card)}.svg" alt="${card.kind}">`;
    el.innerHTML = `${logo}<strong>${card.name}</strong><span>${card.kind}</span>`;
    el.addEventListener("click", () => {
      sfx(on ? "toggleOff" : "toggleOn");
      toggleCard(s, card);
      renderEditor();
    });
    box.append(el);
  }
  $("editorGo").disabled = s.active.length < 8;
}

function editDeck() {
  coachSay(CARD_TIP);
  $("editor").hidden = false;
  renderEditor();
  return new Promise((resolve) => {
    $("editorGo").onclick = () => { $("editor").hidden = true; resolve(); };
  });
}

// Dev tool: pins his mood for every waltz until it's set back to Auto.
function applyDevMood() {
  const mood = $("devMood").value;
  if (mood && ball) setStance(ball, mood);
  return mood;
}

async function nextWaltz(id) {
  busy = true;
  coachHide();
  advanceWaltz(ball);
  applyDevMood();
  if (phaseOf(ball) === 0) {
    await showRival(id);
    if (id !== session) return;
    await editDeck();
    if (id !== session) return;
  } else {
    renderHeader();
    renderProgramme();
    $("hand").innerHTML = "";
    setPose("idle");
    await banner(`Waltz ${phaseOf(ball) + 1}: he is ${ball.stance}`, `${STANCE_TEXT[ball.stance]}. Beat ${ball.pass}.`, 1300);
    if (id !== session) return;
  }
  startWaltz(ball);
  setQuiet(false);
  playStyle(STANCES[ball.stance]);
  $("phrase").hidden = false;
  $("play").hidden = false;
  $("intent").hidden = false;
  setPose("idle");
  render();
  log(`Round ${roundOf(ball) + 1}, waltz ${phaseOf(ball) + 1}: he is ${ball.stance}.`);
  busy = false;
  render();
  setFace("calm");
  say(greeting(phaseOf(ball)), "calm");
  coachWaltz(ball.waltz);
}

function finish() {
  stopMusic();
  clearTalk();
  const s = ball, won = s.result === "won";
  sfx(won ? "swept" : "fail");
  $("again").hidden = Boolean(s.tutorial);
  $("change").textContent = s.tutorial ? "Choose your Dance Card" : "Try another deck";
  if (s.tutorial) {
    stopCoach();
    $("resultEyebrow").textContent = "Tutorial complete";
    $("resultTitle").textContent = "You're ready for the Ball";
    $("resultText").textContent = `You earned ${s.hearts} of ${s.waltzes.length * 2} Hearts. Our lady looked radiant, and the rival looked like a wet kitten. Hmph! A real Ball is three rounds like this one, and your total Hearts decide how far she falls. Now go on, I have a nap to get to. Mreoooww!`;
    return show("result");
  }
  const ruin = RUIN.find(([needed]) => s.hearts >= needed);
  $("resultEyebrow").textContent = won ? `${s.hearts} of ${MAX_HEARTS} Hearts` : `Bad ending: ${s.hearts} of ${MAX_HEARTS} Hearts`;
  $("resultTitle").textContent = won ? `The rival is ${ruin[1]}` : "He stays out of reach";
  $("resultText").textContent = won
    ? `He chooses your mistress in front of the whole court. ${ruin[2]}`
    : `You needed ${HEARTS_TO_WIN} Hearts. The rival takes his arm.`;
  show("result");
}

function startTutorial() {
  startCoach({
    sound: () => sfx("coach"),
    ensure: (name) => ensureInHand(ball, name),
    waltz: () => ball.waltz,
    canPlayNamed: (name) => ball.hand.some((c) => c.name === name && canPlay(ball, c)),
    refresh: () => render(),
  });
  startBall(TUTORIAL_BUILD, 7, TUTORIAL_SETUP);
}

function startBall(build, seed, tutorial = null) {
  session += 1;
  if (!tutorial) stopCoach();
  resetMusic();
  startMusic();
  const run = makeRun(build, seed);
  ball = beginBall(build, run, seed, tutorial);
  ball.seed = seed;
  $("log").innerHTML = "";
  $("weakness").textContent = `The rival's weakness is ${run.weakness}, so those cards hit double. You can edit your Dance Card before each round.`;
  $("editor").hidden = true;
  $("skip").hidden = true;
  $("mistress").classList.remove("rival");
  showOnLeft("mistress");
  $("banner").hidden = true;
  setPose("idle");
  show("ball");
  nextWaltz(session);
}

function buildMenu() {
  const box = $("builds");
  for (const build of BUILDS) {
    const el = document.createElement("button");
    el.className = "build";
    el.style.setProperty("--accent", build.accent);
    el.innerHTML = `<strong>${build.name}</strong><span>${build.note}</span>`;
    el.addEventListener("click", () => startBall(build, Math.floor(Math.random() * 1e6)));
    box.append(el);
  }
}

$("introGo").addEventListener("click", () => show("setup"));
$("introTutorial").addEventListener("click", startTutorial);
$("endMeasure").addEventListener("click", onEndMeasure);
$("devMood").addEventListener("change", () => {
  if (!ball || $("ball").hidden || !applyDevMood() || !ball.hand.length) return;
  playStyle(STANCES[ball.stance]);
  render();
});
$("testStomp").addEventListener("click", () => playShoe());
$("testAttack").addEventListener("click", () => playPrinceHit());
$("testClap").addEventListener("click", () => playClap());
$("journalBtn").addEventListener("click", () => { $("journal").hidden = !$("journal").hidden; });
$("again").addEventListener("click", () => startBall(ball.build, ball.seed));
$("change").addEventListener("click", () => show("setup"));
$("quit").addEventListener("click", () => { session += 1; stopMusic(); stopCoach(); $("editor").hidden = true; $("keyArt").hidden = true; show("setup"); });
$("mute").addEventListener("click", () => { $("mute").textContent = toggleMute() ? "Sound off" : "Sound on"; });
buildMenu();
if (new URLSearchParams(location.search).has("silent")) $("mute").textContent = "Silent test";
window.musicState = musicState;
