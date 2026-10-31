// Everything the prince says. The writer can replace these lines without touching the game.
// Each waltz has its own mood: 0 is polite, 1 is flirtatious, 2 is honest.
const INTENT = {
  lead: [
    ["Allow me to lead, my lady.", "You'll find I rarely follow.", "Keep up, if you can."],
    ["Let me show you how it's done.", "Careful. I may not let go.", "Look at me, not the floor."],
    ["Enough games. Dance with me.", "Tell me the truth. Who are you?", "Stay with me. Just this once."],
  ],
  recover: [
    ["Forgive me. Where were we?", "I've danced with better. Perhaps.", "A pleasant evening, isn't it?"],
    ["You nearly had me. Nearly.", "Let me catch my breath.", "Not so fast, my lady."],
    ["No. I can't lose my head tonight.", "A crown can't afford this.", "I should walk away. I know it."],
  ],
  pressure: [
    ["People are staring at you, you know.", "That gown is very brave.", "Is this your first Ball?"],
    ["Your hands are trembling.", "Everyone's waiting for you to stumble.", "Are you always this nervous?"],
    ["Why are you really here?", "Does anyone tell you the truth?", "What do you want from me?"],
  ],
};

const REACTIONS = {
  Flamenco: ["amused", "Good heavens.", "Is that allowed?", "Bold!", "You'd make a fine matador."],
  Waltz: ["calm", "Beautifully steady.", "You're easy to dance with.", "Who taught you that frame?"],
  Tango: ["surprised", "I lost my footing.", "Where did you learn that?", "Careful, people will talk."],
  Minuet: ["charmed", "You're very close.", "Don't look at me like that.", "My lady, please."],
  secret: ["surprised", "Is that true?", "She did what?", "Tell me more.", "I had no idea."],
  hearsay: ["amused", "Only gossip, surely.", "Who told you that?"],
  favour: ["charmed", "You remembered.", "I'm glad you came."],
  encore: ["surprised", "Don't stop now!", "The whole room is watching you.", "Even the band can't look away."],
  quick: ["amused", "So light on your feet!", "How do you move like that?"],
  rhythm: ["amused", "You've found the music.", "Now that is a rhythm."],
  grace: ["calm", "Lovely.", "How graceful."],
  closer: ["charmed", "Already? Stay a moment.", "You leave me wanting."],
  flourish: ["surprised", "Magnificent!", "I've never seen anything like it.", "Breathtaking."],
  answered: ["surprised", "You saw straight through me.", "How did you know?"],
  hit: ["amused", "There. Now I have you.", "You see? I lead."],
  blocked: ["amused", "You hold your ground. I like that.", "You won't be moved, will you?"],
  swept: ["flustered", "I can't look away.", "You've undone me."],
  charmed: ["charmed", "Must it end so soon?", "Save me the next dance."],
  closed: ["charmed", "Until the next waltz, then.", "You leave me wanting more."],
  failed: ["stern", "A pleasant dance. Nothing more.", "Thank you, my lady. That will be all."],
  stumbled: ["amused", "Careful, my lady.", "I have you. Breathe.", "Don't lose the music now."],
};

// What your mistress says as she plays each kind of card.
const HER_LINES = {
  Flamenco: ["Keep up, Your Highness.", "Did I startle you?", "Try to stop me."],
  Waltz: ["Shall we?", "You lead well.", "I'm quite comfortable here."],
  Tango: ["Careful where you step.", "You seem off balance, Your Highness."],
  Minuet: ["Don't look away.", "Is something the matter?", "I could say the same of you."],
  secret: ["A little bird told me something.", "Have you heard about the rival?", "I shouldn't say, but..."],
  hearsay: ["They do say...", "It's only what I've heard."],
  favour: ["I was hoping you'd notice.", "You're very kind."],
  encore: ["Music, please. One more!", "Let them watch."],
  quick: ["Try to keep up!", "Faster, if you can."],
  rhythm: ["Listen to the music.", "Do you hear it?"],
  grace: ["Thank you, Your Highness.", "How lovely."],
  closer: ["Until the next waltz.", "That's enough for now."],
};

const GREETINGS = ["May I have this dance, my lady?", "You again. I hoped it would be.", "No masks now. Dance with me."];

// The short line under each key art moment.
const MOMENTS = {
  Encore: ["The whole ballroom holds its breath.", "Even the band can't look away.", "He forgets the steps, and stares."],
  "Final pose": ["She holds the pose, and he is lost for words.", "The room erupts. He doesn't move."],
  Promenade: ["They glide across the floor as one.", "For a moment, he forgets anyone else is there."],
  "The dip": ["She falls back, and he catches his breath.", "He was not ready for that."],
  "Stolen touch": ["A brush of her hand, and his composure slips.", "He was surprised, and he can't hide it."],
  attack: ["He sweeps her off her balance.", "He takes control, and she can barely keep up.", "For a moment, the dance is entirely his."],
};

const pick = (list, last) => {
  const options = list.filter((line) => line !== last);
  return options[Math.floor(Math.random() * options.length)];
};
let lastIntent = "", lastReaction = "";

export function intentLine(type, waltz) {
  lastIntent = pick(INTENT[type][Math.min(waltz, 2)], lastIntent);
  return lastIntent;
}
export function reaction(key) {
  const [face, ...lines] = REACTIONS[key];
  lastReaction = pick(lines, lastReaction);
  return { face, text: lastReaction };
}
export const greeting = (waltz) => GREETINGS[Math.min(waltz, 2)];

let lastMoment = "";
export function momentLine(key) {
  lastMoment = pick(MOMENTS[key], lastMoment);
  return lastMoment;
}

let lastHer = "";
export function herLine(key) {
  lastHer = pick(HER_LINES[key], lastHer);
  return lastHer;
}
