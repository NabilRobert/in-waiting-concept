#!/usr/bin/env python3
"""Rules prototype for the handmaiden game. No art, no story, just the mechanics.

    python3 in_waiting.py play          play one run in the terminal
    python3 in_waiting.py play --seed 7 replay the same month
    python3 in_waiting.py sim           compare bot strategies over many runs

Every tunable number lives in the block below. Change one, re-run sim, and see
what it did to the balance. This file is the reference for the Godot version.
"""
import argparse
import random
from collections import Counter
from copy import copy
from dataclasses import dataclass, field

# --- Tunable numbers ---------------------------------------------------------
DAYS = 12
DAYS_PER_WEEK = 3
SLOTS = ("Morning", "Afternoon", "Evening")
BARS = ("Propriety", "Allure", "Nerve")
BAND = (35, 70)              # a bar is safe while inside this range
START_BARS = [50, 45, 50]
NIGHT_DRIFT = [-1, -3, -3]   # the court wears everything down overnight
STRAIN_LIMIT = 8             # total nights-out-of-band before she collapses
SUSPICION_LIMIT = 100        # the handmaiden is caught
PRINCE_DEFENCE = 26
RIVAL_MOVES = 8
RIVAL_HIT = (10, 16)
TAGS = ("Debt", "Lover", "Faith", "Family")
STALE = (1.0, 0.7, 0.4)      # 1st, 2nd, 3rd+ use of an action within a week
STREAK_BONUS = 0.10          # extra gains per day with all bars safe
STREAK_CAP = 5
CONTACT_GIFT_EVERY = 4       # helps needed for a contact to hand you hearsay
FAVOUR_CAP = 2
FAVOUR_VALUE = 5
GOOD_ENDING_STAIN = 3        # win at or below this for the good ending

# The Ball
DANCES = 3
HAND_SIZE = 4
SECRET_VALUE = 2             # stolen secrets are proof
HEARSAY_VALUE = 1            # gifts from contacts are only gossip
WEAKNESS_MULT = 2            # her weakness tag doubles a card
RISK_BASE = 0.10
RISK_PER_CARD = 0.20
RISK_MIN = 0.05
RISK_PER_SUSPICION = 0.002   # 50 suspicion adds 10% to every press
CALM = 0.15                  # Propriety's grace card lowers risk by this

# Fortune's Wheel, spun at each Court Event
WHEEL_SLICES = 8
WHEEL_BASE_LUCKY = 2         # each safe bar and calm suspicion add one more lucky slice
WHEEL_CALM_SUSPICION = 30
NUDGE_KEEP = 3               # bots only spend a secret on a respin above this many

# Dance lessons: afternoon only, and being sore blocks dirty actions that evening
MOVE_COSTS = (1, 3, 5, 7, 9, 11)   # lessons for each move in a style; only the first 3 fit in one month
BOLD_RISK = 0.10             # flamenco moves raise press risk for the rest of the dance
                             # tango moves ("sure") lower his defence at once, safe from his moves
                             # minuet moves ("charm") can't be countered and add Allure / 10
STANCES = {                  # the prince's stance each dance, and the style that answers it
    "Forward": "Waltz",      # press risk is higher
    "Guarded": "Flamenco",   # your stake is halved when banked
    "Proud": "Tango",        # he recovers Defence after the dance
    "Aloof": "Minuet",    # he walks away after 2 cards
}
DECK_LIMIT = 16              # your Dance Card, including graces and flaws
COURT_SCORES = ((12, 2), (6, 1))   # a Court Dance score of 12+ adds 2 lucky slices, 6+ adds 1
COURT_FAIL_SLICES = 2        # being caught out in public removes this many
HEAL = 8                     # a mend move lifts the lowest bar in a Court Dance
SCHOOL_TARGET = (4, 6, 8, 11, 14, 18)   # score needed to beat each rank's dancer
SCHOOL_SUSPICION = 4         # sneaking out at night
SCHOOL_FAIL_NERVE = 2
SCHOOL_UPGRADE = 3           # each rank climbed adds this much to your best move
FORWARD_RISK = 0.25
PROUD_RECOVERY = 5
ALOOF_CARDS = 2
FIRST_MOVE_ANSWER = 0.0      # a first move is a useful card, but only rank 2+ answers a stance
SCANDAL_TRAINER = "Seamstress"   # a retired courtesan: her lessons cost Stain and Propriety
TRAINERS = {                 # move name, value at the Ball, power. Names are placeholders
    "Laundress": ("Flamenco", (("Heel stamp", 5, "bold"), ("Whirl", 10, "bold"), ("Final pose", 16, "bold"))),
    "Steward": ("Waltz", (("Steady frame", 5, "calm"), ("Graceful lead", 10, "mend"), ("Promenade", 15, "guard"))),
    "Nursemaid": ("Tango", (("Close embrace", 4, "sure"), ("Sharp turn", 7, "sure"), ("The dip", 12, "sure"))),
    "Seamstress": ("Minuet", (("Lingering glance", 2, "charm"), ("Soft whisper", 8, "charm"), ("Stolen touch", 13, "charm"))),
}

