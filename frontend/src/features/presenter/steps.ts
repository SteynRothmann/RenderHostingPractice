// The presenter-mode script: one entry per "point of interest", in the order
// of the video script. Each step says how to FIND its element on the page
// (so the spotlight can follow it), where it lives (route), and optionally how
// to get the page into the right state (ensure) when auto-setup is on.
//
// Auto-setup only ever navigates and opens or closes panels. It never clicks
// anything that changes data (Join, Request Chat, Accept, Save, Log in).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Target = HTMLElement | Rect | null | undefined | Array<HTMLElement | null | undefined>;

export interface Ctx {
  navigate: (path: string) => void;
}

export interface Step {
  id: string;
  title: string;
  /** The line from the video script, shown only when the script pill (T) is on. */
  say: string;
  route?: string;
  /** Skipped silently when its element is not on the page (e.g. logged-out steps). */
  optional?: boolean;
  /** Shown as a small "waiting" pill when a required element is missing. */
  hint?: string;
  pad?: number;
  /** false = just a glowing outline, no dimming of the rest of the screen. */
  dim?: boolean;
  find: () => Target;
  ensure?: (ctx: Ctx) => Promise<void>;
}

/* ---------- small DOM helpers ---------- */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor<T>(fn: () => T | null | undefined | false, ms = 3000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v as T;
    await sleep(80);
  }
  return null;
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

function q<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  for (const el of root.querySelectorAll<T>(sel)) if (visible(el)) return el;
  return null;
}

function byText<T extends HTMLElement = HTMLElement>(sel: string, re: RegExp, root: ParentNode = document): T | null {
  for (const el of root.querySelectorAll<T>(sel)) {
    if (visible(el) && re.test((el.textContent || '').trim())) return el;
  }
  return null;
}

async function goTo(ctx: Ctx, path: string) {
  if (window.location.pathname === path) return;
  ctx.navigate(path);
  await waitFor(() => window.location.pathname === path, 2500);
  await sleep(450);
}

/* ---------- page state helpers (open and close panels) ---------- */

const listenBtn = () => byText('button', /Listen on Spotify|Already listening|Starting/);
const searchInput = () => q<HTMLInputElement>('input[aria-label="Search or filter"]');
const challengeDialog = () => q('[role="dialog"][aria-label="Weekly Challenge"]');
const pickerDialog = () => q('[role="dialog"][aria-label="Profile border"]');
const changeBorderBtn = () => byText('button', /Change border|^Borders$/);

/** Close any song panel, challenge panel or challenge sub-panel that is open. */
async function closeOverlays() {
  for (let i = 0; i < 4; i++) {
    const sub = q(
      '[role="dialog"]:not([aria-labelledby="guest-welcome-title"]):not([aria-label="Weekly Challenge"]) button[aria-label="Close"]'
    );
    const panel = q('button[aria-label="Close panel"]');
    const song = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="Close"]')).find(
      (b) => visible(b) && !b.closest('[role="dialog"]')
    );
    const closer = sub || panel || song;
    if (!closer) return;
    closer.click();
    await sleep(500);
  }
}

/** Open a song panel by picking the first result in the search list (no-op if one is already open). */
async function openSong(ctx: Ctx): Promise<boolean> {
  if (listenBtn()) return true;
  await goTo(ctx, '/');
  await closeOverlays();
  const input = searchInput();
  if (!input) return false;
  input.focus();
  const wrapper = input.closest('div.relative');
  const row = await waitFor(() => {
    const rows = wrapper?.querySelectorAll<HTMLElement>(':scope > div.absolute button');
    return rows && rows.length ? rows[0] : null;
  }, 3500);
  if (!row) {
    input.blur();
    return false;
  }
  row.click();
  input.blur();
  return !!(await waitFor(listenBtn, 3000));
}

async function openChallenge(ctx: Ctx): Promise<boolean> {
  if (challengeDialog()) {
    // Make sure a sub-panel from a later step is not covering it.
    if (pickerDialog()) await closeOverlays();
    return true;
  }
  await goTo(ctx, '/');
  await closeOverlays();
  const btn = q('button[aria-label="Weekly Challenge"]');
  if (!btn) return false;
  btn.click();
  return !!(await waitFor(challengeDialog, 4000));
}

/* ---------- targets ---------- */

function oceanRegion(): Rect {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return { x: 10, y: 64, w: W - 20, h: H - 76 };
}

