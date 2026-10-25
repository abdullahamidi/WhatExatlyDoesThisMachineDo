# STORY BIBLE: Living World (WP22 design, narrative lead)

User request (2026-10-24): the scene feels lonely with only the machine. Add things that show what kind of place this
is: a ruined world, and animals, people and objects living in it. Each era should change them a little, and the
change should show in the background and around the machine. They may break the fourth wall: turn to the camera and
say mysterious, funny or creepy things to the player, depending on the era. The world does not have to get better. It
should lead to whatever the ending holds, and the environment should carry the story ("What exactly does this
machine do?").

- Status: design only. No file under `src/`, `scripts/`, `public/` or the tests was changed.
- Companion doc: `docs/plan/PART_TIERS.md` (WP23, part evolution). §10 below hooks the two together.
- Synthesis:
  - Base: the winning draft "The Recording" (`uncanny`), with judge totals 54 + 58 = **112**.
  - Grafts from "Witnesses" (49 + 50 = 99) and "Hecklers" (39 + 45 = 84).
  - Every must-fix from both judges is resolved. Appendix C maps each one to the section that fixes it.
- Line bank: 63 lines. Every line is 52 characters or fewer (longest 49). Each passes the pre-finale ban list and the
  "you" budget.
  - Checked by `scratchpad/bible/final/validate.mjs`, which also generates the §5 table.
  - Scratchpad = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`.

## 0. Decisions at a glance

| # | decision |
|---|---|
| D1 | **Conceit: the world is a recording being played back.** The denizens are fragments of one prior day. Each era plays them more completely. The finale finishes the playback. |
| D2 | **Cast: 6 denizens, 5 of them speak.** Speakers: the Inspector, the Dog, the Crow, the Girl with the Lantern, the Payphone. Sensor 7 never speaks. The mix is 2 people, 2 animals, 2 objects. |
| D3 | **The machine keeps its voice and its typewriter.** Denizen bubbles fade in as whole lines. Only the finale reveal types. |
| D4 | **No denizen ever looks at the machine, and none ever says the R-word**, postgame included. |
| D5 | **"You" budget:** before the reveal, at most one viewer-addressed "you" line per era. `Operator identity: you.` stays the first time anyone says the player is the operator. |
| D6 | **The world gets stranger, not better, until the finale.** Each era gives the world something and takes something back (a gift with a receipt). Before the finale nothing un-happens on screen. |
| D7 | **Rare text.** 120 s minimum gap. Era caps of 6 / 7 / 6 / 6 / 4 moments. Wordless glances fill the idle stretches. The finale has no denizen words. The postgame has one line. |
| D8 | **Tier-ups touch the world.** Every part tier-up (WP23) sends a one-beat ripple through the world, matched to the current era. |
| D9 | **Demo standalone.** Eras I-II meet the whole cast and plant five open questions. After the cap: one "tape runs out" freeze, three lines, then the dog lies facing the camera for the rest of the session. |
| D10 | **State: one optional `world` block in save v2** (lines seen this cycle / ever). Every visible cycle trace is derived from `prestige.cycle`, so nothing else is stored. |

---

## 1. Premise and secret

### 1.1 Pitch (how it should feel)

The wasteland is not empty. It is playing back. At the edges of the frame a few figures loop, stutter and repeat like
a worn tape:
- an inspector doing rounds;
- a chained dog;
- a crow paused mid-flap in the air;
- a small girl in a yellow raincoat, far away in a lit window;
- a dead payphone;
- a survey sensor on a tripod.

They never look at the machine. They look at you.

Each era the playback gets more complete: steadier, more solid, more colored. The world around them gets stranger.
At the finale the playback reaches its end and the world is whole. For one last frame they all look at you. Then they
turn their backs and live their day, and they never see you again. The phone line is the one connection left.

### 1.2 The secret (developer-only; never shown verbatim)

1. **The day.** The Restoration Engine winds the world back toward `world state, prior`. That state is one day: a
   Tuesday, overcast, rain in the forecast that had not fallen yet.
2. **The leak.** As the machine works, pieces of that day leak in early through its intake, like tape drawn back
   through the heads. They arrive ruined, partial and stuck. The machine notices and drops them
   (`Unlabeled component detected in intake. Ignored.`).
3. **Why they cannot see the machine.** The machine was never part of world state, prior. They feel it (tremor, heat,
   static, hum) but cannot see it. This is also why it stays rust after the finale (`ART_ERA5.md:180`). The house rule
   "never look at the machine" is literal.
4. **The seam.** Until the playback is complete there is a seam, and through it the fragments can see out to the one
   real observer: the player. That is how they know your light is on, the hour where you are, and that you keep
   looking away.
   - They are not observers. They are the recording.
   - So `Observers: none.` and `Observer count: 1.` are both literally true.
5. **The last look.** The seam closes when the machine names its operator: the typed line `Operator identity: you.`
   is their last look.
6. **The postgame is the same day, held.** It lasts as long as the machine runs (`Restoration holds while the machine
   runs.`). The forecast rain never comes, and the clock's minute never turns.
7. **The marks.** The payphone glass carries 41 scratches, one per earlier cycle. The restoration wave cannot touch
   them, because they were made after that day. After KEEP IT RUNNING the crow scratches the 42nd.
8. **Each new cycle** plays the world back from ruin. A few traces survive, and none of them is explained.

### 1.3 What the player can piece together, and when

| When | Clue the player has | What they may guess |
|---|---|---|
| Era I | The world ticks one frame per crank turn. Figures loop with dropped frames. "I'm not on the count either." 41 marks on the glass. The crow says "Zero-zero-four-one." | They are a recording. Something counts, and they are not counted. |
| Era II | The lights come on with nobody home. The phone keeps asking for the operator. A dog digs toward something below. | Someone is expected. Something is under the ground. |
| Era III | Rain that never lands. Puddles reflecting clouds that are not in this sky. "It's Tuesday." An umbrella under a dry sky. | They come from a specific, wetter day. |
| Era IV | Everyone moves in unison against their will. "One observer. It isn't me." | The one observer is the player. |
| Era V | Everything walks backwards. Shadows are gone. The girl is too close. The crow says a line from the future: "Thank you for holding." | Something is about to be undone. This is not the first time. |
| Finale | `world state, prior` / `Observer count: 1.` / `Operator identity: you.` | It all locks: they were the prior day, you were the only observer, and the call was for you. |

### 1.4 Open on purpose

These questions stay open forever:
- who built the machine;
- who ran cycles 0001-0041 (the marks count them);
- who is downstairs ("Hello? I'm calling from downstairs.");
- what happens if the machine stops;
- whether the girl is the inspector's daughter. In the postgame he waves up at her window. The text never says.

### 1.5 House rules that follow from the secret (canon guards)

1. **No denizen faces the machine.** The default facing is profile or away. They turn only toward the camera.
2. **Denizens are never observers.** Lines reinforce this (INS-01, INS-10, GRL-09).
3. **The machine never says "you" before the reveal.** Denizens may, within the budget (§2.5). They never call the
   viewer the operator or the crank-turner. They say "somebody", "whoever", or ask "Is this the operator?".
4. **The plaque leads and denizens follow.** No denizen uses more letters of the word than the plaque shows at that
   moment. No denizen ever says the word.
5. **Moves happen unseen.** A denizen relocates only while the TECH INDEX is open or while it is off-screen.
6. **The machine stays the focus.** Denizens stand on the wings, clear of:
   - every part;
   - the crank hit circle (72 world px radius) plus 24 px;
   - the crank prompt;
   - the gain-text spawn.
7. **Nothing un-happens before the finale** (§2.4). Motion may run backwards; state never does.

---

## 2. Tone rules

### 2.1 Two voices

| | Machine (install lines, logs, reveal) | Denizens (bubbles) |
|---|---|---|
| Person | third person, passive, never "I" | first person, spoken, contractions |
| Questions | never | allowed (`?`) |
| "You" | never before the reveal; first time at `Operator identity: you.` | allowed within the budget (§2.5) |
| Template | `<Event>. <Field>: <value>.` | each denizen has its own register (§2.2) |
| Delivery | toasts; typed reveal at 30 cps | bubble over the speaker, whole line, 150 ms fade, no typewriter |
| Sees denizens? | only in the two optional logs (§5.4), and refuses to count them | never sees the machine |

### 2.2 Denizen registers

| Denizen | Register | Shape | Never |
|---|---|---|---|
| Inspector | Deadpan site paperwork, first person. A human who keeps forms, not a parody of the log template. | `<Finding>. <Personal aside>.` | the machine's `Field: value.` cadence twice in a row; slang |
| Dog | Only its owner's recorded voice: praise and commands, worn tape, stutters (`Good— good boy.`). | repetition with a break | the dog's own thoughts |
| Crow | Mimic. Repeats fragments ×2-3: machine lines, other denizens, numbers. One fragment is from the future. | `<Fragment>. <Fragment>.` | explanations, feelings |
| Girl | A plain, kind child who knows things she should not. Never menacing. | short question or statement | threats, screams, the R-word |
| Payphone | Phone-company recordings, politely empty: "Please hold." | `<Recording phrase>. <Twist>.` | "record", "running" (§2.4) |
| Sensor 7 | Wordless. Its head follows the camera; the readout shows `–` or `1`. | — | text of any kind |

### 2.3 Era ladder: tone and gift-with-receipt

Each era the world gets a gift and pays for it. The receipt is the "wrong" side of the gift.

| Era | Tone mix | Gift | Receipt | The tape |
|---|---|---|---|---|
| I · Mechanical | mysterious 60 / funny 40 | The crank moves the world: one frame per turn. | Nothing moves unless you turn it. After the motor it moves by itself, badly. | hand-cranked mutoscope |
| II · Electrical | comic-eerie | Light: lamp, booth, windows, a dial tone. | Lights with nobody home. No one to call. | electric projector, mains flicker |
| III · Pressure | wistful, uneasy, still funny | Water, warmth, a sprout, the smell of rain. | The rain never lands. The water is "not ours". The sprout is white. | warm picture, weather |
| IV · Resonance | creepy | Harmony: everything in tune, things lift. | Nobody chose it. They move in unison. The count says one. | sound sync |
| V · ??? | ominous, sparse | A sky with something in it. Light from every side. | The sun goes out, the shadows go, they flicker into someone else, the girl is too close. | reverse playback |
| Finale | no words | Everything. | — | playback complete |
| Postgame | tender, near-silent | The day, whole. | It is held, not lived. The rain never comes. | seamless loop |
| Cycle 2+ | déjà vu | The traces. | All of it again. | rewound |

**They get quieter as the world gets stranger.**
- Era I is wry.
- Era IV is a short horror film.
- Era V has at most 4 solo lines.
- The finale has no words.
- The postgame has one line.

### 2.4 Banned before the finale (text and visuals)

**Text** (lint, Appendix B). No pre-finale denizen line may match:
```
/restor|prior|rewind|undo|\bheal|repair|as it was|back the way|record|hold.{0,24}run|while it runs|running|keep it|
 \becho|memory|\bcycle\b|wishlist|\bsteam\b|full game|trailer|tutorial/i
```
- No line may match `/restor/i` at any phase, postgame included (denizens never say the R-word).
- No `!`, no `...` (use `…`), US spelling.
- `hold.{0,24}run` stops the "please hold" arc from spelling out `holds while … runs`.
- The `record*` ban keeps the dev-only tape conceit from being stated.

**Visuals.** Nothing may un-happen before the finale. Motion may run in reverse (backwards walking, reversed blips,
a stuttering crow), but these are banned:
- a hole refilling;
- ink lifting off a page;
- puddles un-rippling or drying back;
- droplets returning upward;
- any part, prop or person turning intact or clean.

Also banned before the finale:
- blue sky or green ground;
- green or blue pixels in denizen or prop art. The exceptions are the crow's blue-black gloss and Sensor 7's green
  LED, which appear only in whole (finale/postgame) frames.
- flying birds: the crow never travels before the finale;
- the intact skyline, or warm-yellow windows. Lit windows stay rust-amber (`#ad6236` / `#c98552`).
- any text in the art, except Sensor 7's stenciled `7` and its two readout glyphs.

### 2.5 The "you" budget

- **Rule.** Before the reveal, at most **one** viewer-addressed line containing you / your / you're / you've per era.
  It is tagged `you` in data and enforced by the scheduler (§7.2).
- **Ownership.** A core `you` line owns its era's slot. A non-core `you` line may use only an unowned slot. That leaves
  era II, shared by GRL-02 and GRL-04, first come first served.
- **Slot owners:**

  | Era | Owner |
  |---|---|
  | I | GRL-01 `Your light is on.` |
  | II | GRL-04 or GRL-02 |
  | III | PAY-07 `You've been holding a long time.` |
  | IV | GRL-10 `You keep looking away.` |
  | V | CRW-08 `Thank you for holding.` |

- **After the reveal**, "you" is free: postgame and cycle 2+ lines.
- **Recordings count.** The payphone's recordings are reworded to avoid "your" (`This call is important to us.`), so
  they do not use up the budget.

### 2.6 Style

- **Length:** 52 characters or fewer per line (hard cap 70; the bank's longest is 49). At UI 150 a bubble is 300 px
  wide, so a line wraps to at most 3 lines.
- **Form:** sentence case. A line ends in `.`, `?` or `…`. Allowed marks: ASCII apostrophe, `—`, `…`, `×`.
- **Tokens** (all enumerable, tested for cycles 1-99; §5.3):
  - `{cycle}`: 4-digit label.
  - `{cycleWords}`: the label read digit by digit.
  - `{savedWords}`: cycle − 1, as a word up to nine, then digits.
  - No runtime string building beyond these tokens.

### 2.7 Creepy without gore, and no meta

- No jump scares, screams or loud stings. Faces stay a soft tape smudge (the girl's always does).
- Unease comes from timing, repetition, stillness and knowing.
- No gaming-aware jokes: no tutorial, trailer, contract, free sample, Steam or wishlist. No line sells anything; the
  END OF DEMO card does that.

---

## 3. Cast

### 3.0 Staging and tape grammar

**Wings.**
- **Left wing:** the Inspector's route and Sensor 7.
- **Right wing:** a street corner (dog on its chain, street clock, payphone booth, street lamp with the crow).
- **The girl:** starts in the skyline and approaches from the left.

**Placement rule.** Each denizen's position is measured from the edge of `boundsToWorld(visibleMachineBounds)` and
clamped into the stage's default view rect, with at least 24 px of margin. If there is no room, the denizen is
off-stage for that stage and its lines wait.

**Proposed feet x per framing** (world px, GROUND_Y; the Engineering Manager verifies them against every stage):

| framing | Sensor 7 | Inspector route | dog (front row) | clock | booth | lamp + crow | girl | puddles / sprout |
|---|---|---|---|---|---|---|---|---|
| Era I (s0-s7) | 1340 | 1400-1490 | 2364 | 2420 | 2470 | 2540 | skyline window (sf 0.3) | — |
| Era II (s8-s9) | 1340 | 1400-1490 | 2852 | 2910 | 2960 | 3030 | pylon plane (sf 0.55), at a pylon foot | — |
| Era III-IV (s10-s14) | 712 | 770-840 | 2860 | 2920 | 2975 | 3060 | III: pylon plane, nearer pylon; IV: ground, back row ≈ 620 | 940-1000 / 1010 |
| Era V, finale, postgame | 712 | 770-840 (rest 784) | 2868 (inner right gap) | 2990 | 3040 | 3112 | front row, inner left gap 1036 → ≥ 980 | 940-1000 / 1010 |
| Cycle 2+ | as era I | | | | | | starts one plane nearer per finished cycle (§9.3) | — |

**Tape grammar** (code only, no extra art):

| device | rule |
|---|---|
| Snap-turn | Profile to camera in 1 frame, no in-between. Hold 300 ms before the bubble and 600 ms after it. |
| Tracking line | A 1-frame horizontal row-offset glitch on the sprite: when a bubble starts, on an era change, and on rapid cranking. Off under reduced motion. |
| Loop seam | Eras I-II: each idle loop drops one frame per cycle. The seam closes in era III. Postgame loops have no seam. |
| Fidelity | Sepia sprite with a full-color twin crossfaded on top. The twin's alpha is the fidelity. |
| Reverse | Era V: locomotion loops play backwards and blips play reversed. State never reverses. |
| Weeping angel | The girl never moves on screen. |
| Double exposure | Era V: every 30-60 s (hash schedule) a denizen shows its whole self for one frame (≈120 ms, 15 % alpha), tinted fully violet, so no green or blue shows. Off under reduced motion. |

**Playback ladder per era:**

| Phase | Playback | Color | Base alpha | Shadow |
|---|---|---|---|---|
| I, before `wornMotor` | 1 frame per crank turn (the crank winds the world) | 0 % (sepia) | .7 | ghosted (.5) |
| I, after `wornMotor` / `pistonArray` | 2 fps / 4 fps | 0 % | .8 | ghosted |
| II | steady 8 fps, slow mains flicker ±.08 alpha (off under reduced motion) | 15 % | 1 | normal |
| III | 8 fps, smooth | 35 % | 1 | normal |
| IV | 8 fps idle loops; accent poses (tick, wag, mouth open) snap to the music downbeat | 50 % | 1 | normal |
| V | 8 fps, locomotion reversed | 70 % | 1 | gone from `horizonField` ≥ 5 |
| Finale / postgame | 12 fps forward, seamless | 100 % | 1 | back with the wave |

**Sensor 7 is the exception:** its head is live, not on the tape. It tracks the camera in every phase.

### 3.1 The Inspector (person) `inspector`

- **What:** a tall figure in a long work coat and hard hat, with a clipboard. A closed umbrella hangs on his arm from
  era III on. The face is a soft smudge that sharpens each era. He is canon's `Inspector not logged.`
- **Why near:** he is doing rounds of this site on the day itself. His route circles the machine's footprint. He
  inspects ground, sky, lamp and camera, never the machine ("Not on my list").
- **Silhouette:** narrow coat with a flared hem, dome hat, square clipboard at the chest. 16×32 art px.
- **Voice:** forms and findings, deadpan. He runs the plaque crossword: Rusting → doesn't fit → guessing me → target
  blank.
- **Secret:** he is the dog's owner. The dog's recorded voice uses his blip pitch. It pays off in the postgame pat:
  `Good boy.` from a real hand.

| Phase | Look | Behavior |
|---|---|---|
| I | sepia, alpha .7, face smudged | Walks 3 steps, writes, walks back; the walk back is the walk forward reversed. Before `wornMotor` he moves only on crank turns. Ticks his sheet on every part landing and tier-up. |
| II | opaque, flicker, faded orange tie | Stops at the lit lamp and writes. 1-frame tracking hitch every ≈20 s. |
| III | hi-vis orange returns (35 %), two eye pixels | Opens the umbrella at steam vents and holds out a palm under a dry sky. |
| IV | 50 % | Writes on the downbeat; mouth opens on beats without text. Every ≈40 s a page lifts off the clipboard and rises with the dust. After ONE OBSERVER he stops writing and faces the camera. |
| V | 70 %, no shadow from `horizonField` ≥ 5 | Stands facing the camera. When he does walk, it is backwards. His blips run reversed. |
| Finale | whole at 32.8 s | Shields his face with the clipboard at the 13 s beam. Turns whole when the wave reaches him: pressed coat. Closes the clipboard and looks around the street. Last look at 59.83 s. |
| Postgame | crisp | 90 s loop: crosses the street, **pats the dog** (`Good boy.`, in-world, once per session), checks his watch at the same second every loop, waves up at the girl's window, writes, leaves. The umbrella stays closed: the forecast rain never comes. |
| Cycle 2+ | sepia ghost again; clipboard one step thicker per finished cycle (max 3) | INS-14 replaces INS-01. |

### 3.2 The Dog (animal) `dog`

- **What:** a thin rust-colored mutt with one torn ear, a blank collar tag and a red collar (from era III). It is
  chained to a stake, and the chain ends in a cut link. **It speaks only in its owner's recorded voice.**
- **Why near:** it was told to stay. The chain leads to nothing.
- **Silhouette:** a low wedge with one upright ear, one torn ear and a curled tail. **24×16 art px** (raised from 18×12
  so it reads at the zoom 0.5 framing).
- **Secret:** the voice belongs to the Inspector. Payoff: the postgame pat. Demo payoff: the hold image.

| Phase | Look | Behavior |
|---|---|---|
| I | sepia, alpha .8 | Sit / sniff / look loop with a dropped frame. Ear flicks at crank sparks (reacts to sound only). |
| II | flicker | After `Load detected 4 km beneath the surface.` it listens to the ground and starts digging. The **hole** is a 4-stage prop (§10). |
| III | red collar (35 %) | Shakes off water that is not there. Sits by the puddles. |
| IV | 50 % | Perfectly still; the tail wags exactly on the downbeat. |
| V | 70 % | Sometimes walks **backwards** to its stake (DOG-11). The hole stays as dug; nothing refills. |
| Finale | whole at 31.2 s | Flattens at the beam. Turns whole: healthy coat; the chain falls off. Wags once in the baseR survey hold. Last look at 59.83 s. |
| Postgame | whole | Sleeps, wakes when the Inspector passes, gets patted, chases a **red ball**. Never looks at the camera. |
| Demo post-cap | — | After DOG-12 it **lies down facing the camera for the rest of the session** (and in every later session of that save). This is the hold image. |
| Cycle 2+ | sepia, chained again | **Keeps the red ball**: the only saturated red in a sepia world, and the only object that crosses the white. |

### 3.3 The Crow (animal) `crow`

- **What:** a large ragged crow, **paused mid-flap in the air** above the street lamp. It mimics: machine lines, other
  denizens, numbers.
- **Why near:** it was flying over the site at the instant of the intake and is stuck in that instant.
- **Rule:** it never travels before the finale. It stays frozen, stutters in place or hovers in place, ragged and
  desaturated. Its first real flight leads the first flock at 38 s.
- **Silhouette:** wedge body, two spread wing fans, hooked beak. **20×14 art px.**
- **Secret:** it has heard the postgame before. CRW-08 `Thank you for holding.` arrives before the payphone ever says
  it in this cycle.

| Phase | Look | Behavior |
|---|---|---|
| I | 1 frozen frame, no shadow below | Only the head snaps to the camera. On crank turns a wingtip jitters 1 px, as if trying to move. |
| II | flicker | Stutters between two positions 4 px apart, like a skipping tape. |
| III | damp, dripping (no gloss) | Found perched on the lamp (it moved there unseen). Drips. |
| IV | 50 % | Hovers 2 px above the perch, wings still. Rises 1 px on each downbeat and resets. |
| V | 70 % | Stutters in place above the lamp. Reversed caw. |
| Finale | whole at 33.2 s | Glossy blue-black. Takes off at 37.0 s and climbs into the flock band. At 38.0 s it **leads the first flock**: one sprite handed to the `fx.bird` pool, drawn with its whole frames. Glides back to the lamp 47.5-49.3 s. Last look at 59.83 s. |
| Postgame | an ordinary crow | KEEP +3 s: hops to the booth roof, **scratches mark 42** (3 pecks), hops back. Real caw sound only, no bubble: the mimic is gone. Perches between flocks. |
| Cycle 2+ | frozen again | Frozen in its **last postgame flight pose**: higher, wings up. |

### 3.4 The Girl with the Lantern (person) `girl`

- **What:** a small child in a yellow raincoat (rain was forecast) carrying a lantern. Her face is always a soft
  smudge.
- **Why near:** she answers the open question "who lights the windows?". Her window is the one lit point in the ruined
  city.
  - She is not coming toward the machine. **She is coming toward the camera**, the one light in the seam
    (`Your light is on.`).
  - She faces the camera by default.
- **Silhouette:** a small triangle with a pointed hood and a glowing dot. Three scales only:
  - window overlay (2×4 art px);
  - pylon-plane mini (5×10);
  - full size on the ground (12×24).
- **Approach rules:**
  - She moves only while the TECH INDEX is open or she is off-screen. She never moves on screen.
  - Her closest position stays off the screen centre, clear of the crank prompt, the gain text and every part.
  - In era V she steps nearer at most **5 times**, once at each of nullChamber, lensArray, horizonField ≥ 5,
    skyAperture and finalAlignment. Each step is ≤ 12 world px.
  - She is hard-clamped to the inner-left-gap clearance (`visibleMachineBounds` + 24 px).
  - A milestone that lands outside the TECH INDEX applies its step at the next unseen moment.

| Phase | Where | Look and behavior |
|---|---|---|
| I | her skyline window: a **separate flickering overlay** that reads against canon's dim `#6e3a22` windows | Warm-rust point, irregular 1.5-4 s flicker; it advances on crank turns before `wornMotor`. GRL-01's bubble anchors to the window. |
| II | at `generator` her window goes dark; she stands at a pylon foot (sf 0.55 mini) | The lantern turns cold white. At `powerLines` six other windows light rust-amber by themselves. |
| III | pylon plane, nearer pylon (same mini) | Yellow (35 %). Hood up at steam vents, palm out. |
| IV | ground, back row, outer left (≈ 620); off-stage if the framing cuts it | Full size, 50 %. Sways and hums on the downbeat. GRL-10. |
| V | front row, inner left gap, 1036 → ≥ 980 | 70 %, lantern lit violet, the closest figure in the game. Never at screen centre. |
| Finale | whole at 31.1 s | **The first time we see her back.** She drops the lantern and runs off left (31.5-34.0 s) while the skyline fades in (29.3-37.3 s). The lantern lies in the grass in the baseL survey hold. At 59.83 s she is at her restored window, facing the camera. |
| Postgame | her restored window, lit warm (the window must coincide with a lit window on `skyline-restored.png`) | A tiny figure at the curtain, looking down at the street, not at you. Waves back when the Inspector waves. |
| Cycle 2+ | starts one plane nearer per finished cycle: cycle 2 at the pylon plane, cycle 3+ on the ground back row | Lantern back in her hand. Never nearer than her era V position. |

### 3.5 The Payphone (object) `payphone`

- **What:** a roadside payphone booth with a hood light. The cracked glass pane carries **41 tally scratches** (drawn
  procedurally: 1 art px strokes, groups of five, 3 rows). The receiver hangs off its armored cord.
  - The voice in it is a recording: a caller asking for the operator, and an automated line saying "Please hold."
  - A street clock on a post stands beside it.
- **Why near:** it stands on the old road by the pylon line. When the grid wakes, the call that was in progress that
  Tuesday resumes.
- **Silhouette:** tall box, peaked hood, dangling receiver. **24×48 art px** with a 16×24 glass pane. The bubble
  anchors to the receiver, which swings toward the camera.
- **Secret:** "operator" is a telephone word. The call was always for you. The marks count the cycles.

| Phase | Look and behavior |
|---|---|
| I | Dead and dark. The receiver sways one step per crank turn. Silent. The 41 marks are faint. |
| II | Dial tone at `generator`. First ring of the game (CROSSED LINES). Hood light on at `powerLines`. Rings (2 short bursts) on power events, at most once per 5 min. |
| III | Moved to the far end of the corner (unseen): PAY-06. The glass fogs at steam vents and **the marks stand out sharply in the fog**. Muffled, slower ring. |
| IV | Rings in tune with the spire. The cord holds a standing wave. |
| V | Rings with a reversed envelope. The receiver swings up against gravity and holds level, pointed at the camera. |
| Finale | Whole at 32.6 s: glass whole, but **the marks stay**, the only thing the wave leaves alone. The receiver hangs itself up with one click. At 59.83 s the hood light blinks once ("connected"). |
| Postgame | Clean, on the hook. Rings once only (PAY-12). After KEEP the crow adds mark 42. |
| Cycle 2+ | Cracked again; marks = 40 + cycle. The dead phone rings once with no power and plays PAY-13 / PAY-14. |

### 3.6 Sensor 7 (object, wordless) `sensor7`

- **What:** a survey station on a tripod. Boxy head, one round lens, a red LED, a stenciled `7`, and a small side
  readout that shows one glyph: `–` or `1`.
- **Lore:** it is a survey station from that day, set up to watch the site. The machine misfiled it as its own
  `Sensor 7 reports nothing. Reading accepted.`
  - It points at the camera, the one thing it can detect through the seam. That is why it reports nothing about the
    machine.
  - It is the only denizen that tracks you: the head picks one of 3 frames (left, centre, right) from the camera's
    centre x as you pan.
- **Silhouette:** tall A-frame tripod, box head, single eye. **16×36 art px**. Readout glyphs are **5×7 art px**, and
  only two are needed (`–`, `1`).
- **It never speaks.** The tracking head and the readout are the whole joke.

| Phase | Look and wordless beats |
|---|---|
| I | LED red, slow irregular blink. Readout `–`. At the `sensor-null` log ("Sensor 7 reports nothing.") the LED double-blinks and the head snaps to centre (on the camera). |
| II | LED amber (powered). Small red glint in the lens. |
| III | Lens fogs at steam vents (overlay). |
| IV | LED pulses on the downbeat. At the `observer-one` log the readout flips `–` → **`1`** and stays `1` (it opens ONE OBSERVER). |
| V | Lens reflects violet. Readout steady `1` (no countdown). |
| Finale | Whole at 33.4 s: the head swivels up to the sky and the LED turns green. At 59.83 s the head swivels from the sky to the camera (last look). |
| Postgame | A normal weather station pointed at the sky. The anemometer is still (no wind). **Once, after ≥ 20 min of postgame, the head turns to the camera for 3 s with readout `1`, then back to the sky.** It is the second and last postgame camera beat. |
| Cycle 2+ | Head back on the camera, LED red, and **the readout shows `1` from the first minute**. |

From the first AS BUILT part of a cycle (WP23), Sensor 7's LED blinks on the shared `TIER_HEARTBEAT` clock (2.4 s), so
the world keeps time with the machine.

---

## 4. Environment arc per era

The canon layers stay as they are:
- pylons relit (II);
- chimney smoke and steam (III);
- rising dust (IV);
- violet sky, eclipse, horizon glow and beam (V);
- the finale restoration.

Everything below is added on top. All of it is small and local, and all of it is partly wrong. The finale wipe stays
the only large change.

### 4.1 Per era

| Era | Sky / background | Ground and props | Light | Weather | Life | Audio |
|---|---|---|---|---|---|---|
| **I · Mechanical** "hand-cranked" | Canon beige sky and ruined skyline. **One window overlay: the girl's warm-rust flicker.** | Dead street lamp, dead booth with 41 faint marks, stopped clock (about 4:41; a dev easter egg, not readable), the dog's stake and cut chain, Sensor 7's tripod, 3 paper scraps. Every crank turn advances every loop one frame until `wornMotor`. | flat; nothing lit | sideways dust (canon) | dog (thin), crow frozen in the air | wind (canon) |
| **II · Electrical** "powered" | Pylons relit (canon). At `generator` the girl's window goes dark (she has left). At `powerLines` **six other windows light rust-amber by themselves**, never warm yellow. | Booth hood light. The dog's hole begins (§10). | **The lamp buzzes on at `powerLines`** with a slow mains flicker (off under reduced motion). | dry | **4-5 ash motes circle the lamp like moths** (ash or moths? left open) | 50 Hz hum (canon); dial tone; phone ring |
| **III · Pressure** "weather from elsewhere" | **Virga**: a parallax strip over the mountains with rain streaks that evaporate before they land. It appears at lifetime PR ≥ 1M (the `steam-rain` condition). | **Puddles** appear on dry ground at `condenser` and grow with its tiers. They reflect **pale grey cloud that is not in this sky** (never blue). A **white, etiolated sprout** appears at the puddle edge. The fogged booth glass shows the marks sharply. Scraps burn away with firebox tiers. | The lamp turns warm. Ember rim light on the side facing the machine. | Steam vents make denizens act as if it rains: umbrella, hood, palm out. | The crow is found perched and dripping. | optional faint rain bed (−30 dB) from `condenser`: rain that is not falling |
| **IV · Resonance** "in sync" | Rising dust (canon). The six windows breathe on the downbeat (static under reduced motion). Virga hangs frozen. | **Chladni nodal rings** in the ground dust around the machine base (procedural; §10). Puddles ring concentrically on each downbeat. Inspector pages drift up with the dust. | The lamp pulses on the downbeat. | still air; things fall up | **Ash motes freeze mid-orbit** (a mirror of the era I crow). The crow hovers in place. | canon bells; denizens open their mouths on the downbeat without text |
| **V · ???** "reverse" | Violet, eclipse, glow, beam (canon). **The six windows go dark stage by stage** (nullChamber 6 → 4, lensArray → 2, horizonField ≥ 5 → 1, skyAperture → 0). Virga fades out. | Puddles turn **black and reflect nothing**. The sprout grows tall, still white, and **bends toward the beam** (from skyAperture). Chladni lines glow faint violet. The dog's hole stays dug. | **The lamp goes out on the skyAperture diamond ring.** From horizonField ≥ 5 every shadow is gone (light from every side). | — | Motes drift down into the dead lamp. The crow stutters in place. Double exposures. | denizen blips reversed |
| **Finale** (silent) | Canon restoration. The girl's window joins the restored skyline. | The wave turns each prop whole as it arrives (§9.1): the sprout greens and blooms, the puddles reflect the restored sky, the chain falls, the receiver hangs itself up, the clock's second hand starts to sweep. **The marks stay.** | lamp relit warm (restored frame) | wind stops (canon) | the crow leads the first flock | canon |
| **Postgame** "same day" | Restored (canon). The girl at her curtain. | The lantern lies in the grass in the inner left gap: a relic. The clock's second hand sweeps; the minute hand never turns. The umbrella stays closed. | warm, constant | no wind (Sensor 7's anemometer is still) | white moths at the lamp, now real; canon flocks and seeds; dog and red ball | canon `restored`; real crow caws |
| **Cycle 2+** "again" | Ruin returns at the white peak (canon). | Props back to ruin. The traces are listed in §9.3. | flat | dust | crow frozen in a new pose | canon |

**The postgame exact loop covers only denizen and prop loops** (90 s period). Canon flocks (every 40-70 s) and seeds
keep their own schedules. The world as a whole is never claimed to be periodic.

### 4.2 Must not happen before the finale

The §2.4 visual bans apply, plus:
- moths stay ambiguous (ash) until the postgame;
- the sprout stays white;
- puddles never reflect blue;
- the double-exposure frames stay fully violet.

---

## 5. Line bank

### 5.1 Legend

**Trigger kinds:**

| trigger | fires when |
|---|---|
| `log reply` | the named SYS LOG toast has cleared, + 1 s |
| `buy` / `ms` | after the TECH INDEX closes, + 2.5 s (tier-up beats and fly-ins land first). A milestone that lands outside the TECH INDEX waits for its toast to clear. |
| `era entry` | 3 s after the era card closes, with the TECH INDEX closed |
| `idle` | no click or purchase for 45 s (core lines: 20 s) |
| `rapid` | at least 6 clicks/s for 3 s |
| `tier` | a part reaches the named WP23 tier (`feedback.partEvolved`) |
| `offline` | 8 s after the WELCOME BACK toast clears, absence of 1 h or more |
| `demoNear` | lifetime EE ≥ 3M |
| `POST-CAP` | demo only, after the first KEEP TINKERING (§8) |
| `postgame` | ending.phase `postgame` |
| `cycle 2+` | `prestige.cycle` ≥ 2 |

**Flags:**

| flag | meaning |
|---|---|
| `core` | an arc or chain line. Exempt from the era and hour caps; still obeys gaps and hard silence. Pending until its era ends; log-reply cores expire after 150 s. |
| `you` | uses the era's "you" slot |
| `demo` | demo edition only |
| `once` | once per save (`seenEver`) |
| `cyc` | cycle 2+ variant; replaces the named base line |
| `post` | postgame |

Unflagged lines are once per cycle and non-core.

**Tones:** myst (mysterious), funny, creepy, tender, omen (ominous).

### 5.2 Table

| id | denizen | era / phase | trigger | tone | text | flags |
|---|---|---|---|---|---|---|
| INS-01 | Inspector | I | log reply `observer-count` (120 s); usually the first line of the game | myst, funny | Unchanged. I'm not on the count either. | core |
| INS-02 | Inspector | I | log reply `chamber-seal` (ME 100K) | funny | Signed it myself. Still not logged. | — |
| INS-03 | Inspector | I-II | log reply `idle-cycle` (2400 s) | myst | No beginning. I checked page one. It's page two. | — |
| INS-04 | Inspector | I end | ms `generatorBlueprint` (plaque R?S????) | funny | R, blank, S. Seven letters. Rusting. Fits. | core |
| INS-05 | Inspector | II | chain CROSSED LINES, step 3 | funny | Operator. Not on my list. | core |
| INS-06 | Inspector | II | idle, `powerLines` owned | funny | Item four: the lamp. On. Item five: why. | — |
| INS-07 | Inspector | II end | ms `substationBlueprint` (full); POST-CAP step 2 (demo) | myst | Rusting doesn't fit anymore. | core |
| INS-08 | Inspector | III | idle 20 s after the first steam vent of era III (umbrella opens) | funny | Forecast said rain. I brought an umbrella. | — |
| INS-09 | Inspector | III end | ms `pressureVesselBlueprint` (plaque REST?RE) | creepy | I've stopped guessing the word. It's guessing me. | core |
| INS-10 | Inspector | IV | chain ONE OBSERVER, step 2 | creepy | One observer. I checked. It isn't me. | core |
| INS-11 | Inspector | IV end | ms `harmonicConvergence` (plaque RESTORE (TARGET: ?)) | myst | Target: blank. I know the feeling. | core |
| INS-12 | Inspector | V | `horizonField` >= 5 (all shadows vanish) | omen, funny | My shadow's gone. I've filed a report. | — |
| INS-13 | Inspector | I-IV | tier: first part this cycle to reach its top tier (AS BUILT) | funny, myst | Something just passed an inspection I didn't do. | — |
| INS-14 | Inspector | cycle 2+, I | idle; replaces INS-01 from cycle 2 | funny, creepy | Same rounds. Page one. You look familiar. | cyc once |
| INS-PG | Inspector | postgame | in-world, to the dog, inside the 90 s loop, once per session; no camera turn | tender | Good boy. | post |
| DOG-01 | Dog | I | idle, `wornMotor` owned | funny | Good boy. Good— good boy. Stay. | — |
| DOG-02 | Dog | I, III | idle repeater, once in each listed era | funny, creepy | Who's a good— who's a good— who's a good boy. | — |
| DOG-03 | Dog | I-III | rapid (>= 6 clicks/s for 3 s), once per cycle | funny | Easy. Easy. Somebody's in a hurry. | — |
| DOG-04 | Dog | I-II | tier: `improvedPistons` MK III (tie-rod braces, louder) | funny | Loud. Too loud. Good— good boy. | — |
| DOG-05 | Dog | II | idle, `powerLines` owned | funny | Don't chew the cable. Don't chew— good boy. | — |
| DOG-06 | Dog | II | log reply `load-beneath` (EE 100K); digging starts | creepy, funny | Leave it. Leave it. Leave it. | core |
| DOG-07 | Dog | I-V | offline >= 1 h, 8 s after WELCOME BACK clears; once per cycle | tender, creepy | He waited the whole time. Good boy. | — |
| DOG-08 | Dog | III | idle 20 s after a steam vent | funny, creepy | Don't shake on the carpet. What carpet. | — |
| DOG-09 | Dog | IV | chain SYNCHRONIZATION, step 1 (same frame as CRW-06) | creepy | Good boy. Good boy. | core |
| DOG-10 | Dog | IV | idle | creepy | Sit. Stay. Stay. Stay. | — |
| DOG-11 | Dog | V | idle, after a backwards walk to the stake | omen | Heel. Heel. Good— heel. | — |
| DOG-12 | Dog | demo post-cap | POST-CAP step 4; then the hold image | tender | Stay. Wait for it. Good boy. | core demo once |
| DOG-13 | Dog | cycle 2+, I-II | idle; replaces DOG-01 from cycle 2 | tender, creepy | Good boy. You kept the ball. Good boy. | cyc once |
| CRW-01 | Crow | I | log reply `unlabeled-part` (ME 500) | funny | Ignored. Ignored. Ignored. | — |
| CRW-02 | Crow | I | idle, after the `observer-count` log | myst | Zero-zero-four-one. Zero-zero-four-one. | — |
| CRW-03 | Crow | I | buy `pistonArray` (install line "Observers: none.") | funny, myst | None. None. None. | — |
| CRW-04 | Crow | II | chain CROSSED LINES, step 2 | myst | Operator. Operator. | core |
| CRW-05 | Crow | III | idle; {cycleWords} = cycle label read digit by digit | myst | {cycleWords}. {cycleWords}. | — |
| CRW-06 | Crow | IV | chain SYNCHRONIZATION, step 1 (same frame as DOG-09) | creepy | Good boy. Good boy. | core |
| CRW-07 | Crow | IV | buy `echoCrank` (install line "The fork answers…") | creepy | Answers. Answers. Answers. | — |
| CRW-08 | Crow | V | ms `finalAlignment` (after "Awaiting operator."); a postgame line it should not know yet | creepy | Thank you for holding. Thank you for holding. | core you |
| CRW-09 | Crow | cycle 2+, III | idle; replaces CRW-05 from cycle 2 | creepy | {cycleWords}. Again. | cyc |
| GRL-01 | Girl | I | idle, play >= 6 min; bubble anchored to her window | myst, creepy | Is someone there? Your light is on. | core you |
| GRL-02 | Girl | II | local hour 00-04, after GRL-01, >= 5 min into the session; shares era II's you-slot | creepy, tender | It's late where you are. Go to bed. | you once |
| GRL-03 | Girl | II | idle, `powerLines` owned (six windows lit) | myst | The lights came on. Nobody came home. | — |
| GRL-04 | Girl | II | idle; shares era II's you-slot with GRL-02 | funny, creepy | Somebody's turning it. Is it somebody you know? | you |
| GRL-05 | Girl | II | demoNear: lifetime EE >= 3M (both editions) | myst | It gets bigger. Then it gets strange. | core |
| GRL-06 | Girl | demo post-cap | POST-CAP step 3 ("I saw it too" = the teaser) | myst | The rest of it is further up. I saw it too. | core demo once |
| GRL-07 | Girl | III | log reply `steam-rain` (PR 1M) | myst, funny | It's not an error. It's Tuesday. | core |
| GRL-08 | Girl | III | idle | creepy | Smell that? Don't tell it. | — |
| GRL-09 | Girl | IV | chain ONE OBSERVER, step 3 | creepy | It isn't counting us. | core |
| GRL-10 | Girl | IV | idle 20 s, after her unseen move to the ground plane | creepy | I'm not walking. You keep looking away. | core you |
| GRL-11 | Girl | V | idle, `skyAperture` owned | omen | Don't look up. It looks back. | — |
| GRL-12 | Girl | cycle 2+, I | idle; replaces GRL-01 from cycle 2 | creepy, tender | Cycle {cycle}. You came back. So did we. | cyc once |
| PAY-01 | Payphone | II | chain CROSSED LINES, step 1: buy `generator`, first ring of the game | myst | Hello? Operator? Is this the operator? | core |
| PAY-02 | Payphone | II | buy `powerLines` (hood light on) | funny | Please hold. This call is important to us. | core |
| PAY-03 | Payphone | II | idle, `powerLines` owned | funny, creepy | All operators are busy. Or gone. | — |
| PAY-04 | Payphone | II | idle, after the `copper-memory` log (EE 1M) | myst | Connecting… connecting… please continue to hold. | — |
| PAY-05 | Payphone | demo post-cap | POST-CAP step 1 | funny, creepy | We're sorry. This call cannot be completed. | core demo once |
| PAY-06 | Payphone | III | era III entry, after its unseen move | funny | Someone moved me. I was mid-call. | core |
| PAY-07 | Payphone | III | idle 20 s, era III >= 15 min old | funny, creepy | You've been holding a long time. Please hold. | core you |
| PAY-08 | Payphone | IV | log reply `signal-below` (RS 1M) | creepy | Hello? I'm calling from downstairs. | core |
| PAY-09 | Payphone | IV | chain SYNCHRONIZATION, step 2 (rings in tune) | creepy | All lines are now in phase. Please hold. | core |
| PAY-10 | Payphone | IV | idle, after chain ONE OBSERVER | omen | This call may be monitored. It always was. | — |
| PAY-11 | Payphone | V | log reply `operator-located` (xf 100M) | omen | Operator located. Please hold for connection. | core |
| PAY-12 | Payphone | postgame | >= 10 min into postgame, idle 20 s; its only ring; once per cycle | tender | Thank you for holding. | core post |
| PAY-13 | Payphone | cycle 2 opener | 60 s after the first purchase of cycle 2; the dead phone rings once | creepy | You have one saved message. It is from you. | core cyc once |
| PAY-14 | Payphone | cycle 3+ opener | same trigger, once per cycle; {savedWords} = cycle - 1 | creepy | You have {savedWords} saved messages. All from you. | core cyc |

Counts:
- 63 lines: Inspector 15 (one of them in-world), Dog 13, Crow 9, Girl 12, Payphone 14.
- Demo-only: 3 (PAY-05, GRL-06, DOG-12).
- Postgame: PAY-12, plus the in-world INS-PG.
- Cycle 2+: 6 (INS-14, DOG-13, CRW-09, GRL-12, PAY-13, PAY-14).

### 5.3 Tokens (enumerated; textSweep checks every output for cycles 1-99)

| token | value | cycle 1 | cycle 2 | longest output |
|---|---|---|---|---|
| `{cycle}` | `cycleLabel` digits (41 + cycle, 4 digits) | 0042 | 0043 | GRL-12, 40 chars |
| `{cycleWords}` | label digits as words, hyphenated, first word capitalized | Zero-zero-four-two | Zero-zero-four-three | CRW-05, ≤ 45 chars |
| `{savedWords}` | cycle − 1 as a word up to nine, then digits | — | (PAY-13 says "one") | PAY-14, ≤ 46 chars |

### 5.4 Optional machine logs (machine voice; at most 2; recommended)

The machine sees the denizens once each era III-IV and refuses to count them. These two entries go into `SYSTEM_LOGS`
in table order. They follow the same rules as every other log:
- the 120 s gap;
- once per cycle;
- marked shown, never fired, if already met at load;
- replayed each cycle.

| id | text | trigger |
|---|---|---|
| `perimeter-umbrella` | Umbrella detected. Precipitation: none. | lifetime PR ≥ 100K, slot before `steam-rain` |
| `perimeter-phase` | Perimeter moving in phase. Not counted. | lifetime RS ≥ 5M, slot after `signal-below` |

**Evidence:**
- **Method.** `scratchpad/bible/logsim.ts` drives `runGreedy` in 5 s / 30 s chunks and replays the log scheduler (table
  order, 120 s gap).
- **Delay.** The eight key logs (`copper-memory`, `steam-rain`, `sync-success`, `signal-below`, `observer-one`, `units-unknown`,
  `cycle-0041`, `operator-located`) fire with **0 s delay**, with or without the two new entries, in all three profiles. Early
  logs share the 120 s start gap with or without the two new entries, so the other existing logs may wait a gap behind them.
- **Order.** The key logs still land before their milestones:

  | profile | observer-one → convergence | operator-located → finalAlignment |
  |---|---|---|
  | A | 160.2 → 166.5 min | 232.3 → 236.8 min |
  | B | 175.5 → 182.0 min | 247.0 → 251.5 min |
  | C | 331.5 → 340.0 min | 405.0 → 411.0 min |

- **Demo.** Both entries are unreachable in the demo (eras III-IV). `copper-memory` (EE 1M) still fires at
  46.4 / 59.0 / 116.0 min, before the cap at 60.4 / 73.0 / 148.5 min.

### 5.5 Wordless beats (no text; not counted as moments)

| beat | trigger | what happens |
|---|---|---|
| First tick | first crank click | The frozen world advances one frame. The crank winds the world. |
| Failed sync | `wornMotor` lands (install line `Synchronization unsuccessful.`), TECH INDEX closed | Every visible denizen tries to turn to the camera together and fails: one by one, 250 ms apart, out of order, the crow's head the wrong way. Then the world starts moving by itself at 2 fps. Sensor 7 is already looking and does not join in. |
| Sensor 7 reply | `sensor-null` log | LED double-blink, head on the camera. |
| Glances | hash schedule (§7.6) | One denizen snap-turns to the camera for 1.5 s, then back. |
| The stare | from the ONE OBSERVER chain through era V | Every denizen at rest faces the camera; it turns to profile only while moving. Glances stop. |
| Girl's steps | the 5 era V milestones, unseen | She is nearer. |
| Sensor 7 postgame turn | ≥ 20 min into the postgame, once per cycle | §3.6. |

---

## 6. Chained moments

A chain is **one moment** for cadence. A step starts once the previous bubble has been visible for 1.2 s. At most 2
bubbles are visible at once, and a unison pair starts on the same frame. If a member is off-screen, its step is
skipped and its line stays unseen.

### 6.1 Chains

1. **CROSSED LINES** (era II entry, `buy generator`; core).
   - The booth gets a dial tone and rings for the first time in the game (2 bursts, receiver jerk).
   - PAY-01 `Hello? Operator? Is this the operator?` → CRW-04 `Operator. Operator.` → the Inspector turns to the
     camera: INS-05 `Operator. Not on my list.`
   - This opens the canon chain from `Operator identity not found.` to `Operator identity: you.`.
2. **SYNCHRONIZATION** (setup in era I, payoff in era IV; core).
   - *Setup:* the wordless Failed sync (§5.5) at `wornMotor`.
   - *Payoff:* at the `sync-success` log (RS 1K; `Synchronization successful.`, about 1-2 min into era IV). This is the
     de facto era IV opener, so there is no separate era IV entry line.
     - On the next music downbeat every on-screen denizen snaps to the camera on the same frame, Sensor 7 included,
       and holds 2 beats.
     - DOG-09 and CRW-06 say `Good boy. Good boy.` in unison: two bubbles on the same frame.
     - Then the booth rings in tune: PAY-09 `All lines are now in phase. Please hold.`
     - All snap back on the same beat.
3. **ONE OBSERVER** (era IV, `observer-one` log, RS 20M; core).
   - Sensor 7's readout flips `–` → `1` (wordless).
   - INS-10 `One observer. I checked. It isn't me.` → GRL-09 `It isn't counting us.`
   - The stare begins.
4. **POST-CAP** (demo only; §8).
   - The tape runs out once.
   - PAY-05 → INS-07 → GRL-06 → DOG-12, at least 2 min apart. These are four moments, but they read as one arc.
   - It ends on the hold image.
5. **LAST LOOK** (finale, wordless; §9.1).
   - Every denizen snaps to the camera on the frame `Operator identity: you.` starts typing (59.83 s).
   - The booth light blinks "connected".
6. **LAST FRAME** (new cycle, wordless).
   - During the 800 ms white-in of BEGIN A NEW CYCLE, every denizen snaps to the camera, with no judgment.
   - At the peak they reset to era I with their traces.

### 6.2 Arcs (series of lines and beats across eras)

| arc | steps | payoff |
|---|---|---|
| **Rusting** (the Inspector's crossword) | INS-04 at R?S???? `Rusting. Fits.` → INS-07 at RES?OR? `Rusting doesn't fit anymore.` (the demo's last word puzzle) → INS-09 at REST?RE `It's guessing me.` → INS-11 at RESTORE (TARGET: ?) `Target: blank.` | Lands twice: the word was RESTORE, and the machine stays rust forever while the world heals. |
| **Please hold** (the payphone) | PAY-02 (II) → PAY-04 (II) → PAY-07 `holding a long time` (III) → PAY-09 `in phase` (IV) → PAY-11 `Operator located. Please hold for connection.` (V) → CRW-08 the crow's future `Thank you for holding.` | Reveal: `Operator identity: you.` (hood light blinks), then `Restoration holds while the machine runs.` → KEEP → PAY-12 `Thank you for holding.` |
| **Good boy** (the dog) | The owner's voice in the Inspector's pitch, all game (DOG-01…11) | Postgame: the Inspector's loop pats the dog, `Good boy.`, in-world, the only line not aimed at the camera. The player is no longer part of the conversation. |
| **The marks** | 41 scratches from era I → fogged sharp in III → untouched by the wave | KEEP +3 s: the crow scratches 42. Cycle 2+: 40 + cycle. PAY-13 `It is from you.` |
| **The approach** (the girl) | window (I) → pylon foot (II) → nearer pylon (III) → ground (IV) → inner gap, 5 steps (V); `Your light is on.` → `You keep looking away.` | She turns her back and runs home as the city comes back. Postgame: at her curtain, looking at the street, not at you. |
| **Downstairs** | DOG-06 digging at `Load detected 4 km beneath…` → PAY-08 `Hello? I'm calling from downstairs.` at `Frequency matches a signal from below…` | Open on purpose. In the postgame the hole is grassed over. |

---

## 7. Cadence and persistence

### 7.1 `WORLD_VOICE_CONFIG` (data in `src/data/livingWorld.ts`)

| key | value | note |
|---|---|---|
| `firstMomentAfterMs` | 90 000 of play, **and** ≥ 1 click, ≥ 1 purchase, and no onboarding prompt visible | INS-01 at the 120 s log is the natural first line |
| `sessionWarmupMs` | 60 000 after load and after WELCOME BACK clears | DOG-07 is the exception: 8 s after WELCOME BACK clears |
| `minGapMs` | 120 000 between any two moments | same as `SYSTEM_LOG_CONFIG.minGapMs` |
| `logReplyGapMs` | 45 000 | A log reply may follow the previous moment after 45 s. Logs are 120 s apart themselves. |
| `nonCoreGapMs` | 360 000 between two non-core moments in the same era | spreads optional lines across the era |
| `perDenizenGapMs` | 300 000 | nobody dominates; chains exempt |
| `toastQuietMs` | 30 000: idle lines wait 30 s after any SYS LOG, milestone toast or era card | reactive lines only wait for the toast to clear, + 1 s |
| `afterIndexCloseMs` | 2 500 | WP23 tier beats and fly-ins land first |
| `idleInputMs` | 45 000 (core: 20 000) | |
| `hourCap` | 8 non-core moments per rolling hour (RARE: 0 non-core; cycle ≥ 2: 4) | session-local |
| `reactiveTtlMs` | non-core reactive 90 000; non-core log reply 40 000; core log reply 150 000; other core lines pending until their era ends | an expired line stays unseen |
| `bubble` | appear 150 ms opacity fade (instant under reduced motion); duration 2 600 + 55 ms per char, clamped 3 500-6 500 | 52 chars ≈ 5.5 s |
| `turn` | snap 1 frame; hold 300 ms before, 600 ms after | |
| `sysLogDeferMs` | the SYS LOG poll defers while a bubble is visible (≤ 6 500) | one narrative text surface at a time; logs still win the next slot |

### 7.2 Era caps and core reservation

| era | core moments | non-core cap | total ceiling | era length A / B / C (min) |
|---|---|---|---|---|
| I | 3 (INS-01, GRL-01, INS-04) | 3 | 6 | 29 / 38.5 / 75 |
| II | 5 (CROSSED LINES, PAY-02, DOG-06, GRL-05, INS-07 full) | 2 | 7 | 38 / 41.5 / 89.5 |
| III | 4 (PAY-06, GRL-07, PAY-07, INS-09) | 2 | 6 | 53.5 / 54.5 / 115.5 |
| IV | 5 (SYNCHRONIZATION, PAY-08, ONE OBSERVER, GRL-10, INS-11) | 1 | 6 | 50.4 / 52 / 66 |
| V | 2 (PAY-11, CRW-08) | 2 | 4 | 78.4 / 77.5 / 82.5 |
| demo post-cap | 4 (PAY-05, INS-07, GRL-06, DOG-12) | 0 | 4 | — |
| postgame | 1 (PAY-12) + 1 wordless (Sensor 7) + in-world INS-PG | 0 | 1 text | — |

Era lengths come from the `runGreedy` profiles (`logsim.ts`).

**Cap rules:**
- Era caps and the hour cap count non-core moments only. Core lines never wait for a cap; they always have their
  slot.
- A core line whose trigger can no longer fire drops out. Example: its log was marked shown at load.
- The "you" slot (§2.5) is tracked per era, per cycle.
- Expected delivery in a full cycle 1: 6 / 7 / 6 / 6 / 4 = **29 moments plus PAY-12**. That is one every 9-14 min,
  against 20 SYS LOGs (22 with §5.4).

### 7.3 Priority and interruption

**Queue priority:** chain > core reactive (era entry, keystone, milestone, core log reply, cycle opener) > non-core
reactive (log reply, buy, ms, offline, rapid) > tier > idle. One pending slot per priority. A higher-priority line
never cuts a bubble on screen; it waits for the bubble to end and for its own gates.

**What interrupts a bubble:** only a hard-silence event (§7.4).
- The bubble fades in 150 ms (instant under reduced motion).
- It counts as seen if at least 60 % of its duration was shown.
- Otherwise a core line returns to pending and a non-core line is dropped (unseen; it may fire again if its trigger
  recurs).

**What does not interrupt:**
- Toasts (they have their own surface; a bubble simply does not start while an unlock or milestone toast is up).
- SYS LOGs (they defer; §7.1).
- Clicks and pans. If a pan takes the anchor off-screen, the bubble fades and the 60 % rule applies.

### 7.4 Hard silence (no bubble starts; a visible one is cut)

- Before `firstMomentAfterMs`.
- While an onboarding prompt (crank prompt or schematic prompt) is visible.
- The finale `sequence` and `choice` phases (`isFinaleLocked`), and the cycle transition.
- While any of these is up:
  - era card;
  - **TECH INDEX open**;
  - SYSTEM menu, title, credits, cycle confirm;
  - demo teaser (World asleep);
  - END OF DEMO card.
- Photo mode, or the tab hidden.
- The speaker off-screen, or its bubble unplaceable (§7.5).

Wordless beats also respect hard silence, with one exception: LAST LOOK plays inside the film (§9.1).

### 7.5 Presentation

**The bubble element.** One pooled DOM node (up to 2 for unison) in `#ui-root`, `#world-voice`, z under toasts.
- Opaque `#1d1f21` with a `#a8957a` border, light text at 4.5:1 or better.
- Font at least 14 px at UI 100, scaling with UI 100-150 %. Max width 300 px at UI 150.
- `pointer-events: none`, not focusable.
- One polite live region with a visually hidden speaker prefix: `Inspector:`, `Dog:`, `Crow:`, `Girl:`,
  `Payphone:`. No visible name label.
- Never carries class `is-open`. Hidden in photo mode and during the finale.

**Placement ladder** (UI 150 safe):
1. Above the head.
2. If that overlaps a HUD, toast, button or hint rect: below the feet, in the foreground ground band, with the tail
   pointing up.
3. To the side.
4. Otherwise wait up to 10 s, then treat the line as blocked.

GRL-01 anchors to the window via `parallaxPosition`. In the postgame at UI 150 the bottom-right buttons cover about
21 px of the right wing's feet; PAY-12's bubble sits above the booth hood.

**All tracking-line, glitch and reverse effects stay in the canvas,** never in CSS.

### 7.6 Glances (wordless; the cheapest cure for a static screen)

- A random on-screen denizen snap-turns to the camera for 1.5 s, with a tracking line.
- **Schedule:** deterministic hash like `flockSchedule`, seeded by (cycle, era, k):

  | phase | interval |
  |---|---|
  | era I | 6-9 min |
  | II | 5-8 min |
  | III | 4-7 min |
  | IV | 3-5 min, until ONE OBSERVER |
  | ONE OBSERVER through era V | the stare (permanent) |
  | postgame | none (the seam is closed) |

- Glances are not moments. They respect hard silence and never land within 10 s of a bubble.

### 7.7 Reduced motion (`motionPolicy`)

- Snap-turns are already 1 frame; holds unchanged.
- The bubble appears and disappears instantly.
- Off:
  - tracking lines;
  - mains flicker;
  - double exposures;
  - window breathing;
  - rising pages;
  - mote orbits (static motes instead).
- The crow's stutter becomes one static pose.
- Kept:
  - hand-cranked frame stepping (discrete, input-driven);
  - beat-snapped accent poses;
  - ambient idle loops, the same as the machine's own ambient animation.
- Tier-up world ripples become one static frame change (§10).
- Finale:
  - every denizen swaps to whole at 24.3 s (the end of the ground crossfade);
  - the girl does not run: she is simply gone at 24.3 s, and the lantern lies in the grass;
  - the crow is cut away at 38.0 and back at 49.3;
  - LAST LOOK is instant.

### 7.8 Persistence and repeat policy

An optional block is added to the save v2 envelope. The normalize is lenient and there is no version bump; a compat
fixture covers it.
```
world?: { seen: string[]; seenEver: string[]; eraMoments: [n, n, n, n, n]; youEras: number }
```

| field | scope | cleared by |
|---|---|---|
| `seen` | ids delivered this cycle | `beginNewCycle`, NEW GAME, RESET PROGRESS |
| `seenEver` | ids ever delivered | NEW GAME, RESET PROGRESS |
| `eraMoments` | non-core moments per era this cycle (keeps caps across reloads) | `beginNewCycle`, NEW GAME, RESET PROGRESS |
| `youEras` | bitmask of eras whose "you" slot is used this cycle | `beginNewCycle`, NEW GAME, RESET PROGRESS |

- The normalize drops unknown ids and duplicates, caps each array at 128, and clamps numbers.
- The block round-trips through export/import.
- A demo save imported into the full game keeps it.
- `clampStateToEra` does not touch it.

**Session-only state** (not saved): the rolling hour cap, per-denizen gaps, INS-PG, glance and double-exposure indices
(derived from time and seed).

**Repeat policy:**
- **Within a cycle:** every line plays at most once. Exceptions: DOG-02, once in each listed era; INS-PG, once per
  session. Because `seen` is saved, reloading never repeats a line.
- **Once per save:** `once` lines (cycle variants, GRL-02, demo post-cap lines).
- **Once per cycle:** PAY-12, PAY-14, DOG-07.
- **Cycle ≥ 2:**
  - core lines replay once per cycle; the loop is part of the story;
  - non-core lines play only if never heard (not in `seenEver`), so later cycles surface lines the player missed
    instead of repeating them;
  - `cyc` variants replace their base line;
  - the hour cap drops to 4.
- **Seen state drives the hold image:** after DOG-12 is in `seenEver`, every later demo session starts with the dog
  lying facing the camera.

### 7.9 Settings

`WORLD VOICES: ON / RARE / OFF` (settings, lenient normalize, default ON).
- **RARE:** core lines only.
- **OFF:** no bubbles and no blips. Figures, turns, glances and the environment stay.

### 7.10 Determinism and debug

- Glance and double-exposure schedules are hashed, so smokes are reproducible.
- GRL-02 reads the local hour live. It is never stored or sent, and it is silenced by `world.quiet`.
- **Debug hooks:** `world.state()`, `world.say(id)`, `world.quiet(on)`, `world.clock(hour | null)`.
- **Probes:** `livingWorld()` → `{ id, variant, x, visible, speaking }[]`, and the renderer cost `livingWorld.meanMs`.

---

## 8. Demo cut (eras I-II stand alone)

### 8.1 What a demo player meets (new player, cap at about 98 min)

1. **0:00.** The world is frozen. The first crank turn ticks everything one frame. No text.
2. **About 1 min, `wornMotor`.** Failed sync; the world starts moving by itself.
3. **2 min.** INS-01, the first fourth-wall line. As conditions arrive, up to 3 of these optional lines play:
   - CRW-01, CRW-03, DOG-01, CRW-02, DOG-03, INS-02, INS-03, DOG-02.
   - Also Sensor 7's wordless reply, glances every 6-9 min, and GRL-01 from the window (≥ 6 min).
4. **About 22-29 min.** INS-04 `Rusting. Fits.`
5. **Era II.**
   - CROSSED LINES at `generator`. The girl appears at a pylon foot.
   - PAY-02 at `powerLines`, with the lamp, the booth light and six windows.
   - DOG-06 starts digging at EE 100K.
   - Up to 2 of GRL-03 / GRL-04 / GRL-02 / DOG-05 / PAY-03 / PAY-04 / INS-06 / INS-13 / DOG-04.
   - GRL-05 `It gets bigger. Then it gets strange.` at EE 3M.
6. **Cap.** `substationBlueprint` milestone, then the teaser (World asleep, bubbles hidden), then the END OF DEMO card.

### 8.2 After the cap (POST-CAP)

1. **KEEP TINKERING.** The world wakes, and **the tape runs out once**: every loop freezes for 1.2 s with a tracking
   line, then plays on. This happens once, not on a repeat. Under reduced motion there is no tracking line.
2. +20 s: PAY-05 `We're sorry. This call cannot be completed.`
3. +≥ 2 min: INS-07 `Rusting doesn't fit anymore.`
4. +≥ 2 min: GRL-06 `The rest of it is further up. I saw it too.`
5. +≥ 2 min: DOG-12 `Stay. Wait for it. Good boy.` Then the dog lies down facing the camera for the rest of the
   session, and in every later session of that save. That is the hold image.

After that: no more lines. Glances continue. Silence is the hook.

### 8.3 Five open questions the demo plants (no sales voice)

1. What do the 41 marks count?
2. Who is the operator the phone keeps asking for?
3. What is under the ground?
4. Why is the girl coming closer?
5. What word is the Inspector's crossword?

### 8.4 Teaser cameo (optional, recommended)

- **Shot:** in the last 2 s of the teaser, as the aperture opens, the girl stands in the inner left gap (her era V
  pose, fully violet-tinted silhouette, no face detail) and turns to the camera. No text.
- **Why it is safe:** `ShowcaseScene` only checks `partsVisible`. The teaser never shows the restored sky.
- **Uses:** it hints at her approach, which the demo never completes, and doubles as capsule art. Use the girl only;
  the dog owns the hold image.

### 8.5 Spoiler safety

- Every demo-reachable line passes `/RESTOR/i` and the pre-finale ban list.
- No demo line uses letters beyond the RES?OR? plaque. INS-04 names only R and S; INS-07 names none.
- `B_no_spoiler` and the store-shot `/RESTOR/i` scan already read DOM bubbles.
- Era III-V lines ship in the demo bundle but are gated by era.

### 8.6 Demo bank

Demo-reachable lines:
- Era I: 12 (INS-01..04, DOG-01..04, CRW-01..03, GRL-01).
- Era II: 14 (INS-05, INS-06, INS-13, DOG-05, DOG-06, CRW-04, GRL-02..05, PAY-01..04).
- Post-cap: 4 (PAY-05, INS-07, GRL-06, DOG-12; three of them demo-only).
- DOG-07 (offline).

Expected delivery is about 12 moments in the run (era I 6, era II 4 core + 2) plus the 4 post-cap moments.

---

## 9. Finale, postgame and cycle 2+ payoff

### 9.1 Film choreography (no denizen text in the film)

Restoration time per denizen = wave + pioneer lag:
`t = FINALE_WIPE.startS + regrowthLagS[0] + |x − 1920| / pxPerS = 23.3 + |x − 1920| / 120`.
This puts figures turning whole with the ground under them.

| film t (s) | denizens |
|---|---|
| 0 | Bubbles hidden. Frozen in their era V stare poses; idle loops paused. |
| 13.0 (white beam) | Shield poses: the Inspector's clipboard over his face, the dog flat, the girl's lantern raised, the crow's head tucked. The booth light and Sensor 7's LED die. |
| 19.3 (windStop) | Shields lower to a still pose. Dust reverses (canon). |
| 30.9 / 31.1 / 31.2 | Sprout (x 1010) greens and blooms / **girl** (980 after her 5 steps; 30.7 s if she is still at 1036) / **dog** (2868) turn whole. Crossfade 400 ms. |
| 31.5-34.0 | The girl drops the lantern and runs off left, her back to us, while the skyline fades in (29.3-37.3). |
| 32.2 / 32.6 / 32.8 / 33.2 / 33.4 | Clock (2990), second hand starts / **booth** (3040), marks untouched, receiver hangs itself up / **Inspector** (784) / **lamp and crow** (3112) / **Sensor 7** (712), head to the sky, LED green. |
| 37.0 → 38.0 | The crow takes off and leads the first flock (handed to `fx.bird`). |
| 41.0-42.0 baseL hold | Sensor 7 at the sky, the Inspector closing the clipboard, the lantern in the grass, the green sprout, the puddle with the restored sky. |
| 45.0-46.0 baseR hold | Dog without its chain (one wag), clock sweeping, booth with the marks readable at zoom 1, empty lamp. |
| 47.5-49.3 | The crow glides back to the lamp. |
| 49.3 reveal | Everything holds still. |
| 57.23 | `Observer count: 1.` starts typing. Nobody moves. |
| **59.83** | **LAST LOOK.** `Operator identity: you.` starts typing. Every denizen on screen snaps to the camera on that frame. The girl appears at her restored window, facing the camera. The booth hood light blinks once. Sensor 7 swivels from the sky to the camera. |
| 62.6 choice | Hold facing the camera while `Restoration holds while the machine runs.` types. |
| KEEP +1.5 s | All turn away together (the seam closes); Sensor 7 back to the sky. |
| KEEP +3.0 s | The crow scratches **mark 42**. Postgame loops start. |
| BEGIN A NEW CYCLE | LAST FRAME (§6.1); reset at the white peak. |
| SKIP | Jump to the end state: restored, facing the camera. |

**Derivation of 59.83 s** (from data, not hard-coded):
`FINALE_REVEAL.startS + nameplateFadeMs/1000 + holdS + Σ(i<3) (lines[i].length / cps + linePauseS)`
= 49.3 + 0.8 + 1.0 + (25/30 + 2) + (39/30 + 2) + (18/30 + 2) = 59.83 s. The same formula gives the choice at 62.6 s.
Under reduced motion the lines appear whole at the same start times.

### 9.2 Postgame (KEEP IT RUNNING): the same day, held

- **The 90 s loop** (denizen and prop loops only; flocks and seeds stay on canon schedules):
  - the Inspector crosses, pats the dog (`Good boy.`, in-world), checks his watch at the same second, waves up at the
    girl's window, writes, leaves;
  - the dog sleeps, wakes and chases the red ball;
  - the girl stands at her curtain.
  - The clock's second hand sweeps and the minute never turns. The umbrella stays closed.
- **Camera beats** (both of them, ever, per cycle):
  1. PAY-12 `Thank you for holding.` after at least 10 min, with the postgame's only ring. The phone line is the one
     connection left, so it can still speak to you.
  2. Sensor 7's wordless 3 s turn after at least 20 min.
- **Everything else is silence.** Nobody else looks at the camera; the seam is closed. The crow's caws are real sound,
  with no bubble.
- **Mark 42** stays on the glass.

### 9.3 New cycle and cycle 2+ traces (all derived from `prestige.cycle`; nothing extra stored)

| trace | rule |
|---|---|
| Marks on the booth glass | 40 + cycle before this cycle's finale; 41 + cycle from the postgame on. Choosing NEW CYCLE from the choice shows the new count at the white peak. |
| Red ball | the dog has it from cycle 2 |
| Crow pose | frozen higher, wings up (its last postgame flight pose) |
| The girl | starts one plane nearer per finished cycle (cycle 2: pylon plane; 3+: ground back row); never nearer than her era V spot |
| Sensor 7 | readout `1` from the first minute |
| Clipboard | one step thicker per finished cycle (max 3) |
| Sprout (optional) | appears one era early (era II), still white |
| Payphone opener | 60 s after the first purchase the dead phone rings once with no power: PAY-13 (cycle 2) / PAY-14 (cycle 3+) |
| Lines | `cyc` variants replace their base lines; repeat policy in §7.8 |

### 9.4 What the lines mean after the reveal

| Before the finale | After `world state, prior` / `Observer count: 1.` / `Operator identity: you.` / `holds while the machine runs` |
|---|---|
| INS-01 `not on the count`, INS-10, GRL-09 `It isn't counting us.` | They were the recording. You were the only one watching. |
| PAY-01 `Is this the operator?`, PAY-11 `Please hold for connection.` | The call was for you. It connected at "you." (the hood light blink). |
| PAY-02 / 04 / 07 / 09 "Please hold" | The world holds while you keep it running. PAY-12 thanks you. |
| CRW-08 `Thank you for holding.` in era V | The crow had heard it in earlier postgames: one per mark. |
| PAY-10 `This call may be monitored. It always was.` | One observer, always. |
| INS-04 → INS-11 crossword | RESTORE; and the machine stays rust while the world heals. |
| INS-08 `Forecast said rain.`, GRL-07 `It's Tuesday.`, the raincoat, virga, grey-cloud puddles | The prior state is one Tuesday, held before the rain. The postgame umbrella never opens. |
| CRW-02 `Zero-zero-four-one`, CRW-05 `…four-two`, the 41 marks | `Log 0041`, `Cycle 0042 nearly complete.`, mark 42 at KEEP, `CYCLE 0043`. |
| Sensor 7 tracking you; readout `1` | It watched the one observer. Afterwards it looks at the sky, except once. |
| GRL-01 `Your light is on.`, GRL-10 `You keep looking away.`, her approach | She came toward the seam, the one light. When it closed, she ran home. |
| The dog's voice in the Inspector's pitch | `Good boy.` from a real hand. The tape had an owner. |
| DOG-06 digging, PAY-08 `calling from downstairs` | The rest of the day was under the dust (open). |
| PAY-13 `It is from you.` | You ran the cycle before. The marks say 41 ran before you (open). |

---

## 10. Interaction with part tier-ups (WP23)

The hook is the `feedback.partEvolved` signal and the 900 ms beat (`PART_TIER_FX`, PART_TIERS §3). Beats are held
while the TECH INDEX is open and play on close.

**Rules:**
- No denizen ever looks at the evolving part. They notice the world, not the machine.
- **World ripple:** one per tier-up, fired at the beat's settle (600 ms). Per TECH INDEX release only one ripple
  plays, for the strongest step crossed. Outside the tree there is at most 1 per 4 s.
- **Notices:**
  - On every beat the Inspector ticks his sheet (2 frames) if he is on screen and not speaking. He logs improvements
    he cannot see.
  - Sensor 7 double-blinks.
  - A torque tick (between tiers) gives the dog an ear flick, at most 1 per 10 s.
- **No ripples on silent paths:** finale completion, teaser `applyLevels`, load `sync()`, reset or new cycle.
- **Lines on tier-ups:** INS-13 for the first AS BUILT part of a cycle, and DOG-04 for improvedPistons MK III.
  Everything else is wordless.

**World ripple by era** (reduced motion: one static frame change only):

| era | ripple | reduced motion |
|---|---|---|
| I | two pebbles hop 1 px; the booth receiver jumps one step; the frozen crow's wingtip jitters. The first ripple of the game comes with gearRatio MK II at about 4 min and teaches the link. | the receiver's held step |
| II | the lamp and booth light flicker one step brighter; the dog's fur bristles (1 frame) | lamp one step brighter for 400 ms |
| III | a warm gust: coat hem, ears, hood and feathers ruffle for 1 frame; puddle glint | a single ruffle frame |
| IV | one shared hum beat: every denizen sways once on the next downbeat; one puddle ring | the sway pose held for one beat |
| V | while shadows exist, every shadow flicks toward the machine for 0.5 s. From horizonField ≥ 5 (no shadows) the nearest denizen shows one violet double-exposure frame instead. | none (static) |

**Tier-to-prop mappings** (the world keeps visible marks of the upgrades):

| track and tier | world change |
|---|---|
| condenser MK I / MK III / MK V | puddles 1 / 2 / 3 (size) |
| firebox MK III / MK IV / MK V | paper scraps 3 → 2 → 1 → 0 ("Fuel source not on the manifest. Burning anyway.") |
| motorRetrofit MK III / MK IV / MK V (once `load-beneath` has fired) | the dog's hole, stages 2 / 3 / 4 (stage 1 when digging starts). The hole never refills. |
| standingWave MK I / MK III | Chladni rings, intensity 1 / 2 (AD4 F7, Q6 scale-up; was MK III / MK V) |
| copperWinding or transformer, any tier-up | lamp flicker (the era II ripple), even after era II |
| first AS BUILT part of the cycle | Sensor 7's LED joins `TIER_HEARTBEAT` (2.4 s); INS-13 |

**Story reading** (developer-only): the parts climb toward AS BUILT while the world plays back toward whole. Both
ladders run toward something older. Neither says so.

---

## 11. Art needs summary

All sprites are side view plus one camera-facing frame.
- **Masters.** Art is made as color masters only. The sepia twin is derived offline. Glitch, reverse, tint and double
  exposure are code.
- **Palette.** Rust Wasteland, with no green or blue in pre-finale frames (§2.4).
- **Sizes.** The dog and crow were raised for the zoom 0.5 framing. Anything under about 24 px is hand-pixelled with
  `pixelart_workbench`.

| asset | size (art px) | frames | method |
|---|---|---|---|
| Inspector | 16×32 | walk 4, write 2, facing 1, talk 1, shield 1, pat 2, wave 1, watch 1 = **13**; umbrella overlay open/closed 2 | PixelLab concept at 2×, then palette snap and hand fix |
| Dog | 24×16 | sit 2, sniff 2, walk 4, dig 2, shake 2, facing 1, talk 1, flat 1, lie-facing 1 (hold image), sleep 1, chase 2 = **19**; chain, stake, red ball 3×3 | hand-pixel |
| Crow | 20×14 | frozen 1, perch 2, facing 1, talk 1, peck 2, takeoff and flight 3 (whole only) = **10** | hand-pixel |
| Girl | 12×24 + mini 5×10 + window 2×4 | stand-facing 2, sway 2, palm 1, talk 1, shield 1, back-run 4 = **11**; minis 2; window overlay 2 frames; lantern lit / fallen 2; restored-window figure 1 | hand-pixel; Art Director tone check |
| Sensor 7 | 16×36 | tripod 1, head L/C/R 3, head up 1, lens fog 1 = **6**; glyphs `–` and `1` at 5×7 | hand-pixel |
| Payphone booth | 24×48 | dark, lit, ring shake 2, receiver swing 3, receiver level, on hook, restored, fog overlay = **11**; tally marks procedural | PixelLab concept + hand fix |
| Street lamp | 8×56 | dead, lit, dim, restored = **4** | hand-pixel |
| Street clock | 12×12 face on a 4×40 post | ruin, restored = **2**; hands drawn in code | hand-pixel |
| Props | small | hole stages 4 (16×6), puddles 3 sizes, sprout 5 (4 white, 1 green bloom; 8×24), scraps 3, ash mote and moth 2 | hand-pixel |
| Parallax overlays | strips | girl's window flicker, six lit windows (staged off in V), virga hanging and frozen 2 | hand-pixel / derived |
| Procedural | — | Chladni rings (Graphics, 2 intensities), tracking-line row shift (made at load), tally marks, shadows (one shared ellipse) | code |

**Art totals:**
- About **76 character and object frames plus about 30 prop and overlay frames**.
- PixelLab budget about 150 generations (concepts and the booth); the rest is free hand work.
- Every asset gets:
  - a manifest entry;
  - a procedural silhouette fallback;
  - an `ASSET_GUIDE` row.

**Audio:**
- One blip voice per speaker on the existing synth (chirp precedent):

  | speaker | blip |
  |---|---|
  | Inspector | low square "hm" |
  | Dog | the Inspector's pitch with a tape-wobble LFO (the tell) |
  | Crow | FM rasp |
  | Girl | high soft sine |
  | Payphone | band-limited "recording" blip, plus a two-tone ring (440 + 480 Hz) |

- Sensor 7 has no voice; an optional faint LED tick.
- Era V envelopes are reversed. Concurrency is 2 or fewer, on the sfx bus. Mute and SFX volume are honored.
- Optional: the era III rain bed. The postgame crow caws are real sound.
- Voice count stays far below the cap of 48.

**Runtime budgets:**

| budget | value |
|---|---|
| Display objects | about 40: 6 base + 6 color twins + 6 shadows + about 15 props + a pool of 5 motes, in 2 row containers. Current peak is 76 of 500. Objects are hidden, never destroyed, on a new cycle. |
| Renderer cost | `livingWorld.meanMs` ≤ 0.3 ms |
| App bundle | about +15 KB of data and code: 402.8 / 404.8 → about 420 of 460 KB |
| CSS | bubble plus the WORLD VOICES row ≤ 1.0 KB (1000 B; relaxed from 0.9 KB for the HUD font stack, WP23a, see DENIZEN_ART 4.1) against about 1.2 KB of demo headroom. **Recommendation: the Director raises `cssKb` 44 → 45 at WP start as insurance (precedent 40 → 44).** |

**Code map** (for the Engineering Manager):

| file | content |
|---|---|
| `src/data/livingWorld.ts` | cast, positions, era states, the line bank, chains, `WORLD_VOICE_CONFIG`, a11y prefixes, the settings label |
| `src/game/math/livingWorld.ts` | pure placement, scheduler, glance hash, token expansion, unit-tested |
| `src/game/rendering/LivingWorld.ts` | created in `WorldScene` |
| world-voice DOM view | the bubble |
| save | `world` block normalize and compat fixture |
| settings | WORLD VOICES row |
| system logs | the 2 optional entries |

**Smokes and evidence to refresh:**
- store-shots: `world.quiet` by default, plus one optional era II stem with PAY-02. All stems need Art Director
  re-approval, because denizens are in every shot.
- demo and demo-cases: `B_no_spoiler` reads bubbles; the teaser cameo.
- ux: one-prompt rule, crank hit zone.
- a11y: live region; Tab walk unchanged.
- resolutions: placement ladder at UI 150.
- perf: display objects including twins; `meanMs`.
- soak: DOM and display counts flat.
- **finale frame baselines** (denizens now restore inside the film, and the girl's run is a new beat).
- STEAM_RELEASE §15 evidence.

**Production waves:**

| wave | scope |
|---|---|
| A (demo) | eras I-II states of all six, POST-CAP, hold image, teaser cameo, windows, lamp, booth, clock, motes |
| B | eras III-V states, puddles, sprout, virga, Chladni, double exposure, the 2 optional logs |
| C | whole frames, finale choreography, postgame loop, cycle 2+ traces |

---

## Appendix A. GAME_SPEC §18.2 draft (append-only; merge with the WP23 tier note into one §18.2)

> ### 18.2 Living world (2026-10-24, user directive)
> Append-only; nothing above this line was changed. This note partly supersedes four earlier statements, and only for
> the denizen and environment layer:
> - §1 "silent";
> - §4 "Environment relatively static";
> - §10 "No NPCs/dialogue";
> - the ART_ERA5 convention that no people are depicted in the finale or the restored world.
>
> - Six denizens stand on the wings of the scene, gated by era: two people, two animals, two objects. They are
>   fragments of the prior world. They never face, touch or walk through the machine (§4 still holds), and they never
>   count as observers.
> - Five of them may turn to the camera and say a rare single line ("use sparingly" in §10 still applies; cadence is
>   in `docs/plan/STORY_BIBLE.md`). No line names the machine's function. All reveals stay in the machine's own text.
> - The environment changes a little each era: small, local, partly wrong. The finale's restoration wipe stays the
>   only large change.
> - People appear whole in the finale and the restored world: the girl, the Inspector, and figures in the restored
>   windows. This is new canon and needs Art Director sign-off before production.
> - Humanity stays "seemingly gone". The people shown are a recording, not survivors.

## Appendix B. Lint and tests

- Add the line bank, chain steps, a11y prefixes, settings labels and the 2 optional logs to `textSweep`
  `sweepEntries`.
- The `scratchpad/bible/final/validate.mjs` rules, ported as tests:
  - every line ≤ 52 chars after token expansion for cycles 1-99;
  - final `.`, `?` or `…`; no `!`; no `...`; US spelling; no ` x5`;
  - no `/restor/i` in any line;
  - the pre-finale ban regex (§2.4) on every line not flagged `post` or `cyc`;
  - the `you` flag matches `/\b(you|your|you're|you've|yours)\b/i` for pre-finale lines;
  - at most one core `you` line per era, and non-core `you` lines only in an unowned era;
  - demo-reachable lines contain no plaque letters beyond the cap.
- Scheduler unit tests:
  - gaps, caps, core reservation, the "you" slot and TTLs;
  - the hard-silence list;
  - interruption and the 60 % rule;
  - cycle ≥ 2 replay policy;
  - persistence normalize;
  - glance hash determinism.
- Finale math tests: restoration times from `FINALE_WIPE` and positions; LAST LOOK at 59.83 s from `FINALE_REVEAL`.

## Appendix C. Fix ledger (every judge must-fix → where it is fixed)

**Judge 1:**
1. No typewriter; whole-line 150 ms fade; era V reversal only as reversed blips. → §2.1, §7.1
2. No state undo in era V; one ban for text and visuals. → §2.4, §4.1
3. The draft's postgame INS-13 (`Same rounds. Same day. Thank you for staying.`) contradicted the closed seam. → Cut. The postgame camera beats are only PAY-12 and the wordless Sensor 7 turn;
   "Good boy." is in-world. (§9.2)
4. Sensor 7 wordless; lore is a survey station misfiled as Sensor 7. → §3.6
5. Readout steady `1`, no countdown, no S7-09. → §3.6
6. Crow never flies before the finale; first flight leads the 38 s flock. → §3.3, §9.1
7. Demo: no periodic stall; one tape-runs-out freeze, then the hold image. → §8.2
8. INS-08 rewritten (`Forecast said rain. I brought an umbrella.`); Tuesday kept consistent. → §1.2, §9.4
9. Restoration times use `regrowthLagS` 2 s and were recomputed; the girl runs during the 29.3-37.3 s skyline fade.
   → §9.1
10. Exact loop limited to denizen and prop loops. → §4.1, §9.2
11. The draft's runtime CRW-08 `{echo}` replaced by a fixed line (CRW-07); tokens enumerated. → §5.3
12. At most 2 optional logs, with simulated evidence. → §5.4
13. Pre-finale ban regex (`hold.{0,24}run|while it runs|running`); 1 "you" line per era; the draft's CRW-09 `Looked back. Looked back.` cut,
    GRL-11 kept. → §2.4, §2.5
14. GRL-02: era II only, after GRL-01, quiet hook, hour never stored, girl clear of the centre and prompts, face
    smudge, no on-screen approach. → §3.4, §7.10
15. The girl's window is a separate overlay; lit windows stay rust-amber. → §3.4, §4.1
16. §18.2 supersedes the ART_ERA5 no-people convention and needs Art Director sign-off. → Appendix A

**Judge 2:**
1. Typewriter removed. → §2.1
2. State undo removed. → §2.4
3. `record*` banned; PAY-10 is `This call may be monitored. It always was.` → §2.4, §5.2
4. Crow never travels and stays ragged until the wave. → §3.3
5. The girl's steps are per milestone (max 5), clamped, unseen. → §3.4
6. Log replies wait for the toast to clear + 1 s, with TTLs; 30 s quiet after toasts; SYS LOG defers while a bubble is
   up. → §7.1
7. Font ≥ 14 px with UI scaling; 300 px max width; all lines ≤ 52 chars. → §2.6, §7.5
8. The `wornMotor` beat is wordless; DOG-01 waits for the 90 s gate; nothing competes with onboarding prompts.
   → §5.5, §7.4
9. Era IV runs 8 fps loops with beat-snapped accents. → §3.0
10. One readout meaning; 5×7 glyphs. → §3.6
11. Clock override and quiet hooks; the smoke list includes finale baselines, perf and §15. → §7.10, §11
12. Dog 24×16, crow 20×14; hand-pixel below 24 px. → §3.2, §3.3, §11
13. Loop independent of flocks and seeds. → §4.1
14. CSS decision up front (≤ 1.0 KB (1000 B; relaxed from 0.9 KB for the HUD font stack, WP23a), raise `cssKb` to 45 as insurance). → §11

## Appendix D. Open decisions for the Director

1. **The 2 optional machine logs (§5.4).** Recommendation: include them. Zero measured delay to the eight key logs (§5.4); the two new logs move no existing log (same second and delay).
2. **`cssKb` 44 → 45 at WP start.** Recommendation: yes.
3. **Art Director:** the girl as an approaching, camera-facing child (tone check), and people in the restored world
   (§18.2 sign-off).
4. **GRL-02** (local hour). Keep, gated as in §3.4, or cut.
5. **Optional v1.1 "answer the payphone".** Pointer-only: clicking the ringing booth plays its pending line early,
   and it plays anyway after 3 rings. Its hit zone stays outside the crank radius plus margin. No keyboard path,
   because no content depends on it. Not in v1.
6. **Teaser cameo** (§8.4): v1 or a later pass.
