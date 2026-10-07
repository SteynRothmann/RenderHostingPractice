// The first-time tour, as data. Each step either points at a real element
// on the page (found via its `data-tour="..."` attribute) or is a centred
// message with nothing highlighted.
//
// A step moves on when the person presses Next, or - for steps with
// `advanceOn` - as soon as they actually do the thing it asks for.

export interface TourStep {
  id: string;
  // Page the step lives on. The tour navigates there if needed.
  route: string;
  // Value of the target's data-tour attribute. Omit for a centred message.
  target?: string;
  title: string;
  body: string;
  // "Try it" line shown on steps that wait for the person to do something.
  hint?: string;
  // Do the thing -> step completes by itself.
  advanceOn?: 'click' | 'focus';
  // Blur whatever is focused when leaving (closes the search dropdown).
  blurOnExit?: boolean;
  // Window event fired when the step is entered (see TourEvent below).
  enter?: TourEvent;
  // Element (data-tour value) to click once when the step is entered.
  enterClick?: string;
  // Force where the chat bubble sits relative to the highlight.
  placement?: 'auto' | 'top' | 'bottom';
}

// Events the pages listen for, so the tour can open/close panels it needs.
export type TourEvent = 'open-challenge' | 'close-challenge';
export const TOUR_EVENT_PREFIX = 'wl-tour:';

export const GUEST_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'Welcome to Wavelength',
    body: 'A quick tour. Skip any time.',
  },
  {
    id: 'ocean',
    route: '/',
    title: 'The Ocean',
    body: 'Each square is a song someone is playing right now. The green number shows how many are listening.',
  },
  {
    id: 'search',
    route: '/',
    target: 'search',
    title: 'Search',
    body: 'Find a song, artist or genre.',
    hint: 'Click the search bar',
    advanceOn: 'focus',
    blurOnExit: true,
  },
  {
    id: 'theme',
    route: '/',
    target: 'theme',
    title: 'Day or night',
    body: 'Switch the ocean between light and dark.',
    hint: 'Flip the switch',
    advanceOn: 'click',
  },
  {
    id: 'login',
    route: '/',
    target: 'login',
    title: 'Join in',
    body: 'Log in with Spotify to open songs, chat and join challenges.',
  },
  {
    id: 'done',
    route: '/',
    target: 'help',
    title: "That's it",
    body: 'Press ? to see this tour again.',
  },
];

export const USER_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'Welcome to Wavelength',
    body: 'A quick tour. Skip any time.',
  },
  {
    id: 'ocean',
    route: '/',
    title: 'The Ocean',
    body: 'Each square is a song someone is playing right now. Hover for details, click to open. Your own song gets a glowing ring.',
  },
  {
    id: 'search',
    route: '/',
    target: 'search',
    title: 'Search',
    body: 'Find a song, artist or genre.',
    hint: 'Click the search bar',
    advanceOn: 'focus',
    blurOnExit: true,
  },
  {
    id: 'song-panel',
    route: '/',
    title: 'Inside a song',
    body:
      'Listen on Spotify plays it for you (Premium).\n' +
      'Save adds it to Liked Songs.\n' +
      'Follow Along keeps you with the host.\n' +
      'Tap the host to request a chat.',
  },
  {
    id: 'theme',
    route: '/',
    target: 'theme',
    title: 'Day or night',
    body: 'Switch the ocean between light and dark.',
    hint: 'Flip the switch',
    advanceOn: 'click',
  },
  {
    id: 'challenge-button',
    route: '/',
    target: 'challenge-button',
    title: 'Weekly Challenge',
    body: 'A new theme every week. Join with a song that fits and win a limited border.',
    hint: 'Click the button',
    advanceOn: 'click',
  },
  {
    id: 'challenge-hero',
    route: '/',
    target: 'challenge-hero',
    enter: 'open-challenge',
    placement: 'bottom',
    title: "This week's theme",
    body: 'See the theme and time left. Press Join, pick a song and confirm.',
  },
  {
    id: 'challenge-border',
    route: '/',
    target: 'challenge-border',
    enter: 'open-challenge',
    placement: 'top',
    title: 'Borders',
    body: 'Joining unlocks an animated border for your picture and song. Each one is only offered for a week.',
  },
  {
    id: 'notifications',
    route: '/',
    target: 'nav-notifications',
    enter: 'close-challenge',
    title: 'Notifications',
    body: 'Chat requests show up here. Accept to become friends.',
  },
  {
    id: 'nav-chat',
    route: '/',
    target: 'nav-chat',
    title: 'Chat',
    body: 'Your messages and groups. A red dot means something new.',
  },
  {
    id: 'nav-profile',
    route: '/',
    target: 'nav-profile',
    title: 'Your profile',
    body: 'This is you.',
    hint: 'Click your picture',
    advanceOn: 'click',
  },
  {
    id: 'profile-edit',
    route: '/profile',
    target: 'profile-edit',
    title: 'Make it yours',
    body: 'Add a nickname and bio, then press Save changes.',
  },
  {
    id: 'chat-tabs',
    route: '/chat',
    target: 'chat-tabs',
    title: 'Friends and Groups',
    body: 'Friends are accepted requests. Groups let several friends chat together.',
  },
  {
    id: 'new-group',
    route: '/chat',
    target: 'new-group',
    enterClick: 'chat-tab-groups',
    title: 'Create a group',
    body: 'Name it, pick a picture and add friends. You become Admin and can add people, make moderators and remove members.',
  },
  {
    id: 'done',
    route: '/chat',
    title: "You're all set",
    body: 'Press ? at the top of the ocean to replay this tour.',
  },
];
