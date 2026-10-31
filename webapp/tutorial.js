// The tutorial: one round of three waltzes, teaching one idea at a time. The writer can edit this text.
export const TUTORIAL_BUILD = { name: "Tutorial", lessons: { Laundress: 4, Steward: 4 }, secrets: 4, hearsay: 1, favours: 1, suspicion: 10 };

const lead = (value) => ({ type: "lead", value, text: "Takes the lead" });
const recover = (value) => ({ type: "recover", value, text: "Collects himself" });

export const TUTORIAL_SETUP = {
  waltzes: [
    { composure: 42, pass: 22, lead: 3 },
    { composure: 70, pass: 30, lead: 4 },
    { composure: 66, pass: 30, lead: 4 },
  ],
  stances: ["Calm", "Forward", "Guarded"],
  deck: ["Family secret", "Lover secret", "Heel stamp", "Whirl", "Steady frame", "Graceful lead", "Find the rhythm", "Prince's Favour", "Deep curtsy", "Allure's Grace", "Nerve's Grace", "Propriety's Grace"],
  intents: [
    [lead(5), recover(3), lead(3), lead(3)],
    [lead(5), lead(4), recover(3), lead(4)],
    [lead(6), lead(5), recover(3), lead(4)],
  ],
};

export const RIVAL_TIP = "Mreoooww! Hello there! I'm Luna, and I'll walk you through tonight, one paw at a time. Now look, it's HER. The rival. Hsss! Watch her dance with the prince. Wherever she leaves his Composure becomes your target.";
export const RIVAL_DONE_TIP = "Grrrr! I once left a hairball in her slippers, and I'd do it again. Mrow! Our lady is a hundred times lovelier, and she gives the best chin scratches. Let's beat that mark!";
export const CARD_TIP = "This is your Dance Card, the deck you'll use tonight. At a real Ball, you can swap cards here before each round. I've already picked a nice set for you, so just press Dance. Mrrp!";

const STEPS = [
  [
    { text: "Mew! See this bar? That's the prince's Composure. The gold mark is where the rival left him. Grrr! Bring it below that to pass the waltz. Easy as knocking a cup off a table.", target: ".prince-plate" },
    { text: "This coin is the Music. It drops after every measure, and faster each time. When it runs out, the waltz ends, so no napping. Mrow.", target: ".music-coin" },
    { text: "Mrrrow? Look at his thought bubble! It shows what he'll do when this measure ends. He's about to take the lead, which would fluster your mistress.", target: "#intent" },
    { text: "Prrp! These are your Steps. Most cards cost one, and you get more as the waltz goes on.", target: ".steps-orb" },
    { text: "Mreow, your turn! Point at Heel Stamp to read it, then click it to play it. Charm lowers his Composure.", play: "Heel stamp" },
    { text: "Mrrow, nicely pounced! Let's protect our lovely lady from his move. Steady Frame gives you Poise, which blocks his next move.", play: "Steady frame" },
    { text: "Mew! Good human. When you're done with a measure, press End Measure. He'll make his move, and you'll draw a new hand.", target: "#endMeasure", until: "end" },
    { text: "Played cards go to your Used pile. When the Draw pile runs out, they shuffle back in. I'd love to sit on that pile. Mrrr.", target: ".discard-pile" },
    { text: "Mrrp! The small pale tick on his bar shows where the rival was at this point. Grrr, that woman! Stay ahead of her and you're on course.", target: ".plate-meter" },
    { text: "Mreoooww, now you try by yourself! Keep playing cards and ending measures until his Composure is below the gold mark. I'll watch from here. Purrr.", until: "free" },
  ],
  [
    { text: "Mreoooww! Purr-fect! Hearts are your score. Beat the mark for 1, or bring him to 0 to sweep him off his feet for 2. All your Hearts add up at the end of the Ball.", target: ".top-mid" },
    { text: "Mrow! Each waltz, he takes a stance, just like a cat with its back up. He's Forward now, so his moves hit harder. His plate always shows his stance.", target: ".stance" },
    { text: "Prrrp! Every card is a Step, a Turn or a Pose. Play them in that order and the next card is free. This tracker shows where you are.", target: "#phrase" },
    { text: "Mew! Let's start a phrase with a Step. Play Heel Stamp.", play: "Heel stamp" },
    { text: "Mrrow, now the next Turn is free! Graceful Lead is also a Waltz move, and a 2nd move or better in the matching style answers his stance. That cancels Forward for this waltz.", play: "Graceful lead" },
    { text: "Mreow! Land on your feet with a Pose. Play Nerve's Grace to finish the phrase for a Flourish, a free burst of bonus Charm.", play: "Nerve's Grace" },
    { text: "Purrr. Rhythm cards last for the whole waltz, like a good long sunbeam. Play Find the Rhythm, and every card after it hits harder.", play: "Find the rhythm" },
    { text: "Mreoooww, you've got it! Beat the gold mark again and chain Step, Turn, Pose as you go. Show that rival how our graceful lady does it. Hmph!", until: "free" },
  ],
  [
    { text: "Mrow, last one, I promise. Even our elegant lady gets nervous, and Fluster shows how shaken she is. When his moves get past your Poise, it rises. Every 8 Fluster adds a dead card to your deck, and at 24 she falters and you lose Music.", target: ".mistress-plate" },
    { text: "He's Guarded now, so your cards Charm less. Mrrreow, claws out! Flamenco answers Guarded. Play Whirl.", play: "Whirl" },
    { text: "Mew! Cats hear everything, and so do you. Secrets are gossip you gathered about the prince, and each one has a tag. Play Family Secret.", play: "Family secret" },
    { text: "Mrrp! Play the same tag again in one measure and it hits +2 harder. Play your other Family Secret.", play: "Family secret" },
    { text: "Prrp! The Journal shows the rival's weakness. Heh heh, grrr! Cards with that tag hit double, so bring the right ones to the Ball.", target: "#journalBtn" },
    { text: "Mreow! Now bring his Composure below the gold mark. Then I'll show you one last trick.", until: "below" },
    { text: "Mreoooww! You beat her mark, clever thing! Now you have a choice. A Closer ends the waltz now for 1 Heart, and unused Music calms her. Or keep going for 0 and 2 Hearts, but risk his next move. Today, play Deep Curtsy.", play: "Deep curtsy" },
  ],
];