CONTACTS = {"Laundress": "Lover", "Steward": "Debt", "Seamstress": "Faith", "Nursemaid": "Family"}


@dataclass(frozen=True)
class Action:
    name: str
    bars: tuple = (0, 0, 0)
    suspicion: int = 0
    slots: tuple = SLOTS
    stain: int = 0
    note: str = ""


ACTIONS = [
    Action("Etiquette drill", (10, -3, -3), note="propriety up, she tires"),
    Action("Gown and beauty", (-3, 10, -2), note="allure up, a little improper"),
    Action("Tea and counsel", (-1, -2, 10), slots=("Morning", "Evening"), note="nerve up"),
    Action("Arrange an encounter", (-2, 14, -6), slots=("Afternoon",), note="big allure, costs nerve; reveals a Ball stance; +1 Prince's Favour card if Allure is 40+"),
    Action("Audience with the Queen Mother", (2, -2, -5), slots=("Morning",), note="once a week, needs Propriety 50+; prince's defence -1"),
    *[Action(f"Help the {who}", (1, 0, 0), suspicion=-12, note=f"every {CONTACT_GIFT_EVERY} helps: {tag} hearsay, no stain")
      for who, tag in CONTACTS.items()],
    *[Action(f"Lesson with the {who}", (-2 if who == SCANDAL_TRAINER else 0, 0, -3), slots=("Afternoon",),
             stain=1 if who == SCANDAL_TRAINER else 0,
             note=f"learn {style}; too sore for dirty actions tonight")
      for who, (style, _) in TRAINERS.items()],
    Action("Dance school", suspicion=SCHOOL_SUSPICION, slots=("Evening",), note="sneak out masked, dance the next rank; win to upgrade your best move"),
    Action("Ask the staff", note="reveals her moves for today and tomorrow"),
    Action("Intercept", (0, 0, -2), note="blocks her move today, but only if you have seen it"),
    Action("Watch the rival", suspicion=4, stain=1, note="reveals her next 3 days of moves"),
    Action("Eavesdrop", suspicion=6, stain=1, note="+1 secret, +2 on Salon days"),
    Action("Search her rooms", suspicion=15, slots=("Evening",), stain=3, note="+2 secrets and reveals her weakness"),
    Action("Blackmail", suspicion=6, stain=3, note="spend 1 secret: +12 to your lowest bar"),
    Action("Spread a rumour", suspicion=9, stain=4, note="spend 1 secret: prince's defence -2"),
]
BY_NAME = {a.name: a for a in ACTIONS}


@dataclass
class Run:
    bars: list = field(default_factory=lambda: list(START_BARS))
    suspicion: int = 0
    strain: int = 0
    defence: int = 0
    stain: int = 0
    streak: int = 0
    favours: int = 0
    day: int = 1
    secrets: list = field(default_factory=list)
    hearsay: list = field(default_factory=list)
    secret_deck: list = field(default_factory=list)
    wheel: list = field(default_factory=list)
    contacts: Counter = field(default_factory=Counter)
    lessons: Counter = field(default_factory=Counter)
    sore: bool = False
    stances: list = field(default_factory=list)
    seed: int = 0
    school_rank: int = 0
    upgrades: Counter = field(default_factory=Counter)
    stances_known: int = 0
    weakness: str = ""
    weakness_known: bool = False
    rival: dict = field(default_factory=dict)    # day -> (bar index or None, hit)
    seen: set = field(default_factory=set)
    venues: dict = field(default_factory=dict)   # day -> "Hunt" | "Salon"
    uses: Counter = field(default_factory=Counter)
    blocked_today: bool = False
    lost: str = ""
    final_defence: int = 0


def new_run(seed):
    """The seed fixes the whole month, so a retry faces the same rival plan."""
    rng = random.Random(seed)
    run = Run(defence=PRINCE_DEFENCE, seed=seed)
    run.secret_deck = [rng.choice(TAGS) for _ in range(80)]
    run.wheel = [rng.random() for _ in range(DAYS)]
    run.weakness = rng.choice(TAGS)
    for day in rng.sample(range(2, DAYS + 1), RIVAL_MOVES):
        target = rng.choice((0, 1, 2, None))   # None means her maid watches you
        run.rival[day] = (target, rng.randint(*RIVAL_HIT))
    for day in rng.sample(range(1, DAYS + 1), 6):
        run.venues[day] = "Hunt" if len(run.venues) % 2 else "Salon"
    run.stances = rng.sample(list(STANCES), DANCES)
    return run


