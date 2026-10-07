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
    body: "I'm your guide. In about a minute I'll show you what everything does. You can skip me whenever you like.",
  },
  {
    id: 'ocean',
    route: '/',
    title: 'The Ocean',
    body: "Every floating square is a song someone on Wavelength is listening to right now. It moves live - when someone changes song, the square changes too. A green number on a square shows how many people are listening to it together.",
  },
  {
    id: 'hover',
    route: '/',
    title: 'Hover to peek',
    body: "Hover a square to see its song and artist. Clicking one opens the song panel - that needs a free account, so you'll be taken to the login page.",
  },
  {
    id: 'search',
    route: '/',
    target: 'search',
    title: 'Search the ocean',
    body: "Look for a song, an artist or a genre. Squares that don't match fade away. Click the box to see everything playing right now.",
    hint: 'Try it: click the search bar',
    advanceOn: 'focus',
    blurOnExit: true,
  },
  {
    id: 'theme',
    route: '/',
    target: 'theme',
    title: 'Day or night',
    body: 'Switch between the light and dark ocean. Wavelength remembers your choice.',
    hint: 'Try it: flip the switch',
    advanceOn: 'click',
  },
  {
    id: 'login',
    route: '/',
    target: 'login',
    title: 'Join in',
    body: "Log in with Spotify to open song panels, chat with people, take part in the Weekly Challenge and win profile borders. Any Spotify account works - Premium is only needed to listen along with someone.",
  },
  {
    id: 'done',
    route: '/',
    target: 'help',
    title: "That's the tour",
    body: 'Press this ? button any time to see the tour again. Enjoy the ocean!',
  },
];

export const USER_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'Welcome to Wavelength',
    body: "I'm your guide. In about a minute I'll show you what everything does. You can skip me whenever you like.",
  },
  {
    id: 'ocean',
    route: '/',
    title: 'The Ocean',
    body: "Every floating square is a song someone on Wavelength is listening to right now. It moves live - when someone changes song, the square changes too. A green number on a square shows how many people are listening to it together.",
  },
  {
    id: 'your-song',
    route: '/',
    title: 'Your own song',
    body: "Play something on Spotify and your song joins the ocean with a glowing ring and rising bubbles. Pause for 10 seconds, or stop playing, and it sinks away again.",
  },
  {
    id: 'hover',
    route: '/',
    title: 'Hover to peek, click to open',
    body: 'Hover a square to see its song and artist. Click it to open the song panel.',
  },
  {
    id: 'search',
    route: '/',
    target: 'search',
    title: 'Search the ocean',
    body: "Look for a song, an artist or a genre. Squares that don't match fade away. Click the box to see everything playing right now.",
    hint: 'Try it: click the search bar',
    advanceOn: 'focus',
    blurOnExit: true,
  },
  {
    id: 'song-panel',
    route: '/',
    title: 'Inside a song',
    body:
      'The song panel lets you:\n' +
      '- Listen on Spotify: starts that exact song for you, in sync with the host (needs Spotify Premium)\n' +
      '- Save to Playlist: adds it to your Spotify Liked Songs\n' +
      '- Follow Along: automatically follow the host from song to song\n' +
      '- Tap the host to see their profile and send them a chat request',
  },
  {
    id: 'theme',
    route: '/',
    target: 'theme',
    title: 'Day or night',
    body: 'Switch between the light and dark ocean. Wavelength remembers your choice.',
    hint: 'Try it: flip the switch',
    advanceOn: 'click',
  },
  {
    id: 'challenge-button',
    route: '/',
    target: 'challenge-button',
    title: 'Weekly Challenge',
    body: "A new theme every week, like \"Short & Sweet\" or \"Hidden Gems\". Pick a song that fits, join in, and win a limited-time animated border.",
    hint: 'Try it: click the button',
    advanceOn: 'click',
  },
  {
    id: 'challenge-hero',
    route: '/',
    target: 'challenge-hero',
    enter: 'open-challenge',
    placement: 'bottom',
    title: "This week's theme",
    body: "Here's the theme, the time left and how many people have joined. Press \"Join this challenge\", search for a song that fits and confirm. Your song starts playing on your Spotify so it shows up in the ocean.",
  },
  {
    id: 'challenge-border',
    route: '/',
    target: 'challenge-border',
    enter: 'open-challenge',
    placement: 'top',
    title: 'Borders',
    body: "Joining unlocks that week's border - an animated frame for your profile picture and your song square in the ocean. Each border is only on offer for one week, so grab it! \"Change border\" lets you wear any border you own.",
  },
  {
    id: 'challenge-entries',
    route: '/',
    target: 'challenge-entries',
    enter: 'open-challenge',
    placement: 'top',
    title: "Everyone's songs",
    body: "Every song submitted this week is listed here, with each person's border. Great for finding new music.",
  },
  {
    id: 'notifications',
    route: '/',
    target: 'nav-notifications',
    enter: 'close-challenge',
    title: 'Notifications',
    body: 'When someone asks to chat with you, a red dot appears here. Open it to accept (you become friends and can message) or decline.',
  },
  {
    id: 'nav-chat',
    route: '/',
    target: 'nav-chat',
    title: 'Chat',
    body: 'Your private messages and group chats live here. A red dot means you have unread messages. To chat with someone new, tap their name on a song panel and press "Request Chat".',
  },
  {
    id: 'nav-profile',
    route: '/',
    target: 'nav-profile',
    title: 'Your profile',
    body: "That's you! Your picture shows your border once you've won one. Open your profile now.",
    hint: 'Try it: click your picture',
    advanceOn: 'click',
  },
  {
    id: 'profile-edit',
    route: '/profile',
    target: 'profile-edit',
    title: 'Make it yours',
    body: 'Add a nickname - friends see it instead of your Spotify name - and a short bio. Press "Save changes" when you are done.',
  },
  {
    id: 'profile-stats',
    route: '/profile',
    target: 'profile-stats',
    title: 'Your listening',
    body: 'Below this you will find your Spotify followers, your top genres, your recently played songs and your public playlists.',
  },
  {
    id: 'chat-tabs',
    route: '/chat',
    target: 'chat-tabs',
    title: 'Friends and Groups',
    body: 'Friends are people whose chat request was accepted. Groups let several friends talk together. A red dot marks unread messages.',
  },
  {
    id: 'new-group',
    route: '/chat',
    target: 'new-group',
    enterClick: 'chat-tab-groups',
    title: 'Create a group',
    body: 'Press "+ New group", choose a name and a picture, and tick the friends to add. You become the group Admin.',
  },
  {
    id: 'group-roles',
    route: '/chat',
    title: 'Group roles',
    body:
      'Click a group\'s name at the top of its chat to see everyone in it.\n' +
      '- Admin (the creator): adds people, makes moderators, removes anyone\n' +
      '- Mod: can remove regular members\n' +
      '- Everyone can leave at any time',
  },
  {
    id: 'done',
    route: '/chat',
    title: "You're all set!",
    body: 'That is everything. Press the ? button at the top of the ocean any time to see this tour again. Enjoy Wavelength!',
  },
];
