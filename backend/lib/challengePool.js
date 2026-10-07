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
// `rewardId` must be one of REWARDS below - the two borders the frontend
// knows how to draw (css_class 'cyan-glow' / 'gold-shimmer', see
// frontend/src/lib/api.ts's cosmeticAuraClass). Each challenge grants its
// border when you join.

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
];

const CHALLENGE_POOL = [
  {
    theme: 'Throwback Anthems',
    description:
      'Dig up a song from before the year 2000 - the kind that still fills a dance floor. Anything released in 1999 or earlier counts.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'Golden Tide',
    description:
      'Find a song with "gold" in its title. Golden hours, fool\'s gold, heart of gold - if it shines, it counts.',
    rewardId: 'gold-border',
  },
  {
    theme: 'Childhood Favorite',
    description:
      'Share the song that takes you straight back to being a kid - the car-ride radio hit, the cartoon theme, the one you knew every word to.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'Hidden Gems',
    description:
      'Shine a light on an underrated artist who deserves far more listeners. Pick a lesser-known track - no chart-toppers allowed.',
    rewardId: 'gold-border',
  },
  {
    theme: 'Lost in Translation',
    description:
      'Pick a song sung in a language other than English. You don\'t need to understand the lyrics - just feel the melody.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'Silver Screen',
    description:
      'Choose a track from a movie, series or video game soundtrack - an epic score, a credits-roll anthem or a needle-drop that made the scene.',
    rewardId: 'gold-border',
  },
  {
    theme: 'Mzansi Magic',
    description:
      'Celebrate South Africa with a track from a South African artist - amapiano, kwaito, jazz, Afrikaans, rock, anything homegrown.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'On Repeat',
    description:
      'Share the song you cannot stop playing right now - the one that has worn a groove into your week.',
    rewardId: 'gold-border',
  },
  {
    theme: 'Short & Sweet',
    description:
      'Say it all in under three minutes. Share a track shorter than 3:00 - no filler, all killer.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'Epic Journey',
    description:
      'Take the long way round with a track that runs 6 minutes or more - slow-burn builds, extended mixes and sprawling epics.',
    rewardId: 'gold-border',
  },
  {
    theme: 'Eighties Rewind',
    description:
      'Hop in the time machine to the 1980s. Share a track released between 1980 and 1989 - big synths, bigger choruses.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'Fresh Waves',
    description:
      'Ride the newest swell. Share a track released within the last 12 months and put something fresh in the ocean.',
    rewardId: 'gold-border',
  },
  {
    theme: 'Night Owl',
    description:
      'For the late-night listeners: share a song with night, midnight, moon, star or dark in its title.',
    rewardId: 'cyan-border',
  },
  {
    theme: 'Colour Wave',
    description:
      'Paint the ocean. Share a song with a colour in its title - Blue, Red, Black, Pink, Golden and friends all count.',
    rewardId: 'gold-border',
  },
  {
    theme: 'One-Word Wonder',
    description:
      'Keep it simple: share a song whose title is a single word. Short, sharp and instantly memorable.',
    rewardId: 'cyan-border',
  },
];

function getPoolEntry(theme) {
  return CHALLENGE_POOL.find((entry) => entry.theme === theme) || null;
}

module.exports = { CHALLENGE_POOL, REWARDS, getPoolEntry };
