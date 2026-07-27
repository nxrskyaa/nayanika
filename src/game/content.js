import { ACCENT, BUILD, CHAR, NATURE } from '../core/palette.js'

/**
 * Everyone who lives on the planet, and the deliveries that string them
 * together.
 *
 * `at` is an anchor id registered by the world builder, or [zoneId, x, z] to
 * drop someone at district-local metres. `look` feeds straight into the rig.
 */

export const NPCS = [
  {
    id: 'rui',
    name: 'Rui, Depot Manager',
    at: 'main-square:depot',
    offset: [2.2, 3.4],
    facing: 0.4,
    look: { hairStyle: 'short', hair: 0x3a3230, shirt: 0xd9e3e6, shorts: 0x38424a, shoes: 0x2f3438, bag: null, accessory: 'tie', accessoryColor: ACCENT.amber, longPants: true, scale: 1.06 },
    idle: [
      'Morning. Or afternoon. Hard to tell on a planet this small.',
      'Anything on the list is yours. Nothing on the list is also yours, technically.',
      'Take your time. The planet is only nine minutes wide.',
    ],
  },
  {
    id: 'granny-hoshi',
    name: 'Granny Hoshi',
    at: 'main-square:center',
    offset: [-6.5, 6.5],
    facing: 2.2,
    look: { hairStyle: 'bun', hair: 0xdcd6c8, skin: 0xe8bd9a, shirt: 0xc9b7d6, shorts: 0x574a63, shoes: 0x6d5f54, bag: null, longPants: true, scale: 0.92, build: 1.05 },
    idle: [
      'My knees and I have an understanding. They stay down here.',
      'The temple is up past the red gate. Very far. Very up.',
    ],
  },
  {
    id: 'ino',
    name: 'Ino, Temple Keeper',
    at: 'mountain-temple:hall',
    offset: [0, 7.5],
    facing: 0,
    look: { hairStyle: 'bald', hair: 0x8d8378, skin: 0xe0b28c, shirt: 0xd8cdb6, shorts: 0x8a7a5e, shoes: 0x5c4c3c, bag: null, longPants: true, scale: 1.02 },
    idle: [
      'Listen. That is the sound of nothing needing you.',
      'The wind chimes do most of the talking up here.',
    ],
  },
  {
    id: 'dr-fibi',
    name: 'Doctor Fibi',
    at: 'mountain-temple:base',
    offset: [3.5, -2],
    facing: 3.0,
    look: { hairStyle: 'spiky', hair: 0x6f6a63, shirt: 0xf2f2ee, shorts: 0x4a5158, shoes: 0xd8d4cc, bag: null, accessory: 'tie', accessoryColor: ACCENT.teal, longPants: true },
    idle: [
      'The planet is small enough that I can measure its wobble by hand.',
      'Two doctors, one planet, six letters between our names. It was always going to end badly.',
    ],
  },
  {
    id: 'dr-fibbi',
    name: 'Doctor Fibbi',
    at: 'capital-corp:lobby',
    offset: [2, 3],
    facing: 3.3,
    look: { hairStyle: 'short', hair: 0x2b2a2c, shirt: 0xeef0f0, shorts: 0x3b4046, shoes: 0x24282c, bag: null, accessory: 'tie', accessoryColor: ACCENT.blue, longPants: true, scale: 1.03 },
    idle: [
      'Do you know why I have sixty-three packs of instant noodles? Neither do I.',
      'Everything addressed to me arrives somewhere else. Everything addressed elsewhere arrives here.',
    ],
  },
  {
    id: 'wataru',
    name: 'Wataru',
    at: 'whisper-woods:cave',
    offset: [0, 6.2],
    facing: 0,
    look: { hairStyle: 'long', hair: 0x4a3f37, skin: 0xd8a97e, shirt: 0x8f7f68, shorts: 0x4c4238, shoes: 0x3a332c, bag: null, longPants: true, build: 1.08 },
    idle: [
      'A cave is just a house that stopped asking for rent.',
      "Don't tell anyone I'm out here. Especially not anyone I'm married to.",
    ],
  },
  {
    id: 'mei',
    name: 'Mei, Flower Seller',
    at: 'main-square:flowers',
    offset: [0, 0],
    facing: 1.1,
    look: { hairStyle: 'strawHat', hair: 0x2f2a28, shirt: 0xe9f0ea, shorts: 0xd88a6a, shoes: 0xc9c4b8, bag: null, scale: 0.97 },
    idle: [
      'Tulips take their time. So does everyone, really.',
      'If you see a man living in a hole in the woods, tell him the rent here is fine.',
    ],
  },
  {
    id: 'captain-ola',
    name: 'Captain Ola',
    at: 'seaside:pier',
    offset: [0, 0],
    facing: 3.6,
    look: { hairStyle: 'cap', hair: 0x1f2933, skin: 0xd7a074, shirt: 0x4f7fa8, shorts: 0x2f3a44, shoes: 0xb9b2a4, bag: null, longPants: true, build: 1.12, scale: 1.05 },
    idle: [
      'Diving for oysters. Found lockboxes. Found regrets. Mostly lockboxes.',
      'The sea keeps things. Sometimes it gives them back wet.',
    ],
  },
  {
    id: 'dave',
    name: 'Dave',
    at: 'smelly-falls:pool',
    offset: [3.5, 2.5],
    facing: 2.6,
    look: { hairStyle: 'long', hair: 0x33302e, shirt: 0xb9d0c4, shorts: 0x4b5a52, shoes: 0xe4dfd2, bag: null, accessory: 'backpack', accessoryColor: BUILD.woodDark },
    idle: [
      'Falls are loud. Good for practising badly.',
      'They call it Smelly Falls. I have chosen not to investigate.',
    ],
  },
  {
    id: 'kade',
    name: 'Mr. Kade',
    at: 'red-cliff:house',
    offset: [0, 6],
    facing: 0,
    look: { hairStyle: 'bald', hair: 0x6b625a, shirt: 0xf0efe8, shorts: 0x2e3338, shoes: 0x1f2326, bag: null, accessory: 'tie', accessoryColor: ACCENT.deepRed, longPants: true, build: 1.15, scale: 1.05 },
    idle: [
      'Shipments in. Shipments out. That is the whole philosophy.',
      'I read everything. Eventually. Usually.',
    ],
  },
  {
    id: 'toshi',
    name: 'Toshi',
    at: 'main-square:office',
    offset: [0, 0],
    facing: 3.9,
    look: { hairStyle: 'short', hair: 0x241f1d, shirt: 0xf4f2ea, shorts: 0x424a52, shoes: 0x2a2e32, bag: null, accessory: 'tie', accessoryColor: ACCENT.amber, longPants: true },
    idle: [
      'I am extremely calm. Look at how calm I am.',
      'Have you ever sent something you could not un-send?',
    ],
  },
  {
    id: 'nao',
    name: 'Nao',
    at: 'back-streets:alley',
    offset: [0, 0],
    facing: 1.6,
    look: { hairStyle: 'bob', hair: 0x2b4f63, shirt: 0x2f3438, shorts: 0x1f2326, shoes: 0xe4622f, bag: null, accessory: 'backpack', accessoryColor: ACCENT.purple, scale: 0.98 },
    idle: [
      'The whole planet is triangles. Do not tell the others.',
      'It is painting, except the brush is maths and the maths argues back.',
      'I keep the frame rate up so nobody notices the planet is hollow.',
    ],
  },
  {
    id: 'iri',
    name: 'Iri',
    at: 'lucero-graveyard:center',
    offset: [3, -2],
    facing: 2.4,
    look: { hairStyle: 'long', hair: 0x2a2a2e, shirt: 0x53585c, shorts: 0x35393d, shoes: 0x24282c, bag: null, longPants: true, scale: 1.0 },
    idle: [
      'Everybody on this planet ends up walking past here eventually.',
      'I water the flowers. They are plastic. It is the gesture that counts.',
    ],
  },
  {
    id: 'kenta',
    name: 'Kenta',
    at: 'back-streets:alley',
    offset: [6, -7],
    facing: 0.7,
    look: { hairStyle: 'bob', hair: 0x1c1c1e, shirt: 0xf1ede0, shorts: 0x24262a, shoes: 0x3fa7c9, bag: null, scale: 0.88 },
    idle: [
      "First I need the radius of the tyre. Then the circumference. Then I'll know how far I've cycled all year.",
      'Do not interrupt. There is a decimal point at stake.',
      'I think I can hear my dad calling. It can wait. Maths cannot.',
    ],
  },
  {
    id: 'hana',
    name: 'Hana',
    at: 'seaside:lighthouse',
    offset: [-5, -5],
    facing: 1.9,
    look: { hairStyle: 'bun', hair: 0x4b3b30, shirt: 0xf6dfae, shorts: 0x8fb0c4, shoes: 0xe9f0f2, bag: null, scale: 0.95 },
    idle: [
      'The light goes round and round. So does everything here, I suppose.',
      'Nothing to report. That is the report.',
    ],
  },
  {
    id: 'goro',
    name: 'Goro',
    at: 'capital-corp:tower',
    offset: [-7, 6],
    facing: 3.1,
    look: { hairStyle: 'cap', hair: 0x2a2622, skin: 0xc98f63, shirt: 0xe4622f, shorts: 0x3c4247, shoes: 0x2a2e32, bag: null, accessory: 'apron', accessoryColor: BUILD.metal, longPants: true, build: 1.1 },
    idle: [
      'New guy is late again. Third time this week. There have been two days this week.',
      'We make boxes. Inside the boxes: smaller boxes.',
    ],
  },
  {
    id: 'sora',
    name: 'Sora',
    at: 'mountain-temple:gate',
    offset: [4.5, 3],
    facing: 3.4,
    look: { hairStyle: 'spiky', hair: 0x3d3330, shirt: 0xcfe0d8, shorts: 0x4d5a55, shoes: 0xd8d2c4, bag: null, scale: 0.94 },
    idle: [
      'Every step up here is a step you have to take back down. Think about that.',
      'I come for the view. I stay because the stairs are terrifying.',
    ],
  },
]