def legal(run, slot):
    out = []
    for a in ACTIONS:
        if slot not in a.slots or (run.sore and a.stain):
            continue
        if a.name in ("Blackmail", "Spread a rumour") and not run.secrets:
            continue
        if a.name == "Audience with the Queen Mother" and (run.bars[0] < 50 or run.uses[a.name]):
            continue
        out.append(a)
    return out


def visit(run, who):
    """Time with a contact, in a lesson or helping out, builds toward their gift."""
    run.contacts[who] += 1
    if run.contacts[who] % CONTACT_GIFT_EVERY == 0:
        run.hearsay.append(CONTACTS[who])


def apply_action(run, a, choose=None, log=lambda text: None):
    mult = STALE[min(run.uses[a.name], len(STALE) - 1)] * (1 + STREAK_BONUS * min(run.streak, STREAK_CAP))
    run.uses[a.name] += 1
    for i, delta in enumerate(a.bars):
        run.bars[i] += round(delta * mult) if delta > 0 else delta
    run.suspicion = max(0, run.suspicion + a.suspicion)
    run.stain += a.stain

    venue = run.venues.get(run.day)
    if a.name == "Arrange an encounter":
        if venue == "Hunt":
            run.bars[1] += 6
        if run.bars[1] >= 40:
            run.favours = min(FAVOUR_CAP, run.favours + 1)
        run.stances_known = min(DANCES, run.stances_known + 1)
    elif a.name == "Audience with the Queen Mother":
        run.defence -= 1
    elif a.name.startswith("Help the "):
        visit(run, a.name[len("Help the "):])
    elif a.name.startswith("Lesson with the "):
        who = a.name[len("Lesson with the "):]
        run.lessons[who] += 1
        run.sore = True
        visit(run, who)
    elif a.name == "Dance school":
        dance_school(run, choose or bot_duel, log)
    elif a.name == "Intercept":
        run.blocked_today = run.day in run.seen
    elif a.name == "Ask the staff":
        run.seen |= {run.day, run.day + 1}
    elif a.name == "Watch the rival":
        run.seen |= {run.day + i for i in range(3)}
    elif a.name == "Eavesdrop":
        for _ in range(2 if venue == "Salon" else 1):
            run.secrets.append(run.secret_deck.pop())
    elif a.name == "Search her rooms":
        run.secrets += [run.secret_deck.pop(), run.secret_deck.pop()]
        run.weakness_known = True
    elif a.name == "Blackmail":
        run.secrets.pop(0)
        run.bars[run.bars.index(min(run.bars))] += 12
    elif a.name == "Spread a rumour":
        run.secrets.pop(0)
        run.defence -= 2
    run.bars = [max(0, min(100, b)) for b in run.bars]
    if run.suspicion >= SUSPICION_LIMIT:
        run.lost = "caught"


def lucky_slices(run, dance_bonus=0):
    safe = sum(BAND[0] <= b <= BAND[1] for b in run.bars)
    return max(1, min(WHEEL_SLICES - 1, WHEEL_BASE_LUCKY + safe + (run.suspicion < WHEEL_CALM_SUSPICION) + dance_bonus))


def fortune(run, slice_index, dance_bonus=0):
    """Applies one wheel slice and returns (lucky, description)."""
    lucky = slice_index < lucky_slices(run, dance_bonus)
    i = slice_index % 4
    if lucky:
        if i == 0:
            run.secrets.append(run.secret_deck.pop())
            return True, "A secret falls into your lap"
        if i == 1:
            run.favours = min(FAVOUR_CAP, run.favours + 1)
            return True, "The prince asks after her: +1 Prince's Favour"
        if i == 2:
            run.suspicion = max(0, run.suspicion - 15)
            return True, "The staff close ranks: Suspicion -15"
        run.defence -= 2
        return True, "The rival stumbles: defence -2"
    if i == 0:
        run.suspicion += 12
        return False, "A maid talks: Suspicion +12"
    if i == 1:
        run.bars[run.bars.index(max(run.bars))] -= 12
        return False, "Whispers at court: your highest bar -12"
    if i == 2:
        run.defence += 2
        return False, "The rival shines: defence +2"
    if run.secrets:
        run.secrets.pop(0)
        return False, "A letter goes missing: you lose a secret"
    run.bars[run.bars.index(min(run.bars))] -= 8
    return False, "A bad evening: your lowest bar -8"


def bot_nudge(run, text):
    return len(run.secrets) > NUDGE_KEEP