const welcomeCard = () => q('[role="dialog"][aria-labelledby="guest-welcome-title"]');
const inWelcome = (re: RegExp) => {
  const card = welcomeCard();
  return card ? byText<HTMLElement>('button', re, card) : null;
};

function searchTarget(): Target {
  const input = searchInput();
  if (!input) return null;
  const pill = input.parentElement as HTMLElement | null;
  const dropdown = input.closest('div.relative')?.querySelector<HTMLElement>(':scope > div.absolute');
  return [pill, dropdown && visible(dropdown) ? dropdown : null];
}

const section = (re: RegExp, tag: string) => byText(tag, re)?.closest<HTMLElement>('section') ?? null;
const heading = (re: RegExp) => byText('h3', re)?.parentElement ?? null;

/* ---------- the script ---------- */

export const STEPS: Step[] = [
  // 0:00 Logged-out welcome (skipped automatically when already logged in)
  {
    id: 'welcome',
    title: 'Welcome message',
    say: 'Hi, and welcome to Wavelength. Wavelength turns music into a living ocean. Every square you see is a song someone is listening to on Spotify right now.',
    route: '/',
    optional: true,
    find: welcomeCard,
  },
  {
    id: 'look-around',
    title: 'Just look around',
    say: 'While logged out, you can look around and watch as the songs float by,',
    optional: true,
    find: () => inWelcome(/Just look around/),
  },
  {
    id: 'login',
    title: 'Log in with Spotify',
    say: "but to open songs, chat and join challenges, you'll have to log in with Spotify.",
    optional: true,
    find: () => inWelcome(/Log in with Spotify/),
  },

  // 0:25 The ocean
  {
    id: 'ocean',
    title: 'The ocean',
    say: 'After logging in, you are greeted with the main wave page. Hover over a square to see the song and artist. The green number on the square shows how many people are listening to it together. The glowing ring around this square is my own song, playing right now.',
    route: '/',
    pad: 0,
    dim: false,
    ensure: closeOverlays,
    find: oceanRegion,
  },
  // 0:45 Dark mode
  {
    id: 'theme',
    title: 'Light and dark mode',
    say: 'If you prefer it dark, there is a dark mode. This switch in the top bar flips between day and night, and Wavelength remembers your choice.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: () => q('[role="switch"]'),
  },
  // 0:55 Search
  {
    id: 'search',
    title: 'Search',
    say: 'Here I can search for a song, an artist or a genre, and the squares that do not match fade away. Clicking a song in the search bar or on a square floating by opens that song.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: searchTarget,
  },

  // 1:15 Song panel
  {
    id: 'listen',
    title: 'Listen on Spotify',
    say: 'Listen on Spotify plays the song on your device where the host is at that moment.',
    route: '/',
    hint: 'Open a song',
    ensure: async (ctx) => {
      await openSong(ctx);
    },
    find: () => listenBtn(),
  },
  {
    id: 'save',
    title: 'Save',
    say: 'Save adds it to your Liked Songs.',
    hint: 'Open a song',
    find: () => q('button[aria-label="Save to Playlist"], button[aria-label="Saved to Liked Songs"]'),
  },
  {
    id: 'follow',
    title: 'Follow Along',
    say: 'Follow Along keeps you with the host, even when they skip. Listening and following need Spotify Premium.',
    hint: 'Open a song',
    find: () => byText('button', /Follow Along/),
  },

  // 1:40 Weekly challenge
  {
    id: 'challenge-button',
    title: 'Ride the Wave',
    say: 'Every week there is a new weekly challenge with a theme.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: () => q('button[aria-label="Weekly Challenge"]'),
  },
  {
    id: 'challenge-theme',
    title: 'Theme and countdown',
    say: 'You join with a song that fits,',
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () => section(/^Weekly Theme$/, 'p') ?? byText('p', /^Weekly Theme$/)?.parentElement ?? null,
  },
  {
    id: 'challenge-entries',
    title: 'Entries',
    say: "and everyone's entries show up here.",
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () => section(/^Challenge entries$/, 'h3'),
  },
  {
    id: 'challenge-join',
    title: 'Join',
    say: 'I have already joined this week, so I will not be able to enter again, but it is as simple as pressing Join, picking a song and confirming. After that, your submitted song will start playing in the ocean.',
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () =>
      byText('button', /Join this challenge/) ??
      byText<HTMLElement>('span', /Joined/)?.closest<HTMLElement>('div.inline-flex') ??
      null,
  },
  {
    id: 'reward',
    title: 'Limited-time border',
    say: "Joining a challenge wins you that week's limited-time border.",
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: () => q('button[title="Preview this border"]'),
  },
  {
    id: 'change-border',
    title: 'Change border',
    say: 'I have collected them all, so I can switch between them.',
    hint: 'Open the Ride the Wave panel',
    ensure: async (ctx) => {
      await openChallenge(ctx);
    },
    find: changeBorderBtn,
  },
  {
    id: 'border-picker',
    title: 'Pick a border',
    say: 'Whichever I pick shows around my picture and my song, even in chats.',
    hint: 'Click Change border',
    ensure: async (ctx) => {
      await openChallenge(ctx);
      if (!pickerDialog()) {
        changeBorderBtn()?.click();
        await waitFor(pickerDialog, 2500);
      }
    },
    find: pickerDialog,
  },

  // 2:25 Profile
  {
    id: 'profile-icon',
    title: 'Your picture',
    say: 'Your picture opens your profile.',
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in to see your profile',
    find: () => q('a[aria-label="Your profile"]'),
  },
  {
    id: 'profile-fields',
    title: 'Nickname and bio',
    say: 'Here you can set a nickname and a bio.',
    route: '/profile',
    hint: 'Log in to see your profile',
    find: () => byText('label', /^Nickname$/)?.closest<HTMLElement>('div.space-y-4') ?? null,
  },
  {
    id: 'profile-genres',
    title: 'Top genres',
    say: 'Below that you can see your top genres',
    hint: 'Open your profile',
    find: () => heading(/^Top genres$/),
  },
  {
    id: 'profile-recent',
    title: 'Recently played',
    say: 'and what you played recently,',
    hint: 'Open your profile',
    find: () => heading(/^Recently played$/),
  },
  {
    id: 'profile-playlists',
    title: 'Public playlists',
    say: 'as well as your public playlists, pulled straight from Spotify.',
    hint: 'Open your profile',
    find: () => heading(/^Public playlists$/),
  },
  {
    id: 'profile-save',
    title: 'Save changes',
    say: 'Just remember to click Save changes.',
    hint: 'Open your profile',
    find: () => byText('button', /^(Save changes|Saving…)$/),
  },

  // 2:40 Meeting people and chat
  {
    id: 'host-card',
    title: 'The host',
    say: 'To start chatting with someone, open their song and press on their profile',
    route: '/',
    hint: 'Open a song',
    ensure: async (ctx) => {
      await openSong(ctx);
    },
    find: () => q('a[href^="/hosts/"]'),
  },
  {
    id: 'request-chat',
    title: 'Request Chat',
    say: 'and press Request Chat.',
    hint: "Open a host's profile",
    ensure: async (ctx) => {
      if (window.location.pathname.startsWith('/hosts/')) return;
      if (await openSong(ctx)) {
        q('a[href^="/hosts/"]')?.click();
        await waitFor(() => window.location.pathname.startsWith('/hosts/'), 2500);
        await sleep(600);
      }
    },
    find: () => byText('button', /^(Request Chat|Already friends|Request sent|Sending…)$/),
  },
  {
    id: 'bell',
    title: 'Notifications',
    say: "They'll get a notification under the bell icon,",
    route: '/',
    ensure: closeOverlays,
    hint: 'Log in or open the ocean page',
    find: () => q('button[aria-label="Notifications"]'),
  },
  {
    id: 'chat-icon',
    title: 'Chat',
    say: 'and when they accept you can message each other,',
    route: '/',
    hint: 'Log in or open the ocean page',
    find: () => q('button[aria-label="Chat"]'),
  },
  {
    id: 'chat-friends',
    title: 'Friends',
    say: 'in one to one chats,',
    route: '/chat',
    hint: 'Open the Chat page',
    ensure: async () => {
      byText('nav button', /friends/i)?.click();
      await sleep(250);
    },
    find: () => q('aside'),
  },
  {
    id: 'chat-groups',
    title: 'Groups',
    say: 'or start a group with your friends.',
    route: '/chat',
    hint: 'Open the Chat page',
    ensure: async () => {
      byText('nav button', /groups/i)?.click();
      await sleep(350);
    },
    find: () => byText('button', /New group/) ?? byText('nav button', /groups/i),
  },

  // 3:10 Outro
  {
    id: 'outro',
    title: 'The end',
    say: 'That is Wavelength. Log in with Spotify and make some waves.',
    route: '/',
    ensure: closeOverlays,
    find: () => null,
  },
];
