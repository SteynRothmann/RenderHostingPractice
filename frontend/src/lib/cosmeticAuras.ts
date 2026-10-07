// Border ("aura") colours for weekly-challenge rewards. The key is the
// reward's css_class from the rewards table (see backend/lib/challengePool.js).
// The ocean canvas reads the RGB from here; the matching box-shadow classes
// (.wl-cosmetic-<css_class>) live in index.css and must use the same colours.
// Theme-invariant on purpose: a border should look the same in light and dark.
export const COSMETIC_AURA_RGB: Record<string, [number, number, number]> = {
  'cyan-glow': [34, 211, 238],
  'gold-shimmer': [251, 191, 36],
  'aura-crimson': [244, 63, 94],
  'aura-emerald': [16, 185, 129],
  'aura-violet': [139, 92, 246],
  'aura-coral': [255, 127, 80],
  'aura-ember': [249, 115, 22],
  'aura-pearl': [226, 232, 240],
  'aura-lime': [163, 230, 53],
  'aura-orchid': [232, 121, 249],
  'aura-sapphire': [59, 130, 246],
  'aura-lagoon': [20, 184, 166],
  'aura-indigo': [99, 102, 241],
  'aura-fuchsia': [236, 72, 153],
  'aura-sky': [56, 189, 248],
  'aura-mint': [110, 231, 183],
  'aura-quartz': [253, 164, 175],
  'aura-amethyst': [192, 132, 252],
};