def court_dance(run, choose, log):
    """One short dance with a noble. The score loads Fortune's Wheel."""
    rng = random.Random(run.seed * 100 + run.day)
    stance = rng.choice(list(STANCES))
    deck = build_deck(run)
    rng.shuffle(deck)
    log(f"Court Dance: your partner is {stance}. {STANCES[stance]} answers it.")
    score = solo_dance(run, rng, deck, stance, choose, log)
    if score <= 0:
        log("You are caught out in front of the court.")
        return -COURT_FAIL_SLICES
    bonus = next((slices for needed, slices in COURT_SCORES if score >= needed), 0)
    log(f"You score {score}: {bonus:+d} lucky slices.")
    return bonus


def solo_dance(run, rng, deck, stance, choose, log, heal=True):
    """A dance outside the Ball, scored by what it would have taken off Defence."""
    banked, left, _ = waltz(run, rng, deck, [], stance, choose, log, 1, 999, heal)
    return banked + 999 - left


def dance_school(run, choose, log):
    """Sneak out masked and dance the next rank. Winning upgrades your best move."""
    if run.school_rank >= len(SCHOOL_TARGET):
        return
    rng = random.Random(run.seed * 100 + run.day + 50)
    stance = rng.choice(list(STANCES))
    target = SCHOOL_TARGET[run.school_rank]
    deck = build_deck(run)
    rng.shuffle(deck)
    log(f"Dance school, rank {run.school_rank + 1}: score {target}. Your opponent is {stance}. {STANCES[stance]} answers it.")
    score = solo_dance(run, rng, deck, stance, choose, log, heal=False)
    if score >= target:
        run.school_rank += 1
        moves = known_moves(run)
        if moves:
            best = max(moves, key=lambda c: c.value)
            run.upgrades[best.name] += 1
            log(f"You climb to rank {run.school_rank}. {best.name} grows stronger.")
    else:
        run.bars[2] = max(0, run.bars[2] - SCHOOL_FAIL_NERVE)
        log(f"You score {score} and limp home. Nerve -{SCHOOL_FAIL_NERVE}.")


def court_event(run, nudge, choose=None, log=lambda text: None):
    """Dance, then spin the wheel. After a bad result you may spend a secret to spin again."""
    bonus = court_dance(run, choose or bot_duel, log)
    log(f"{lucky_slices(run, bonus)} of {WHEEL_SLICES} slices are lucky.")
    roll = run.wheel.pop()
    index = int(roll * WHEEL_SLICES)
    probe = clone(run)
    lucky, text = fortune(probe, index, bonus)
    if not lucky and run.secrets and nudge(run, text):
        run.secrets.pop(0)
        index = int(run.wheel.pop() * WHEEL_SLICES)
    lucky, text = fortune(run, index, bonus)
    run.bars = [max(0, b) for b in run.bars]
    return text


def end_day(run, nudge=bot_nudge, log=lambda text: None, choose=None):
    move = run.rival.get(run.day)
    if move:
        target, hit = move
        if run.blocked_today:
            run.defence -= 1
        else:
            run.defence += 1
            if target is None:
                run.suspicion += hit
            else:
                run.bars[target] = max(0, run.bars[target] - hit)
    run.blocked_today = False
    run.sore = False
    if run.day % DAYS_PER_WEEK == 0 and run.day < DAYS:
        log(court_event(run, nudge, choose, log))
    run.bars = [max(0, min(100, b + d)) for b, d in zip(run.bars, NIGHT_DRIFT)]
    outside = sum(not BAND[0] <= b <= BAND[1] for b in run.bars)
    run.strain += outside
    run.streak = 0 if outside else run.streak + 1
    if run.strain >= STRAIN_LIMIT:
        run.lost = "collapse"
    if run.suspicion >= SUSPICION_LIMIT:
        run.lost = "caught"
    if run.day % DAYS_PER_WEEK == 0:
        run.uses.clear()
    run.day += 1


# --- The Ball ----------------------------------------------------------------
@dataclass(frozen=True)
class Card:
    name: str
    value: int
    tag: str = ""         # empty means wild
    power: str = ""       # calm, flair, guard, or flaw (unplayable)
    style: str = ""       # the dance style of a learned move
    rank: int = 0         # a move's place in its style, which decides how well it answers a stance


GRACES = (Card("Propriety's Grace", 2, power="calm"),
          Card("Allure's Grace", 3, power="flair"),
          Card("Nerve's Grace", 2, power="guard"))


def moves_known(lessons):
    known = 0
    for cost in MOVE_COSTS:
        if lessons < cost:
            break
        lessons -= cost
        known += 1
    return known


def lessons_to_next(lessons):
    for cost in MOVE_COSTS:
        if lessons < cost:
            return cost - lessons
        lessons -= cost
    return 0