/**
 * The delivery chain. Each quest is a hand-off: pick something up from one
 * person, walk it to another. `requires` gates the chain.
 */
export const QUESTS = [
  {
    id: 'offering',
    banner: "TAKE GRANNY HOSHI'S OFFERING TO THE MOUNTAIN TEMPLE",
    summary: 'An offering for the mountain temple',
    from: 'granny-hoshi',
    to: 'ino',
    parcel: { color: ACCENT.amber, label: 'offering' },
    requires: [],
    offer: [
      "Oh good, a messenger. My knees have filed a complaint about the temple stairs.",
      "Would you carry this up to the keeper for me? It's only incense and a little sake.",
      'Straight past the red gate. You cannot miss it, it is the only mountain.',
    ],
    reminder: ['Past the red gate, dear. The one shaped like a gate.'],
    deliver: [
      'From Hoshi? She has been sending these up since before I had this job.',
      'Tell her the wind chimes still work. She will know what that means.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'gravity',
    banner: 'TAKE THE GRAVITY READINGS TO DOCTOR FIBBI AT CAPITAL CORP',
    summary: 'Gravity readings for the other doctor',
    from: 'dr-fibi',
    to: 'dr-fibbi',
    parcel: { color: ACCENT.blue, label: 'readings' },
    requires: ['offering'],
    offer: [
      'You there. You are carrying a bag, so you are basically infrastructure.',
      'These are six months of gravity readings and they are addressed to me, which is the problem.',
      'They belong to Doctor Fibbi. Two Bs. At Capital Corp. We have never met and I resent him deeply.',
    ],
    reminder: ['Capital Corp. Two Bs. Do not lose the middle page, it is the good one.'],
    deliver: [
      'Ah — the readings! I have been getting his noodles for a year and he has been getting my science.',
      'Six months of wobble data. Beautiful. Look at this wobble.',
      'I will send him something in return. Probably noodles.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'postcard',
    banner: "TAKE THE HERMIT'S POSTCARD TO THE FLOWER SELLER IN MAIN SQUARE",
    summary: 'A postcard from a man in a cave',
    from: 'wataru',
    to: 'mei',
    parcel: { color: ACCENT.white, label: 'postcard' },
    requires: ['gravity'],
    offer: [
      'You did not see me. Understood? Good.',
      'Take this to the woman who sells flowers in the main square. Do not say where I am.',
      'Say it came from overseas. Somewhere with weather. She likes weather.',
    ],
    reminder: ['Main square. Flowers. Overseas. That is the story and we are both sticking to it.'],
    deliver: [
      'A postcard! From my husband! On his big important trip!',
      "He says the coast is lovely. There is no coast in that handwriting, is there.",
      'He is in the woods. He is always in the woods. Give me a moment.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'clothes',
    banner: 'TAKE THE CLEAN CLOTHES TO THE MAN IN THE CAVE',
    summary: 'Clean clothes for the man in the woods',
    from: 'mei',
    to: 'wataru',
    parcel: { color: ACCENT.jade, label: 'laundry' },
    requires: ['postcard'],
    offer: [
      'Take him these. They are clean, which will be a novelty.',
      'Do not say they are from me. Tell him he won a competition.',
      'He will believe it. He has always believed it.',
    ],
    reminder: ['Whisper Woods. The cave. He will pretend to be surprised.'],
    deliver: [
      'A prize? Again? Two prizes in one lifetime.',
      'Just in time, actually. I was down to my last honest shirt.',
      'Tell nobody. Especially not anyone in a flower shop.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'letter-back',
    banner: 'FIND THE RED CLIFF HOUSE AND GET THE LETTER BACK',
    summary: "Retrieve Toshi's letter before the boss reads it",
    from: 'toshi',
    to: 'kade',
    parcel: { color: ACCENT.pink, label: 'urgent' },
    requires: ['clothes'],
    offer: [
      'Thank god. You are one of the delivery people. I need to un-deliver something.',
      'I sent my boss a letter last night. It was honest. Deeply, fatally honest.',
      'He lives at the red cliff house. Get it back before he opens it. Please.',
    ],
    reminder: ['Red cliff house. Red. Cliff. House. Before he opens it.'],
    deliver: [
      'You are the courier? Come in, come in. I was just reading this.',
      'One of my own staff wrote it. Every word of it. Astonishing.',
      "Nobody has told me the truth in eleven years. I'm promoting him.",
      'Take this back to him. Do not tell him what it says. Let him sweat a little.',
    ],
    thanks: 'LETTER RECOVERED',
  },
  {
    id: 'promotion',
    banner: "TAKE THE BOSS'S NOTE TO TOSHI IN THE MAIN SQUARE",
    summary: "A note from Mr. Kade to the office worker",
    from: 'kade',
    to: 'toshi',
    parcel: { color: ACCENT.red, label: 'note' },
    requires: ['letter-back'],
    autoStart: true,
    offer: ['Straight to him. And walk slowly. Let him think about it.'],
    reminder: ['Main square. The one who looks like he has not slept.'],
    deliver: [
      'Is that — is that his handwriting? Oh no. Oh no.',
      '"Senior associate executive assistant vice director." That is more words than I have.',
      'I am being promoted. For being honest. On this planet. Unbelievable.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'sea-letter',
    banner: 'TAKE THE LETTER FROM THE SEA TO DAVE AT SMELLY FALLS',
    summary: 'A letter that came back out of the sea',
    from: 'captain-ola',
    to: 'dave',
    parcel: { color: BUILD.tan, label: 'wet letter' },
    requires: ['promotion'],
    offer: [
      'Come look at this. Lockboxes. Buried in the sand off the point.',
      'One of them had a letter in it. Wet through, but the name at the top says Dave.',
      'I know exactly one Dave. He plays badly at the falls. Take it to him.',
    ],
    reminder: ['Smelly Falls. Follow the noise. Then follow the smell.'],
    deliver: [
      'A letter? For me? Out of the sea?',
      '"Dear future Dave..." — oh. Oh, that is my handwriting.',
      'Fourteen years old. I threw it off the pier and forgot about it.',
      'It says: keep practising, and get some sun. Rude. Correct, but rude.',
    ],
    thanks: 'FINAL DELIVERY COMPLETE',
    final: true,
  },
]

export const INTRO_LINES = [
  'Slept in again.',
  "Right. Today's deliveries.",
]

export const ENDING_LINES = [
  'Every parcel on the planet, delivered.',
  'It is a small planet. Someone has to.',
]

export const PARCEL_COLORS = [ACCENT.amber, ACCENT.blue, ACCENT.white, ACCENT.jade, ACCENT.pink, ACCENT.red, BUILD.tan]

export const EMOTES = [
  { id: 'hi', glyph: '👋', label: 'wave' },
  { id: 'love', glyph: '💚', label: 'nice' },
  { id: 'huh', glyph: '❓', label: 'lost' },
  { id: 'yes', glyph: '❗', label: 'aha' },
  { id: 'tired', glyph: '💤', label: 'tired' },
  { id: 'music', glyph: '🎵', label: 'hum' },
]

export const WARDROBE = {
  hairStyle: ['bob', 'short', 'long', 'bun', 'spiky', 'cap', 'strawHat'],
  hair: [0x1a1a1c, 0x40352c, 0x7a5638, 0xb98d52, 0xd8d2c6, 0x2f4f63, 0x7d3a4a],
  skin: [0xf7d9c0, 0xf4cdb0, 0xe4b189, 0xc98f63, 0x9c6540, 0x6f452b],
  shirt: [0xf3efe2, 0x212223, 0xc6394a, 0x3fa7c9, 0x4fae63, 0xf2c24b, 0xe58fa5, 0x7a5c9e],
  shorts: [0x212223, 0x4a5158, 0x8a7a5e, 0x2c4a6b, 0xc6394a, 0xf3efe2],
  shoes: [0x35bfa0, 0xc6394a, 0x3fa7c9, 0xf2c24b, 0x212223, 0xf3efe2, 0xe4622f],
  bag: [CHAR.bag, 0x3fa7c9, 0x4fae63, 0xf2c24b, 0x7a5c9e, 0x2e3338],
}

export const WARDROBE_LABELS = {
  hairStyle: 'Hair',
  hair: 'Colour',
  skin: 'Skin',
  shirt: 'Top',
  shorts: 'Bottoms',
  shoes: 'Shoes',
  bag: 'Bag',
}

export { NATURE }