let steps = [], index = -1, hooks = null, played = "";

const step = () => steps[index];

// Darkens the screen around one element and follows it if it moves.
const SPOT_PADDING = 10;
let spotFrame = 0;

function spotlight(el) {
  const spot = document.getElementById("coachSpot");
  cancelAnimationFrame(spotFrame);
  spot.classList.toggle("on", Boolean(el));
  if (!el) return;
  spot.style.borderRadius = getComputedStyle(el).borderRadius;
  const follow = () => {
    if (!el.isConnected) return spot.classList.remove("on");
    // Include children that stick out, like the Music coin on the prince's plate.
    const boxes = [el, ...el.children].map((part) => part.getBoundingClientRect()).filter((box) => box.width);
    const left = Math.min(...boxes.map((box) => box.left)), top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right)), bottom = Math.max(...boxes.map((box) => box.bottom));
    spot.style.left = `${left - SPOT_PADDING}px`;
    spot.style.top = `${top - SPOT_PADDING}px`;
    spot.style.width = `${right - left + SPOT_PADDING * 2}px`;
    spot.style.height = `${bottom - top + SPOT_PADDING * 2}px`;
    spotFrame = requestAnimationFrame(follow);
  };
  follow();
}

function highlight() {
  document.querySelectorAll(".coach-target").forEach((el) => el.classList.remove("coach-target"));
  const current = step();
  const selector = current?.play ? `#hand .card[data-name="${current.play}"]` : current?.target;
  const el = selector ? document.querySelector(selector) : null;
  el?.classList.add("coach-target");
  spotlight(el);
}

function say(text, showNext = false, waltz = "") {
  const box = document.getElementById("coach");
  document.getElementById("coachText").textContent = text;
  document.getElementById("coachLabel").textContent = waltz;
  document.getElementById("coachNext").hidden = !showNext;
  box.hidden = false;
  hooks.sound();
}

function showStep() {
  const current = step();
  if (!current) {
    document.getElementById("coach").hidden = true;
    highlight();
    return hooks.refresh();
  }
  if (current.play) hooks.ensure(current.play);
  const number = hooks.waltz() + 1;
  say(current.text, !current.play && !current.until, `Waltz ${number} of 3, tip ${index + 1} of ${steps.length}`);
  hooks.refresh();
}

export function startCoach(callbacks) {
  hooks = callbacks;
  steps = [];
  index = -1;
  document.getElementById("coachNext").onclick = nextStep;
}

export function stopCoach() {
  hooks = null;
  steps = [];
  index = -1;
  document.getElementById("coach").hidden = true;
  document.querySelectorAll(".coach-target").forEach((el) => el.classList.remove("coach-target"));
}

export const coachOn = () => Boolean(hooks);

export function coachHide() {
  steps = [];
  index = -1;
  highlight();
  document.getElementById("coach").hidden = true;
}

// A plain message with nothing to do, like during the rival's scene.
export function coachSay(text) {
  if (!hooks) return;
  steps = [];
  index = -1;
  highlight();
  say(text, false, "Tutorial");
}

// Keeps the current message up until the player presses Next.
export function coachWait() {
  if (!hooks) return Promise.resolve();
  const next = document.getElementById("coachNext");
  next.hidden = false;
  return new Promise((resolve) => {
    next.onclick = () => { next.onclick = nextStep; resolve(); };
  });
}

export function coachWaltz(waltz) {
  if (!hooks) return;
  steps = STEPS[waltz];
  index = 0;
  played = "";
  showStep();
}

function nextStep() {
  index += 1;
  showStep();
}

export function coachAllows(action, card) {
  const current = step();
  if (!hooks || !current) return true;
  // Out of Steps for the card it wants: let them end the measure rather than get stuck.
  if (current.play) return action === "play" ? card.name === current.play : !hooks.canPlayNamed(current.play);
  if (current.until === "end") return action === "end";
  return Boolean(current.until);
}

export function coachPlayed(card) {
  played = card.name;
}

// Called whenever the game is waiting for the player again.
export function coachCheck(composure, mark) {
  const current = step();
  if (!hooks || !current) return;
  if (current.play && played === current.play) { played = ""; nextStep(); }
  else if (current.until === "below" && composure <= mark) nextStep();
}

export function coachEnded() {
  if (step()?.until === "end") nextStep();
  else if (step()?.play) showStep();
}

export const coachHighlight = highlight;
export const coachLightsUp = () => spotlight(null);