def build_deck(run):
    """Secrets are the attack. Bars decide whether you get graces or dead cards."""
    def card(tag, label, value):
        return Card(f"{tag} {label}", value * (WEAKNESS_MULT if tag == run.weakness else 1), tag)

    deck = [card(tag, "secret", SECRET_VALUE) for tag in run.secrets]
    deck += [card(tag, "hearsay", HEARSAY_VALUE) for tag in run.hearsay]
    deck += [Card("Prince's Favour", FAVOUR_VALUE)] * run.favours
    deck += known_moves(run)
    fixed = [grace if BAND[0] <= bar <= BAND[1] else Card("Flaw", 0, power="flaw")
             for bar, grace in zip(run.bars, GRACES)]
    # Your Dance Card has a limit. The final game lets the player choose what's on it.
    deck.sort(key=lambda c: (c.rank > 1, c.value), reverse=True)
    return deck[:DECK_LIMIT - len(fixed)] + fixed


def known_moves(run):
    out = []
    for who, (style, moves) in TRAINERS.items():
        for rank, (name, value, power) in enumerate(moves[:moves_known(run.lessons[who])], 1):
            out.append(Card(name, value + (run.bars[1] // 10 if power == "charm" else 0) + run.upgrades[name] * SCHOOL_UPGRADE,
                            power=power, style=style, rank=rank))
    return out


def press_risk(laid, calm, suspicion):
    return max(RISK_MIN, RISK_BASE + RISK_PER_CARD * (laid - 1) + RISK_PER_SUSPICION * suspicion - calm)


def waltz(run, rng, deck, hand, stance, choose, log, number, defence, heal=False):
    """One dance: build a stake card by card, then bank it before your partner makes a move."""
    def draw():
        while len(hand) < HAND_SIZE and deck:
            hand.append(deck.pop())

    draw()
    stake, chain, tag, laid, calm, guard, mend, answer, redrawn = 0, 0, "", 0, 0.0, False, False, 0.0, False
    while True:
        if stance == "Aloof" and answer < 1 and laid >= ALOOF_CARDS + (answer > 0):
            log("They lose interest and turn away.")
            break
        playable = [c for c in hand if c.power != "flaw"]
        risk = press_risk(laid, calm, run.suspicion) if laid else 0.0
        if stance == "Forward" and laid:
            risk += FORWARD_RISK * (1 - answer)
        can_redraw = not laid and not redrawn and bool(deck)
        if not playable and not can_redraw:
            break
        card = choose(run, number, defence, stake, risk, chain, tag, playable, None if answer == 1 else stance, can_redraw)
        if card is None:
            break
        if card == "redraw":
            deck.extend(hand)
            hand.clear()
            rng.shuffle(deck)
            draw()
            redrawn = True
            log("You redraw your hand.")
            continue
        hand.remove(card)
        if laid and card.power != "charm" and rng.random() < risk:
            if guard:
                guard = False
                log("Your partner pulls a move, but you hold your nerve.")
            else:
                stake = stake // 2 if mend else 0
                log(f"Your partner pulls a move on you. {stake} of your stake survives.")
                break
        if card.tag:    # wilds add a flat value and keep the chain alive without growing it
            chain = chain + 1 if card.tag == tag else 1
            tag = card.tag
        if card.power == "sure":
            defence -= card.value
        else:
            stake += card.value * (chain if card.tag else 1)
        laid += 1
        if card.style == STANCES[stance]:
            answer = max(answer, 1.0 if card.rank > 1 else FIRST_MOVE_ANSWER)
        calm += {"calm": CALM, "bold": -BOLD_RISK}.get(card.power, 0)
        guard = guard or card.power == "guard"
        mend = mend or card.power == "mend"
        if card.power == "mend" and heal:
            low = run.bars.index(min(run.bars))
            run.bars[low] += HEAL
            log(f"The dance steadies her. {BARS[low]} +{HEAL}.")
        log(f"{card.name}: chain x{max(chain, 1)}, stake {stake}, defence {defence}.")
        if defence <= 0:
            break
    if stance == "Guarded" and answer < 1:
        stake = int(stake * (0.5 + answer / 2))
        log(f"The guard holds. Only {stake} lands.")
    hand[:] = [c for c in hand if c.power != "flaw"]
    return stake, defence, answer


def duel(run, rng, choose, log=lambda text: None):
    """The Ball: three waltzes with the prince, using one deck."""
    deck = build_deck(run)
    rng.shuffle(deck)
    hand, defence = [], run.defence
    for dance in range(1, DANCES + 1):
        stance = run.stances[dance - 1]
        log(f"\nDance {dance}: the prince is {stance}. {STANCES[stance]} answers it.")
        stake, defence, answer = waltz(run, rng, deck, hand, stance, choose, log, dance, defence)
        defence -= stake
        if stance == "Proud" and answer < 1 and defence > 0:
            recovered = int(PROUD_RECOVERY * (1 - answer))
            defence += recovered
            log(f"He recovers {recovered} Defence.")
        log(f"Dance {dance} ends. Prince's defence {defence}.")
        if defence <= 0:
            break
    return defence


def bot_duel(run, dance, defence, stake, risk, chain, tag, playable, stance, can_redraw):
    """Chases the longest chain and presses only when the odds favour it."""
    def next_gain(card):  # what this card would add to the stake
        if not card.tag:
            return card.value
        return card.value * (chain + 1 if card.tag == tag else 1)

    if stake >= defence:
        return None
    answers = [c for c in playable if stance and c.style == STANCES[stance] and c.rank > 1]
    if answers:
        return max(answers, key=lambda c: c.value)
    if stance and can_redraw and any(c.style == STANCES[stance] and c.rank > 1 for c in known_moves(run)):
        return "redraw"
    if not playable:
        return None
    if not tag:
        counts = Counter(c.tag for c in playable if c.tag)
        return max(playable, key=lambda c: (counts[c.tag] * c.value, c.value))
    best = max(playable, key=lambda c: next_gain(c) + (4 if c.power in ("calm", "guard", "mend", "charm") else 0))
    if best.power == "charm":
        return best
    if dance == DANCES and stake < defence:
        return best
    return best if (1 - risk) * (stake + next_gain(best)) > stake else None


def finish(run, seed):
    """Plays the Ball and records the result on the run."""
    run.final_defence = duel(run, random.Random(seed + 2), bot_duel)
    return run


def won(run):
    return not run.lost and run.final_defence <= 0


def ending(run):
    if run.lost:
        return "Bad: caught" if run.lost == "caught" else "Bad: she collapses"
    if not won(run):
        return "Bad: the prince stays out of reach"
    return "Good" if run.stain <= GOOD_ENDING_STAIN else "Dark"


# --- Bots --------------------------------------------------------------------
def bar_fix(run, slot, banned=lambda a: False):
    """The action that best pulls the worst bar back toward the middle of the band."""
    worst = max(range(3), key=lambda i: abs(run.bars[i] - 52))
    options = [a for a in legal(run, slot) if not a.stain and not banned(a)]
    direction = 1 if run.bars[worst] < 52 else -1
    return max(options, key=lambda a: a.bars[worst] * direction)


def best_contact(run):
    """Works one contact at a time, favouring the rival's weakness once known."""
    def rank(who):
        tag = CONTACTS[who]
        return (run.weakness_known and tag == run.weakness, Counter(run.secrets + run.hearsay)[tag], run.contacts[who])
    return BY_NAME[f"Help the {max(CONTACTS, key=rank)}"]


def bot_random(run, slot, rng):
    return rng.choice(legal(run, slot))


def bot_clean(run, slot, rng):
    """No dirty actions at all: scouts by asking, leans on the servants for secrets."""
    if run.day in run.rival and run.day in run.seen and not run.blocked_today:
        return BY_NAME["Intercept"]
    if run.day not in run.seen:
        return BY_NAME["Ask the staff"]
    if any(b < BAND[0] + 8 or b > BAND[1] - 3 for b in run.bars):
        return bar_fix(run, slot)
    if BY_NAME["Audience with the Queen Mother"] in legal(run, slot):
        return BY_NAME["Audience with the Queen Mother"]
    if slot == "Afternoon" and run.favours < FAVOUR_CAP and run.bars[2] >= 48:
        return BY_NAME["Arrange an encounter"]
    return best_contact(run)


def bot_dirty(run, slot, rng):
    """Dirty actions only, ignoring the bars."""
    if run.suspicion >= 70:
        return best_contact(run)
    return BY_NAME["Search her rooms"] if slot == "Evening" else BY_NAME["Eavesdrop"]


def bot_careful(run, slot, rng, stain_budget=99, lessons=0, trainer="", school=0):
    """A careful player: scouts, blocks what it sees, spies only when the bars allow."""
    move_today = run.day in run.rival and run.day in run.seen
    if move_today and not run.blocked_today:
        return BY_NAME["Intercept"]
    if run.day not in run.seen or run.day + 1 not in run.seen:
        return BY_NAME["Watch the rival"] if run.stain + 1 <= stain_budget / 3 else BY_NAME["Ask the staff"]
    if slot == "Afternoon" and sum(run.lessons.values()) < lessons and all(b >= BAND[0] for b in run.bars):
        lesson = BY_NAME[f"Lesson with the {trainer}"]
        if run.stain + lesson.stain <= stain_budget:
            return lesson
    if any(b < BAND[0] + 8 or b > BAND[1] - 3 for b in run.bars):
        return bar_fix(run, slot)
    if run.suspicion >= 40:
        return best_contact(run)
    if slot == "Evening" and run.sore and run.school_rank < school and known_moves(run) and run.bars[2] >= 45:
        return BY_NAME["Dance school"]
    if slot == "Evening" and not run.weakness_known and run.stain + 3 <= stain_budget:
        return BY_NAME["Search her rooms"]
    if BY_NAME["Audience with the Queen Mother"] in legal(run, slot):
        return BY_NAME["Audience with the Queen Mother"]
    if slot == "Afternoon" and run.favours < 2 and run.bars[2] >= 50:
        return BY_NAME["Arrange an encounter"]
    return BY_NAME["Eavesdrop"] if run.stain + 1 <= stain_budget else best_contact(run)


def bot_light(run, slot, rng):
    """The careful player, keeping to the good ending's stain limit."""
    return bot_careful(run, slot, rng, stain_budget=GOOD_ENDING_STAIN)


def dancer(trainer, lessons, stain_budget=99, school=0):
    """The careful player, also putting afternoons into one trainer's lessons."""
    return lambda run, slot, rng: bot_careful(run, slot, rng, stain_budget, lessons, trainer, school)


def generalist(lessons):
    """The careful player, sharing its lessons evenly between all the trainers."""
    def bot(run, slot, rng):
        trainer = min(TRAINERS, key=lambda who: run.lessons[who])
        return bot_careful(run, slot, rng, 99, lessons, trainer)
    return bot


def play_out(seed, bot):
    run, rng = new_run(seed), random.Random(seed + 1)
    while run.day <= DAYS and not run.lost:
        for slot in SLOTS:
            action = bot(run, slot, rng)
            apply_action(run, action if action in legal(run, slot) else best_contact(run))
            if run.lost:
                return run
        end_day(run)
    return finish(run, seed)


def clone(run):
    child = copy(run)
    child.bars, child.secrets, child.hearsay, child.secret_deck = run.bars[:], run.secrets[:], run.hearsay[:], run.secret_deck[:]
    child.seen, child.uses, child.contacts, child.lessons = set(run.seen), Counter(run.uses), Counter(run.contacts), Counter(run.lessons)
    child.wheel = run.wheel[:]
    return child


def sim(runs):
    print(f"{'strategy':<24}{'win':>6}{'good':>7}{'dark':>7}{'caught':>8}{'collapse':>10}{'lost Ball':>11}{'close':>7}{'stain':>7}")
    for name, bot in (("Random", bot_random), ("Clean only", bot_clean), ("Dirty only", bot_dirty),
                      ("Careful, no lessons", bot_careful), ("One lesson each", generalist(4)),
                      ("Flamenco and school", dancer("Laundress", 9, 99, 3)),
                      ("Waltz and school", dancer("Steward", 9, 99, 3)),
                      ("Tango and school", dancer("Nursemaid", 9, 99, 3)),
                      ("Minuet and school", dancer("Seamstress", 9, 99, 3)),
                      ("Flamenco, low stain", dancer("Laundress", 9, GOOD_ENDING_STAIN, 3)),
                      ("Waltz, low stain", dancer("Steward", 9, GOOD_ENDING_STAIN, 3)),
                      ("Tango, low stain", dancer("Nursemaid", 9, GOOD_ENDING_STAIN, 3)),
                      ("Minuet, low stain", dancer("Seamstress", 9, GOOD_ENDING_STAIN, 3))):
        results = [play_out(seed, bot) for seed in range(runs)]
        ends = Counter(ending(r) for r in results)
        close = sum(not r.lost and abs(r.final_defence) <= 2 for r in results)
        pct = lambda n: f"{n / runs:.0%}"
        print(f"{name:<24}{pct(sum(map(won, results))):>6}{pct(ends['Good']):>7}{pct(ends['Dark']):>7}"
              f"{pct(ends['Bad: caught']):>8}{pct(ends['Bad: she collapses']):>10}{pct(ends['Bad: the prince stays out of reach']):>11}"
              f"{pct(close):>7}{sum(r.stain for r in results) / runs:>7.1f}")


def show(run):
    bars = "  ".join(f"{n} {b}{'' if BAND[0] <= b <= BAND[1] else ' (!)'}" for n, b in zip(BARS, run.bars))
    print(f"\n=== Day {run.day}/{DAYS}  {run.venues.get(run.day, 'quiet day')} ===")
    print(f"{bars}  (safe {BAND[0]}-{BAND[1]})  Streak {run.streak}")
    print(f"Suspicion {run.suspicion}/{SUSPICION_LIMIT}  Strain {run.strain}/{STRAIN_LIMIT}  "
          f"Stain {run.stain} (good ending {GOOD_ENDING_STAIN} or less)  Prince's defence {run.defence}")
    print(f"Secrets {dict(Counter(run.secrets)) or 'none'}  Hearsay {dict(Counter(run.hearsay)) or 'none'}  Prince's Favours {run.favours}  "
          f"Weakness {run.weakness if run.weakness_known else 'unknown'}")
    print("Lessons " + ", ".join(f"{w} ({TRAINERS[w][0]}) {moves_known(run.lessons[w])} moves, next in {lessons_to_next(run.lessons[w])}" for w in TRAINERS)
          + ("  Too sore for dirty actions tonight" if run.sore else ""))
    print(f"Dance school rank {run.school_rank}/{len(SCHOOL_TARGET)}")
    print("Contacts " + ", ".join(f"{w} {run.contacts[w] % CONTACT_GIFT_EVERY}/{CONTACT_GIFT_EVERY}" for w in CONTACTS))
    known = []
    for day in sorted(run.seen):
        move = run.rival.get(day)
        if day >= run.day and move:
            known.append(f"day {day}: {BARS[move[0]] if move[0] is not None else 'Suspicion'} {move[1]}")
    print(f"Rival moves seen: {', '.join(known) or 'none'}")
    print("Prince's stances at the Ball: " + ", ".join(run.stances[i] if i < run.stances_known else "unknown" for i in range(DANCES))
          + "  (each encounter reveals one)")


def player_nudge(run, text):
    print(f"\nThe wheel lands on: {text}")
    return input(f"Spend a secret to spin again? You have {len(run.secrets)}. (y/n) > ").strip().lower() == "y"


def tease(run):
    """The night always ends on something to come back for."""
    counts = Counter(run.secrets + run.hearsay)
    if run.day in run.rival and run.day in run.seen:
        return "Your sources say she moves tomorrow."
    if run.venues.get(run.day) == "Hunt":
        return "The prince rides out tomorrow. He will be alone by afternoon."
    if run.venues.get(run.day) == "Salon":
        return "Tomorrow's salon will be full of loose tongues."
    if run.day % DAYS_PER_WEEK == 0:
        return f"Court Event tomorrow night. The wheel has {lucky_slices(run)} lucky slices so far."
    if counts:
        tag, n = counts.most_common(1)[0]
        return f"One more {tag} secret would make a {n + 1}-card chain."
    return "Someone has been in your mistress's rooms."


def player_duel(run, dance, defence, stake, risk, chain, tag, playable, stance, can_redraw):
    print(f"\nDance {dance}/{DANCES}. Prince's defence {defence}. Stake {stake}. "
          f"Pressing risks {risk:.0%}." if stake else f"\nDance {dance}/{DANCES}. Prince's defence {defence}. Lay your first card.")
    for i, c in enumerate(playable, 1):
        style = f"{c.style} move, " if c.style else ""
        print(f"  {i}. {c.name} ({style}value {c.value}{', wild' if not c.tag else ''}{', ' + c.power if c.power else ''})")
    if stake:
        print("  0. Bank your stake")
    elif can_redraw:
        print("  r. Redraw your hand (once per dance)")
    while True:
        choice = input("> ").strip()
        if choice == "0" and stake:
            return None
        if choice == "r" and can_redraw:
            return "redraw"
        if choice.isdigit() and 1 <= int(choice) <= len(playable):
            return playable[int(choice) - 1]
        print("Enter one of the numbers above.")


def play(seed):
    print(f"Month seed {seed}. Use --seed {seed} to retry this month.")
    run = new_run(seed)
    while run.day <= DAYS and not run.lost:
        show(run)
        for slot in SLOTS:
            options = legal(run, slot)
            print(f"\n{slot}:")
            for i, a in enumerate(options, 1):
                print(f"  {i:>2}. {a.name:<32} {f'stain +{a.stain}  ' if a.stain else ''}{a.note}")
            while True:
                choice = input("> ").strip()
                if choice.isdigit() and 1 <= int(choice) <= len(options):
                    break
                print(f"Enter a number from 1 to {len(options)}.")
            apply_action(run, options[int(choice) - 1], player_duel, print)
            if run.lost:
                break
        if not run.lost:
            end_day(run, player_nudge, print, player_duel)
        if not run.lost and run.day <= DAYS:
            print(f"\nNight falls. {tease(run)}")
    if not run.lost:
        show(run)
        print("\nThe Ball begins.")
        run.final_defence = duel(run, random.Random(seed + 2), player_duel, print)
    print(f"\nEnding: {ending(run)}. Stain {run.stain}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=("play", "sim"))
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--runs", type=int, default=3000)
    args = parser.parse_args()
    if args.mode == "play":
        play(random.randrange(10**6) if args.seed is None else args.seed)
    else:
        sim(args.runs)
