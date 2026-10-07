// The pool of weekly challenges that lib/challengeRotation.js draws from
// whenever a challenge ends and the next one has to start automatically.
//
// This file is the source of truth for challenge names/descriptions: at
// startup, any `challenges` row whose theme matches an entry here gets its
// description synced to the text below (see syncPoolDescriptions), so
// improving a description here is enough - no SQL needed.
//
// `theme` is also the key into lib/challengesValidation.js: themes with a
// rule there are checked against the real Spotify track data on submit
// ("checked"); the rest are honor-system, because there's no Spotify field
// that can answer "is this from your childhood?" ("honor").
//
// Rewards are NOT tied to a theme: each time a challenge starts,
// lib/challengeRotation.js picks a random border from REWARDS that no earlier
// challenge has used, so every reward is limited-time and never comes back.
// Every css_class here must also exist in frontend/src/lib/cosmeticAuras.ts
// (that's where the frontend learns how to draw it) and index.css.

const REWARDS = [
  {
    reward_id: 'cyan-border',
    name: 'Abyssal Crest',
    description:
      'Bioluminescent cyan glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'cyan-glow',
  },
  {
    reward_id: 'gold-border',
    name: 'Golden Tide',
    description:
      'Radiant golden shimmer applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'gold-shimmer',
  },
  {
    reward_id: 'aura-crimson',
    name: 'Crimson Tide',
    description:
      'Deep crimson glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-crimson',
  },
  {
    reward_id: 'aura-emerald',
    name: 'Emerald Reef',
    description:
      'Living-reef emerald glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-emerald',
  },
  {
    reward_id: 'aura-violet',
    name: 'Violet Abyss',
    description:
      'Violet glow from the deepest trench applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-violet',
  },
  {
    reward_id: 'aura-coral',
    name: 'Coral Bloom',
    description:
      'Warm coral glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-coral',
  },
  {
    reward_id: 'aura-ember',
    name: 'Sunset Ember',
    description:
      'Burning sunset-orange glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-ember',
  },
  {
    reward_id: 'aura-pearl',
    name: 'Pearl Wave',
    description:
      'Soft pearl-white glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-pearl',
  },
  {
    reward_id: 'aura-lime',
    name: 'Aurora Lime',
    description:
      'Electric aurora-lime glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-lime',
  },
  {
    reward_id: 'aura-orchid',
    name: 'Orchid Pulse',
    description:
      'Pulsing orchid glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-orchid',
  },
  {
    reward_id: 'aura-sapphire',
    name: 'Sapphire Deep',
    description:
      'Rich sapphire-blue glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-sapphire',
  },
  {
    reward_id: 'aura-lagoon',
    name: 'Lagoon Teal',
    description:
      'Calm lagoon-teal glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-lagoon',
  },
  {
    reward_id: 'aura-indigo',
    name: 'Midnight Indigo',
    description:
      'Midnight indigo glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-indigo',
  },
  {
    reward_id: 'aura-fuchsia',
    name: 'Neon Fuchsia',
    description:
      'Vivid neon-fuchsia glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-fuchsia',
  },
  {
    reward_id: 'aura-sky',
    name: 'Sky Mirage',
    description:
      'Bright sky-blue glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-sky',
  },
  {
    reward_id: 'aura-mint',
    name: 'Sea Mint',
    description:
      'Cool sea-mint glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-mint',
  },
  {
    reward_id: 'aura-quartz',
    name: 'Rose Quartz',
    description:
      'Gentle rose-quartz glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-quartz',
  },
  {
    reward_id: 'aura-amethyst',
    name: 'Amethyst Haze',
    description:
      'Dreamy amethyst glow applied to your avatar aura and your floating ocean song marker.',
    effect_type: 'both',
    css_class: 'aura-amethyst',
  },
];

const CHALLENGE_POOL = [
  {
    theme: 'Throwback Anthems',
    description:
      'Dig up a song from before the year 2000 - the kind that still fills a dance floor. Anything released in 1999 or earlier counts.',
  },
  {
    theme: 'Golden Tide',
    description:
      'Find a song with "gold" in its title. Golden hours, fool\'s gold, heart of gold - if it shines, it counts.',
  },
  {
    theme: 'Childhood Favorite',
    description:
      'Share the song that takes you straight back to being a kid - the car-ride radio hit, the cartoon theme, the one you knew every word to.',
  },
  {
    theme: 'Hidden Gems',
    description:
      'Shine a light on an underrated artist who deserves far more listeners. Pick a lesser-known track - no chart-toppers allowed.',
  },
  {
    theme: 'Lost in Translation',
    description:
      'Pick a song sung in a language other than English. You don\'t need to understand the lyrics - just feel the melody.',
  },
  {
    theme: 'Silver Screen',
    description:
      'Choose a track from a movie, series or video game soundtrack - an epic score, a credits-roll anthem or a needle-drop that made the scene.',
  },
  {
    theme: 'Mzansi Magic',
    description:
      'Celebrate South Africa with a track from a South African artist - amapiano, kwaito, jazz, Afrikaans, rock, anything homegrown.',
  },
  {
    theme: 'On Repeat',
    description:
      'Share the song you cannot stop playing right now - the one that has worn a groove into your week.',
  },
  {
    theme: 'Short & Sweet',
    description:
      'Say it all in under three minutes. Share a track shorter than 3:00 - no filler, all killer.',
  },
  {
    theme: 'Epic Journey',
    description:
      'Take the long way round with a track that runs 6 minutes or more - slow-burn builds, extended mixes and sprawling epics.',
  },
  {
    theme: 'Eighties Rewind',
    description:
      'Hop in the time machine to the 1980s. Share a track released between 1980 and 1989 - big synths, bigger choruses.',
  },
  {
    theme: 'Fresh Waves',
    description:
      'Ride the newest swell. Share a track released within the last 12 months and put something fresh in the ocean.',
  },
  {
    theme: 'Night Owl',
    description:
      'For the late-night listeners: share a song with night, midnight, moon, star or dark in its title.',
  },
  {
    theme: 'Colour Wave',
    description:
      'Paint the ocean. Share a song with a colour in its title - Blue, Red, Black, Pink, Golden and friends all count.',
  },
  {
    theme: 'One-Word Wonder',
    description:
      'Keep it simple: share a song whose title is a single word. Short, sharp and instantly memorable.',
  },
];

function getPoolEntry(theme) {
  return CHALLENGE_POOL.find((entry) => entry.theme === theme) || null;
}

module.exports = { CHALLENGE_POOL, REWARDS, getPoolEntry };
