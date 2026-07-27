import { ACCENT, BUILD, CHAR, NATURE } from '../core/palette.js'

/**
 * Everyone who lives on the planet, and the deliveries that string them
 * together.
 *
 * `at` is an anchor id registered by the world builder, or [zoneId, x, z] to
 * drop someone at district-local metres. `look` feeds straight into the rig.
 */

const SARONG = 0x8a4a3c
const SARONG_DARK = 0x5c3a30
const KEBAYA = 0xf6f1e2

export const NPCS = [
  {
    id: 'rui',
    name: 'Pak Wayan, Depot Manager',
    at: 'main-square:depot',
    offset: [-0.8, 0.4],
    facing: 3.4,
    look: { hairStyle: 'udeng', hair: 0x1d1815, shirt: 0xe8e2d2, shorts: SARONG_DARK, shoes: 0x2f3438, bag: null, accessory: 'tie', accessoryColor: ACCENT.saffron, longPants: true, scale: 1.06 },
    idle: [
      'Morning. Or afternoon. Hard to tell on an island this small.',
      'Anything on the list is yours. Anything not on the list is also yours, technically.',
      'Take your time. You can walk around the whole planet before the rice is cooked.',
    ],
  },
  {
    id: 'granny-hoshi',
    name: 'Dadong Rai',
    at: 'main-square:center',
    offset: [-6.5, 6.5],
    facing: 2.2,
    look: { hairStyle: 'bun', hair: 0xdcd6c8, skin: 0xc08a57, shirt: 0xd4c2dc, shorts: 0x574a63, shoes: 0x6d5f54, bag: null, longPants: true, scale: 0.92, build: 1.05 },
    idle: [
      'My knees and I have an understanding. They stay down here at sea level.',
      'The temple is up past the split gate. Very far. Very up.',
      'I have carried offerings up that mountain for sixty years. Sixty. On my head.',
    ],
  },
  {
    id: 'ino',
    name: 'Pemangku Ketut',
    at: 'mountain-temple:hall',
    offset: [0, 7.5],
    facing: 0,
    look: { hairStyle: 'udeng', hair: 0x8d8378, skin: 0xc08a57, shirt: 0xf4f0e2, shorts: 0xd8cdb6, shoes: 0x5c4c3c, bag: null, longPants: true, scale: 1.02 },
    idle: [
      'Listen. That is the sound of nothing needing you.',
      'The wind does most of the talking up here. I just keep the shrines swept.',
      'Eleven roofs on that meru. Count them yourself, everybody does.',
    ],
  },
  {
    id: 'dr-fibi',
    name: 'Doctor Sari',
    at: 'mountain-temple:base',
    offset: [3.5, -2],
    facing: 3.0,
    look: { hairStyle: 'bun', hair: 0x2f2620, skin: 0xd9a878, shirt: 0xf2f2ee, shorts: 0x4a5158, shoes: 0xd8d4cc, bag: null, accessory: 'tie', accessoryColor: ACCENT.teal, longPants: true },
    idle: [
      'The planet is small enough that I can measure its wobble by hand.',
      'Two doctors, one island, one letter between our names. It was always going to end badly.',
    ],
  },
  {
    id: 'dr-fibbi',
    name: 'Doctor Sarih',
    at: 'capital-corp:lobby',
    offset: [2, 3],
    facing: 3.3,
    look: { hairStyle: 'short', hair: 0x2b2a2c, skin: 0xc08a57, shirt: 0xeef0f0, shorts: 0x3b4046, shoes: 0x24282c, bag: null, accessory: 'tie', accessoryColor: ACCENT.blue, longPants: true, scale: 1.03 },
    idle: [
      'Do you know why I have sixty-three packs of instant noodles? Neither do I.',
      'Everything addressed to me arrives somewhere else. Everything addressed elsewhere arrives here.',
      'One letter. One. Sari, Sarih. The post office has never once got it right.',
    ],
  },
  {
    id: 'wataru',
    name: 'Nyoman',
    at: 'whisper-woods:cave',
    offset: [0, 6.2],
    facing: 0,
    look: { hairStyle: 'long', hair: 0x4a3f37, skin: 0xc08a57, shirt: 0x8f7f68, shorts: 0x4c4238, shoes: 0x3a332c, bag: null, longPants: true, build: 1.08 },
    idle: [
      'A cave is just a compound that stopped asking for a wall.',
      "Don't tell anyone I'm out here. Especially not anyone I'm married to.",
      'The monkeys took my sandals. Twice. I have stopped taking it personally.',
    ],
  },
  {
    id: 'mei',
    name: 'Luh Kade, Canang Seller',
    at: 'main-square:flowers',
    offset: [0, 0],
    facing: 1.1,
    look: { hairStyle: 'bun', hair: 0x2f2a28, skin: 0xd9a878, shirt: KEBAYA, shorts: SARONG, shoes: 0xc9c4b8, bag: null, scale: 0.97 },
    idle: [
      'Frangipani, marigold, a folded palm leaf. Four hundred a day and I still like making them.',
      'Everybody needs an offering. Nobody has time to fold one. That is the whole business.',
      'If you see a man living in a cave in the forest, tell him the rent here is fine.',
    ],
  },
  {
    id: 'captain-ola',
    name: 'Pak Gede',
    at: 'seaside:pier',
    offset: [0, 0],
    facing: 3.6,
    look: { hairStyle: 'cap', hair: 0x1f2933, skin: 0x9c6540, shirt: 0x4f7fa8, shorts: 0x2f3a44, shoes: 0xb9b2a4, bag: null, longPants: true, build: 1.12, scale: 1.05 },
    idle: [
      'Out before light, back before the wind turns. Same as my father, same as his.',
      'The jukung is older than I am and complains less.',
      'The sea keeps things. Sometimes it gives them back wet.',
    ],
  },
  {
    id: 'dave',
    name: 'Komang',
    at: 'smelly-falls:pool',
    offset: [3.5, 2.5],
    facing: 2.6,
    look: { hairStyle: 'long', hair: 0x33302e, skin: 0xd9a878, shirt: 0xb9d0c4, shorts: 0x4b5a52, shoes: 0xe4dfd2, bag: null, accessory: 'backpack', accessoryColor: BUILD.woodDark },
    idle: [
      'Falls are loud. Good for practising badly.',
      'Tourists come, take one photo, leave. I have been here since Tuesday.',
    ],
  },
  {
    id: 'kade',
    name: 'Ida Bagus Oka',
    at: 'red-cliff:house',
    offset: [0, 6],
    facing: 0,
    look: { hairStyle: 'udeng', hair: 0x6b625a, skin: 0xc08a57, shirt: 0xf0efe8, shorts: SARONG_DARK, shoes: 0x1f2326, bag: null, accessory: 'tie', accessoryColor: ACCENT.deepRed, longPants: true, build: 1.15, scale: 1.05 },
    idle: [
      'Shipments in. Shipments out. That is the whole philosophy.',
      'I built the house facing the water so I would have to look at something honest.',
    ],
  },
  {
    id: 'toshi',
    name: 'Putu',
    at: 'main-square:office',
    offset: [0, 0],
    facing: 3.9,
    look: { hairStyle: 'short', hair: 0x241f1d, skin: 0xd9a878, shirt: 0xf4f2ea, shorts: 0x424a52, shoes: 0x2a2e32, bag: null, accessory: 'tie', accessoryColor: ACCENT.saffron, longPants: true },
    idle: [
      'I am extremely calm. Look at how calm I am.',
      'Have you ever sent something you could not un-send?',
    ],
  },
  {
    id: 'nao',
    name: 'Dewi',
    at: 'back-streets:alley',
    offset: [0, 0],
    facing: 1.6,
    look: { hairStyle: 'bob', hair: 0x2b4f63, skin: 0xd9a878, shirt: 0x2f3438, shorts: 0x1f2326, shoes: 0xe4622f, bag: null, accessory: 'backpack', accessoryColor: ACCENT.purple, scale: 0.98 },
    idle: [
      'The whole planet is triangles. Do not tell the others.',
      'It is carving, except the chisel is maths and the maths argues back.',
      'I keep the frame rate up so nobody notices the island is hollow.',
    ],
  },
  {
    id: 'iri',
    name: 'Men Sari',
    at: 'lucero-graveyard:center',
    offset: [3, -2],
    facing: 2.4,
    look: { hairStyle: 'bun', hair: 0x2a2a2e, skin: 0xc08a57, shirt: 0xe4e0d6, shorts: SARONG_DARK, shoes: 0x24282c, bag: null, longPants: true, scale: 1.0 },
    idle: [
      'Everybody on this island walks past here eventually. Twice, if you count properly.',
      'I sweep the frangipani off the shrines. By evening it is all back down again.',
      'It is not a sad place. It is just the last stop before the next one.',
    ],
  },
  {
    id: 'kenta',
    name: 'Kadek',
    at: 'back-streets:alley',
    offset: [6, -7],
    facing: 0.7,
    look: { hairStyle: 'bob', hair: 0x1c1c1e, skin: 0xd9a878, shirt: 0xf1ede0, shorts: 0x24262a, shoes: 0x3fa7c9, bag: null, scale: 0.88 },
    idle: [
      "First the radius of the tyre. Then the circumference. Then I'll know how far I've cycled this year.",
      'Do not interrupt. There is a decimal point at stake.',
      'I think I can hear my mother calling. It can wait. Maths cannot.',
    ],
  },
  {
    id: 'hana',
    name: 'Ayu',
    at: 'seaside:lighthouse',
    offset: [-5, -5],
    facing: 1.9,
    look: { hairStyle: 'bun', hair: 0x4b3b30, skin: 0xd9a878, shirt: 0xf6dfae, shorts: 0x8fb0c4, shoes: 0xe9f0f2, bag: null, scale: 0.95 },
    idle: [
      'The light goes round and round. So does everything here, I suppose.',
      'Nothing to report. That is the report.',
    ],
  },
  {
    id: 'goro',
    name: 'Pak Made',
    at: 'capital-corp:tower',
    offset: [-7, 6],
    facing: 3.1,
    look: { hairStyle: 'cap', hair: 0x2a2622, skin: 0x9c6540, shirt: 0xe4622f, shorts: 0x3c4247, shoes: 0x2a2e32, bag: null, accessory: 'apron', accessoryColor: BUILD.metal, longPants: true, build: 1.1 },
    idle: [
      'New kid is late again. Third time this week. There have been two days this week.',
      'We make boxes. Inside the boxes: smaller boxes.',
    ],
  },
  {
    id: 'sora',
    name: 'Gus Alit',
    at: 'mountain-temple:gate',
    offset: [4.5, 3],
    facing: 3.4,
    look: { hairStyle: 'udeng', hair: 0x3d3330, skin: 0xd9a878, shirt: 0xf2efe2, shorts: SARONG, shoes: 0xd8d2c4, bag: null, longPants: true, scale: 0.94 },
    idle: [
      'Every step up here is a step you have to take back down. Think about that.',
      'I come for the view. I stay because the stairs are terrifying.',
    ],
  },
  {
    id: 'nyanya',
    name: 'Nyanya',
    at: 'main-square:depot',
    offset: [-3.2, 1.6],
    facing: 2.6,
    look: {
      hairStyle: 'bun',
      hair: 0x1d1815,
      skin: 0xe4b189,
      shirt: 0xf2a0b8, // pink kebaya
      shorts: 0x6b3550, // plum kamen
      shoes: 0xd9c79e,
      bag: null,
      accessory: 'sash',
      accessoryColor: 0xd8a83f,
      hairFlower: 0xf7f0d6,
      longPants: true,
      longSleeves: true,
      scale: 0.96,
      build: 0.94,
    },
    idle: [
      'Off on your round already? Bring me a story back, not just receipts.',
      'I fold the kebaya pleats myself. Forty minutes. Worth every one.',
      'The frangipani goes over the right ear when you are working. Remember that.',
      'You always sleep in, and the island always waits. Funny how that works.',
    ],
  },
  {
    id: 'nxr',
    name: 'NXR',
    at: 'main-square:board',
    offset: [1.6, 1.8],
    facing: 3.6,
    look: {
      species: 'koala',
      hairStyle: 'udeng',
      hair: 0x8a8f96,
      skin: 0x9aa0a8,
      shirt: 0xf4efe0,
      shorts: 0x24211d, // poleng-dark kamen
      shoes: 0x6c7476,
      bag: null,
      accessory: 'vr',
      accessoryColor: 0x24262b,
      longPants: true,
      scale: 0.88,
      build: 1.18,
    },
    idle: [
      'I am in two islands at once. This one has better snacks.',
      'The headset shows me the planet from orbit. Still small. Reassuring.',
      'Eucalyptus is overrated. Have you tried jackfruit?',
      'Do not wave at me. In here you are all just very slow polygons.',
    ],
  },
  {
    id: 'barong',
    name: 'Ketut Barong',
    at: 'lucero-graveyard:gate',
    offset: [2.6, -2.2],
    facing: 0.6,
    look: {
      hairStyle: 'barong',
      hair: 0xa32f33,
      skin: 0xc08a57,
      shirt: 0xf4efe0,
      shorts: 0xa32f33,
      shoes: 0xd9c79e,
      bag: null,
      accessory: 'mane',
      accessoryColor: 0xf4f0e4,
      longPants: true,
      build: 1.26,
      scale: 1.08,
    },
    idle: [
      'The mask stays on. The mask always stays on at the setra.',
      'I dance so the island stays in balance. Somebody has to.',
      'Two men share this costume normally. The other one is at lunch.',
      'Rangda has not shown her face in years. I take full credit.',
    ],
  },
  {
    id: 'nengah',
    name: 'Pekaseh Nengah',
    at: 'rice-terrace:subak',
    offset: [3.5, 5.5],
    facing: 3.2,
    look: { hairStyle: 'strawHat', hair: 0x241f1d, skin: 0x9c6540, shirt: 0xe6e0cc, shorts: SARONG_DARK, shoes: 0x6d5f54, bag: null, longPants: true, build: 1.06 },
    idle: [
      'Every field on this ridge drinks in order. My job is the order.',
      'Water first, then the temple, then the arguing. In that sequence, always.',
      'Thirty-one families share this channel and not one of them has ever gone thirsty.',
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
    banner: "TAKE DADONG RAI'S OFFERING UP TO PURA BESAKIH",
    summary: 'An offering for the mountain temple',
    from: 'granny-hoshi',
    to: 'ino',
    parcel: { color: ACCENT.saffron, label: 'banten' },
    requires: [],
    offer: [
      'Oh good, a messenger. My knees have filed a complaint about those temple stairs.',
      'Would you carry this up to the pemangku for me? Only incense, rice cake and a little arak.',
      'Straight past the split gate. You cannot miss it, it is the only mountain.',
    ],
    reminder: ['Past the split gate, dear. The one shaped like a gate cut in half.'],
    deliver: [
      'From Dadong Rai? She has been sending these up since before I had this job.',
      'Tell her the shrines are still swept. She will know what that means.',
    ],
    thanks: 'OFFERING RECEIVED',
  },
  {
    id: 'gravity',
    banner: 'TAKE THE GRAVITY READINGS TO DOCTOR SARIH IN DENPASAR',
    summary: 'Gravity readings for the other doctor',
    from: 'dr-fibi',
    to: 'dr-fibbi',
    parcel: { color: ACCENT.blue, label: 'readings' },
    requires: ['offering'],
    offer: [
      'You there. You are carrying a bag, so you are basically infrastructure.',
      'These are six months of gravity readings and they are addressed to me, which is the problem.',
      'They belong to Doctor Sarih. With an H. Down in Denpasar. We have never met and I resent him deeply.',
    ],
    reminder: ['Denpasar. Sarih, with an H. Do not lose the middle page, it is the good one.'],
    deliver: [
      'Ah — the readings! I have been getting her noodles for a year and she has been getting my science.',
      'Six months of wobble data. Beautiful. Look at this wobble.',
      'I will send her something in return. Probably noodles.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'water',
    banner: 'TAKE THE SUBAK SCHEDULE DOWN TO THE MARKET NOTICE BOARD',
    summary: 'The season water schedule for the village',
    from: 'nengah',
    to: 'rui',
    parcel: { color: NATURE.leafLight, label: 'schedule' },
    requires: ['gravity'],
    offer: [
      'You came up the ridge, so you can go back down it. Good.',
      'This is the water order for the season. Which field drinks on which day, all thirty-one of them.',
      'It has to reach the depot before anyone starts guessing. Guessing is how feuds begin.',
    ],
    reminder: ['Down to the depot at Pasar Ubud. Before anybody starts guessing.'],
    deliver: [
      'The subak schedule — finally. I have had four people in here asking about Thursday.',
      'Thirty-one families and one channel, and somehow this piece of paper keeps the peace.',
      'I will pin it up. Then I will hide behind the counter.',
    ],
    thanks: 'SCHEDULE DELIVERED',
  },
  {
    id: 'postcard',
    banner: 'TAKE THE HERMIT’S POSTCARD TO THE CANANG SELLER AT PASAR UBUD',
    summary: 'A postcard from a man in a cave',
    from: 'wataru',
    to: 'mei',
    parcel: { color: ACCENT.white, label: 'postcard' },
    requires: ['water'],
    offer: [
      'You did not see me. Understood? Good.',
      'Take this to the woman who folds offerings in the market. Do not say where I am.',
      'Say it came from across the water. Somewhere with weather. She likes weather.',
    ],
    reminder: ['Pasar Ubud. The canang stall. Across the water. That is the story and we are both sticking to it.'],
    deliver: [
      'A postcard! From my husband! On his big important trip!',
      'He says the coast is lovely. There is no coast in that handwriting, is there.',
      'He is in the forest. He is always in the forest. Give me a moment.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'clothes',
    banner: 'TAKE THE CLEAN CLOTHES TO THE MAN IN THE CAVE',
    summary: 'Clean clothes for the man in the forest',
    from: 'mei',
    to: 'wataru',
    parcel: { color: ACCENT.jade, label: 'laundry' },
    requires: ['postcard'],
    offer: [
      'Take him these. They are clean, which will be a novelty.',
      'Do not say they are from me. Tell him he won a competition.',
      'He will believe it. He has always believed it.',
    ],
    reminder: ['Monkey Forest. The cave. He will pretend to be surprised.'],
    deliver: [
      'A prize? Again? Two prizes in one lifetime.',
      'Just in time, actually. I was down to my last honest shirt.',
      'Tell nobody. Especially not anybody at a canang stall.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'letter-back',
    banner: 'GET TO THE CLIFF HOUSE AT ULUWATU AND GET THE LETTER BACK',
    summary: "Retrieve Putu's letter before the boss reads it",
    from: 'toshi',
    to: 'kade',
    parcel: { color: ACCENT.pink, label: 'urgent' },
    requires: ['clothes'],
    offer: [
      'Thank god. You are one of the delivery people. I need to un-deliver something.',
      'I sent my boss a letter last night. It was honest. Deeply, fatally honest.',
      'He lives at the cliff house out at Uluwatu. Get it back before he opens it. Please.',
    ],
    reminder: ['The cliff house. Uluwatu. Before he opens it.'],
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
    banner: "TAKE THE BOSS'S NOTE BACK TO PUTU AT PASAR UBUD",
    summary: 'A note from Ida Bagus Oka to the office worker',
    from: 'kade',
    to: 'toshi',
    parcel: { color: ACCENT.red, label: 'note' },
    requires: ['letter-back'],
    autoStart: true,
    offer: ['Straight to him. And walk slowly. Let him think about it.'],
    reminder: ['Pasar Ubud. The one who looks like he has not slept.'],
    deliver: [
      'Is that — is that his handwriting? Oh no. Oh no.',
      '"Senior associate executive assistant vice director." That is more words than I have.',
      'I am being promoted. For being honest. On this island. Unbelievable.',
    ],
    thanks: 'PACKAGE RECEIVED',
  },
  {
    id: 'sea-letter',
    banner: 'TAKE THE LETTER FROM THE SEA TO KOMANG AT TEGENUNGAN',
    summary: 'A letter that came back out of the sea',
    from: 'captain-ola',
    to: 'dave',
    parcel: { color: BUILD.tan, label: 'wet letter' },
    requires: ['promotion'],
    offer: [
      'Come look at what came up in the net this morning. A bottle. Corked, still.',
      'There was a letter in it. Wet through, but the name at the top says Komang.',
      'I know exactly one Komang. He plays badly at the falls. Take it to him.',
    ],
    reminder: ['Tegenungan. Follow the noise. Then keep following it.'],
    deliver: [
      'A letter? For me? Out of the sea?',
      '"Dear future Komang..." — oh. Oh, that is my handwriting.',
      'Fourteen years old. I threw it off the pier at Sanur and forgot about it.',
      'It says: keep practising, and get out of the shade. Rude. Correct, but rude.',
    ],
    thanks: 'FINAL DELIVERY COMPLETE',
    final: true,
  },
]

export const INTRO_LINES = ['Slept in again.', "Right. Today's round."]

export const ENDING_LINES = [
  'Every parcel on the island, delivered.',
  'It is a small planet. Somebody has to.',
  'Nothing left on the list. Time to go and sit down.',
]

export const PARCEL_COLORS = [ACCENT.saffron, ACCENT.blue, ACCENT.white, ACCENT.jade, ACCENT.pink, ACCENT.red, BUILD.tan]

export const EMOTES = [
  { id: 'hi', glyph: '👋', label: 'wave' },
  { id: 'love', glyph: '💚', label: 'nice' },
  { id: 'huh', glyph: '❓', label: 'lost' },
  { id: 'yes', glyph: '❗', label: 'aha' },
  { id: 'tired', glyph: '💤', label: 'tired' },
  { id: 'music', glyph: '🎵', label: 'hum' },
]

export const WARDROBE = {
  hairStyle: ['udeng', 'bob', 'short', 'long', 'bun', 'spiky', 'cap', 'strawHat'],
  hair: [0x1d1815, 0x2f2620, 0x4a3728, 0x7a5638, 0xb98d52, 0xd8d2c6, 0x5c3a2e],
  skin: [0xf2d3b4, 0xe4b189, 0xd9a878, 0xc08a57, 0x9c6540, 0x6f452b],
  shirt: [0xf6f1e2, 0x24211d, 0xc6394a, 0x3fa7c9, 0x4fae63, 0xf2b93b, 0xe58fa5, 0xd8a83f],
  shorts: [0x8a4a3c, 0x5c3a30, 0x24211d, 0x4a5158, 0x2c4a6b, 0xf6f1e2],
  shoes: [0x2f9c9c, 0xc6394a, 0x3fa7c9, 0xf2b93b, 0x24211d, 0xf6f1e2, 0xe4622f],
  bag: [CHAR.bag, 0x3fa7c9, 0x4fae63, 0xf2b93b, 0x7a5c9e, 0xd8a83f],
}

export const WARDROBE_LABELS = {
  hairStyle: 'Hair',
  hair: 'Colour',
  skin: 'Skin',
  shirt: 'Top',
  shorts: 'Sarong',
  shoes: 'Shoes',
  bag: 'Bag',
}

export { NATURE }
