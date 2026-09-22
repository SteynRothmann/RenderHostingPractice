require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const authRouter = require('./routes/auth');
const spotifyRouter = require('./routes/spotify');
const { useMemoryStore } = require('./db/tokenStore');
const { startOceanPoller } = require('./lib/spotifyPoller');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(cookieParser());
app.use(express.json()); // needed for POST /spotify/join's JSON body

// Gives each browser its own private session (a 'connect.sid' cookie).
// req.sessionID is then used as the key for storing that person's
// Spotify tokens, so multiple people can log in independently without
// overwriting each other.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: true, // create a session on first visit, before login
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

app.use('/auth', authRouter);
app.use('/spotify', spotifyRouter);

app.get('/', (req, res) => {
  res.send('WaveLength backend is running.');
});

// Test dashboard: polls /spotify/currently-playing and displays the
// album art, track name, artist, and a seek/progress bar. This exists
// purely so backend features can be tested before the real frontend
// is ready - it's not meant to be the final UI.
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WaveLength - Test Dashboard</title>
        <style>
          body {
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0a0a0a;
            color: #fff;
            gap: 16px;
          }
          h1 { font-size: 1.1rem; opacity: 0.6; font-weight: normal; }
          #albumArt {
            width: 240px;
            height: 240px;
            background: #222;
            border-radius: 8px;
            object-fit: cover;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #555;
            font-size: 0.9rem;
          }
          #track { font-size: 1.4rem; font-weight: bold; margin: 0; }
          #artist { font-size: 1rem; opacity: 0.7; margin: 0; }
          #progressWrap {
            width: 280px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.75rem;
            opacity: 0.7;
          }
          #progressBarBg {
            flex: 1;
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
          }
          #progressBarFill {
            height: 100%;
            width: 0%;
            background: #1db954;
            transition: width 0.5s linear;
          }
          #status { font-size: 0.8rem; opacity: 0.5; margin-top: 20px; }
          #controls {
            display: flex;
            gap: 12px;
            margin-top: 8px;
          }
          #controls button {
            background: #1db954;
            border: none;
            color: #fff;
            font-size: 1.2rem;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
          }
          #controls button:hover { background: #1ed760; }
          #controls button:disabled {
            background: #333;
            cursor: not-allowed;
          }
          #controlError {
            font-size: 0.8rem;
            color: #ff6b6b;
            min-height: 1em;
          }
        </style>
      </head>
      <body>
        <h1>WaveLength - Test Dashboard</h1>

        <img id="albumArt" src="" alt="Album art" />
        <p id="track">Loading...</p>
        <p id="artist"></p>

        <div id="progressWrap">
          <span id="currentTime">0:00</span>
          <div id="progressBarBg"><div id="progressBarFill"></div></div>
          <span id="totalTime">0:00</span>
        </div>

        <div id="controls">
          <button id="prevBtn" title="Previous">⏮</button>
          <button id="playPauseBtn" title="Play/Pause">⏯</button>
          <button id="nextBtn" title="Next">⏭</button>
        </div>
        <p id="controlError"></p>

        <p id="status">Waiting for data...</p>

        <script>
          function formatMs(ms) {
            if (!ms && ms !== 0) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return minutes + ':' + String(seconds).padStart(2, '0');
          }

          let isCurrentlyPlaying = false; // tracks state so the play/pause button knows which action to send

          async function refresh() {
            const statusEl = document.getElementById('status');
            try {
              const res = await fetch('/spotify/currently-playing');
              const data = await res.json();

              // Only treat it as "nothing to show" when there's no track
              // info at all (no active session) - a paused track still
              // has a track name/artist/art, it's just not playing.
              if (!data.track) {
                document.getElementById('track').textContent = 'Nothing playing';
                document.getElementById('artist').textContent = '';
                document.getElementById('albumArt').src = '';
                document.getElementById('progressBarFill').style.width = '0%';
                statusEl.textContent = 'No active playback detected';
                isCurrentlyPlaying = false;
                return;
              }

              isCurrentlyPlaying = data.playing;

              document.getElementById('track').textContent = data.track || 'Unknown track';
              document.getElementById('artist').textContent = data.artist || 'Unknown artist';
              document.getElementById('albumArt').src = data.albumArt || '';

              const pct = data.durationMs
                ? Math.min(100, (data.progressMs / data.durationMs) * 100)
                : 0;
              document.getElementById('progressBarFill').style.width = pct + '%';
              document.getElementById('currentTime').textContent = formatMs(data.progressMs);
              document.getElementById('totalTime').textContent = formatMs(data.durationMs);

              statusEl.textContent = (data.playing ? 'Playing' : 'Paused') + ' - Last updated: ' + new Date().toLocaleTimeString();
            } catch (err) {
              statusEl.textContent = 'Error fetching data - check console/server logs';
              console.error(err);
            }
          }

          // Sends a playback control request, shows any error, then
          // refreshes the display shortly after (Spotify takes a moment
          // to reflect the change).
          async function sendControl(method, path) {
            const errorEl = document.getElementById('controlError');
            errorEl.textContent = '';
            try {
              const res = await fetch(path, { method });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                errorEl.textContent = body.error || ('Request failed (' + res.status + ')');
                return;
              }
              setTimeout(refresh, 500); // give Spotify a moment before re-checking state
            } catch (err) {
              errorEl.textContent = 'Network error sending command';
              console.error(err);
            }
          }

          document.getElementById('playPauseBtn').addEventListener('click', () => {
            sendControl('PUT', isCurrentlyPlaying ? '/spotify/pause' : '/spotify/play');
          });
          document.getElementById('nextBtn').addEventListener('click', () => {
            sendControl('POST', '/spotify/next');
          });
          document.getElementById('prevBtn').addEventListener('click', () => {
            sendControl('POST', '/spotify/previous');
          });

          refresh();
          setInterval(refresh, 2000); // poll every 2 seconds
        </script>
      </body>
    </html>
  `);
});

// The Ocean page: WaveLength's only page. Shows one floating bubble per
// song currently being listened to across all logged-in users (grouped,
// not one per person). Real-time updates arrive over Socket.IO from the
// background poller in lib/spotifyPoller.js. Clicking a bubble pauses its
// own drifting animation and opens a panel to join that song on your own
// Spotify, starting near its live position. The page structure/flow
// (waves, drifting motion, pause-on-click, sinking animation, centered
// song panel) mirrors the "Simple CSS Waves" mockup - only the floating
// icon itself uses our round bubble style instead of the mockup's
// rounded-square covers.
app.get('/ocean', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>WaveLength Ocean</title>
        <style>
          @import url(//fonts.googleapis.com/css?family=Lato:300,400);
          * { box-sizing: border-box; }
          body {
            margin: 0;
            overflow-x: hidden;
            font-family: 'Lato', sans-serif;
          }
          h1 {
            font-weight: 300;
            letter-spacing: 2px;
            font-size: 40px;
            margin: 0;
          }
          .header {
            position: relative;
            text-align: center;
            background: linear-gradient(60deg, rgba(84,58,183,1) 0%, rgba(0,172,193,1) 100%);
            color: #fff;
            height: 100vh;
            overflow: hidden;
          }
          .logo {
            width: 44px;
            fill: #fff;
            margin-right: 14px;
            vertical-align: middle;
          }
          .inner-header {
            height: 65vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .title-row {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .waves {
            position: relative;
            width: 100%;
            height: 15vh;
            margin-bottom: -7px;
            min-height: 100px;
            max-height: 150px;
          }
          .parallax > use {
            animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite;
          }
          .parallax > use:nth-child(1) { animation-delay: -2s; animation-duration: 7s; }
          .parallax > use:nth-child(2) { animation-delay: -3s; animation-duration: 10s; }
          .parallax > use:nth-child(3) { animation-delay: -4s; animation-duration: 13s; }
          .parallax > use:nth-child(4) { animation-delay: -5s; animation-duration: 20s; }
          @keyframes move-forever {
            0% { transform: translate3d(-90px,0,0); }
            100% { transform: translate3d(85px,0,0); }
          }

          /* Floating song bubbles */
          .ocean-floaters {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            height: 34%;
            min-height: 140px;
            overflow-x: hidden;
            overflow-y: visible;
            pointer-events: none;
            z-index: 6;
          }
          .floater {
            position: absolute;
            left: 0;
            width: 72px;
            height: 72px;
            padding: 0;
            border: none;
            background: transparent;
            cursor: pointer;
            pointer-events: auto;
            animation-name: float-ocean;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }
          /* Our round bubble style, in place of the mockup's rounded-square covers */
          .floater img, .floater .generated-cover {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35);
            box-shadow: 0 0 18px rgba(80,180,255,0.4), 0 6px 16px rgba(0,0,0,0.35);
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          }
          .floater:hover img, .floater:hover .generated-cover {
            transform: scale(1.08);
            box-shadow: 0 0 24px rgba(80,180,255,0.55), 0 6px 18px rgba(0,0,0,0.4);
          }
          .floater.active img, .floater.active .generated-cover {
            border-color: #00e5ff;
            box-shadow: 0 0 0 4px rgba(0,229,255,0.25), 0 0 22px rgba(0,229,255,0.55);
          }
          .floater.paused-state img, .floater.paused-state .generated-cover {
            filter: grayscale(45%) brightness(0.75);
          }
          .floater.sinking { pointer-events: none; animation-play-state: paused; }
          .floater.sinking img, .floater.sinking .generated-cover {
            transition: transform 5s cubic-bezier(0.55,0,1,0.45), opacity 5s ease-in, filter 5s ease-in;
            transform: translateY(100vh) scale(0.7);
            opacity: 0;
            filter: grayscale(1) brightness(0.7);
          }
          .generated-cover {
            display: flex; align-items: center; justify-content: center;
            color: rgba(255,255,255,0.9);
            font-weight: 300;
            font-size: 26px;
            background: #123;
          }
          .listener-badge {
            position: absolute;
            bottom: -2px; right: -2px;
            background: #1db954;
            color: #fff;
            font-size: 11px;
            font-weight: bold;
            min-width: 20px; height: 20px;
            border-radius: 10px;
            display: none;
            align-items: center; justify-content: center;
            padding: 0 5px;
            border: 2px solid #543ab7;
          }

          /* Drifts left to right while bobbing up and down like it's
             riding the swell, wrapping from off-screen right back to
             off-screen left (matches the mockup's motion exactly) */
          @keyframes float-ocean {
            0%   { transform: translate(-15vw, 0) rotate(-2deg); }
            9%   { transform: translate(-2vw, -16px) rotate(1deg); }
            18%  { transform: translate(11vw, 12px) rotate(-2deg); }
            27%  { transform: translate(24vw, -18px) rotate(2deg); }
            36%  { transform: translate(37vw, 14px) rotate(-1deg); }
            45%  { transform: translate(50vw, -12px) rotate(1deg); }
            55%  { transform: translate(64vw, 17px) rotate(-2deg); }
            64%  { transform: translate(77vw, -15px) rotate(2deg); }
            73%  { transform: translate(90vw, 10px) rotate(-1deg); }
            82%  { transform: translate(103vw, -17px) rotate(1deg); }
            100% { transform: translate(115vw, 0) rotate(-2deg); }
          }

          #emptyMessage {
            position: absolute;
            top: 40%; left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.75;
            font-size: 14px;
            text-align: center;
            z-index: 5;
          }

          /* Song panel - centered modal, matching the mockup's design */
          .song-panel-backdrop {
            position: fixed; inset: 0;
            background: rgba(10,10,15,0.55);
            z-index: 240;
            display: none;
          }
          .song-panel-backdrop.open { display: block; }
          .song-panel {
            position: fixed;
            top: 50%; left: 50%;
            width: min(92vw, 380px);
            background: #14141a;
            border-radius: 20px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.5);
            z-index: 250;
            padding: 20px;
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0.95);
            transition: opacity 0.25s ease, transform 0.25s ease;
            color: #fff;
          }
          .song-panel.open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
          .song-panel-close {
            position: absolute; top: 14px; right: 14px;
            width: 28px; height: 28px; border-radius: 50%;
            border: none; background: rgba(255,255,255,0.1); color: #fff;
            font-size: 16px; cursor: pointer;
          }
          .song-panel-art { width: 100%; aspect-ratio: 1/1; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .song-panel-art img, .song-panel-art .generated-cover { width: 100%; height: 100%; }
          .song-panel-art .generated-cover { font-size: 72px; border-radius: 16px; }
          .song-panel-progress { margin-top: 16px; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.15); overflow: hidden; }
          .song-panel-progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, rgba(84,58,183,1) 0%, rgba(0,172,193,1) 100%); transition: width 0.6s linear; }
          .song-panel-times { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px; }
          .song-panel-transport { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 12px; }
          /* Read-only playback indicator - NOT a control. Only Spotify
             itself can pause/play/skip, per the "no on-site controls"
             requirement - this button is disabled and just reflects state. */
          .song-panel-playpause {
            width: 52px; height: 52px; border-radius: 50%;
            border: none; background: #444; display: flex;
            align-items: center; justify-content: center;
            cursor: default;
          }
          .song-panel-playpause svg { width: 22px; height: 22px; fill: #ccc; }
          .song-panel-status-label { font-size: 12px; color: rgba(255,255,255,0.55); }
          .song-panel-title { margin-top: 18px; font-weight: 400; font-size: 20px; letter-spacing: 0.5px; text-align: center; }
          .song-panel-artist { font-size: 13px; color: rgba(255,255,255,0.55); text-align: center; margin-top: 2px; }
          .song-panel-listeners { display: block; text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; }
          .song-panel-actions { display: flex; justify-content: center; margin-top: 18px; }
          #joinBtn {
            font-size: 13px; letter-spacing: 0.3px; color: #fff;
            background: #1db954; border: none; border-radius: 18px;
            padding: 10px 24px; cursor: pointer; font-weight: bold;
          }
          #joinBtn:disabled { background: #333; color: #888; cursor: not-allowed; }
          #joinError { color: #ff8080; font-size: 12px; text-align: center; min-height: 1em; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="inner-header">
            <div class="title-row">
              <svg class="logo" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                <path fill="#fff" d="M250.4,0.8C112.7,0.8,1,112.4,1,250.2c0,137.7,111.7,249.4,249.4,249.4c137.7,0,249.4-111.7,249.4-249.4C499.8,112.4,388.1,0.8,250.4,0.8z M383.8,326.3c-62,0-101.4-14.1-117.6-46.3c-17.1-34.1-2.3-75.4,13.2-104.1c-22.4,3-38.4,9.2-47.8,18.3c-11.2,10.9-13.6,26.7-16.3,45c-3.1,20.8-6.6,44.4-25.3,62.4c-19.8,19.1-51.6,26.9-100.2,24.6l1.8-39.7c35.9,1.6,59.7-2.9,70.8-13.6c8.9-8.6,11.1-22.9,13.5-39.6c6.3-42,14.8-99.4,141.4-99.4h41L333,166c-12.6,16-45.4,68.2-31.2,96.2c9.2,18.3,41.5,25.6,91.2,24.2l1.1,39.8C390.5,326.2,387.1,326.3,383.8,326.3z" />
              </svg>
              <h1>WaveLength</h1>
            </div>
          </div>

          <svg class="waves" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
            viewBox="0 24 150 28" preserveAspectRatio="none" shape-rendering="auto">
            <defs>
              <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
            </defs>
            <g class="parallax">
              <use xlink:href="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7)" />
              <use xlink:href="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />
              <use xlink:href="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />
              <use xlink:href="#gentle-wave" x="48" y="7" fill="#fff" />
            </g>
          </svg>

          <div class="ocean-floaters" id="oceanFloaters"></div>
          <p id="emptyMessage">No one's listening yet - play something on Spotify to start a wave.</p>
        </div>

        <div class="song-panel-backdrop" id="songBackdrop"></div>
        <div class="song-panel" id="songPanel" role="dialog" aria-modal="true" aria-hidden="true">
          <button class="song-panel-close" id="songPanelClose" type="button" aria-label="Close">&times;</button>
          <div class="song-panel-art" id="songPanelArtWrap"></div>
          <div class="song-panel-progress"><div class="song-panel-progress-fill" id="songPanelProgressFill"></div></div>
          <div class="song-panel-times"><span id="songPanelCurrentTime">0:00</span><span id="songPanelDuration">0:00</span></div>
          <div class="song-panel-transport">
            <button class="song-panel-playpause" id="songPanelPlayPause" type="button" aria-label="Playback status" disabled>
              <svg id="songIconPlay" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <svg id="songIconPause" viewBox="0 0 24 24" hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
            </button>
            <span class="song-panel-status-label" id="songPanelStatusLabel">Playing</span>
          </div>
          <div class="song-panel-title" id="songPanelTitle"></div>
          <div class="song-panel-artist" id="songPanelArtist"></div>
          <span class="song-panel-listeners" id="songPanelListeners"></span>
          <div class="song-panel-actions">
            <button id="joinBtn" type="button">Join on Spotify</button>
          </div>
          <p id="joinError"></p>
        </div>

        <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
        <script>
          (function () {
            var socket = io();
            var floatersEl = document.getElementById('oceanFloaters');
            var emptyMessage = document.getElementById('emptyMessage');

            var floaterEls = {};   // trackId -> element
            var groupData = {};    // trackId -> latest group data
            var activeFloaterEl = null;
            var openTrackId = null;
            var myTrackId = null;  // whatever track I'm personally listening to right now (playing OR paused)
            var floaterCreateCount = 0;

            var floaterDurations = ['34s', '42s', '38s', '30s', '46s'];
            var floaterDelays = ['-2s', '-18s', '-30s', '-8s', '-22s'];
            var floaterBottoms = ['20%', '6%', '30%', '14%', '24%'];

            function coverHTML(group) {
              if (group.albumArt) return '<img src="' + group.albumArt + '" alt="' + group.trackName + ' cover art">';
              var initial = (group.trackName || '?').trim().charAt(0).toUpperCase() || '\u266a';
              return '<div class="generated-cover">' + initial + '</div>';
            }

            function formatMs(ms) {
              if (!ms && ms !== 0) return '0:00';
              var totalSeconds = Math.floor(ms / 1000);
              var m = Math.floor(totalSeconds / 60);
              var s = totalSeconds % 60;
              return m + ':' + (s < 10 ? '0' + s : s);
            }

            function renderFloater(group) {
              var el = floaterEls[group.trackId];

              if (!el) {
                el = document.createElement('button');
                el.type = 'button';
                el.className = 'floater';
                var i = floaterCreateCount++;
                el.style.animationDuration = floaterDurations[i % floaterDurations.length];
                el.style.animationDelay = floaterDelays[i % floaterDelays.length];
                el.style.bottom = floaterBottoms[i % floaterBottoms.length];
                el.setAttribute('aria-label', 'Open ' + group.trackName + ' by ' + group.artist);
                el.innerHTML = coverHTML(group) + '<span class="listener-badge"></span>';
                el.addEventListener('click', function () { openSongPanel(group.trackId); });
                floatersEl.appendChild(el);
                floaterEls[group.trackId] = el;
              }

              el.classList.toggle('paused-state', !group.isPlaying);
              var badge = el.querySelector('.listener-badge');
              badge.textContent = group.listenerCount;
              badge.style.display = group.listenerCount > 1 ? 'flex' : 'none';

              emptyMessage.style.display = 'none';
            }

            function sinkFloater(trackId) {
              var el = floaterEls[trackId];
              if (!el) return;
              el.classList.add('sinking');
              window.setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
                delete floaterEls[trackId];
              }, 5000);
              if (activeFloaterEl === el) activeFloaterEl = null;
              if (openTrackId === trackId) closeSongPanel();
            }

            function openSongPanel(trackId) {
              var group = groupData[trackId];
              if (!group) return;

              // Only one floater bobs at rest (paused float animation) at
              // a time - clicking a bubble pauses ITS drifting motion,
              // not Spotify playback.
              if (activeFloaterEl) activeFloaterEl.classList.remove('active');
              var floaterEl = floaterEls[trackId];
              if (floaterEl) {
                floaterEl.classList.add('active');
                activeFloaterEl = floaterEl;
              }

              openTrackId = trackId;
              document.getElementById('songPanelArtWrap').innerHTML = coverHTML(group);
              document.getElementById('songPanelTitle').textContent = group.trackName;
              document.getElementById('songPanelArtist').textContent = group.artist;
              document.getElementById('songPanelListeners').textContent =
                group.listenerCount + (group.listenerCount === 1 ? ' listener' : ' listeners');

              updatePanelPlaybackState(group);
              document.getElementById('joinError').textContent = '';
              updateJoinButton();

              document.getElementById('songPanel').classList.add('open');
              document.getElementById('songPanel').setAttribute('aria-hidden', 'false');
              document.getElementById('songBackdrop').classList.add('open');
            }

            function updatePanelPlaybackState(group) {
              document.getElementById('songIconPlay').hidden = group.isPlaying;
              document.getElementById('songIconPause').hidden = !group.isPlaying;
              document.getElementById('songPanelStatusLabel').textContent = group.isPlaying ? 'Playing' : 'Paused';
              var pct = group.durationMs ? Math.min(100, (group.progressMs / group.durationMs) * 100) : 0;
              document.getElementById('songPanelProgressFill').style.width = pct + '%';
              document.getElementById('songPanelCurrentTime').textContent = formatMs(group.progressMs);
              document.getElementById('songPanelDuration').textContent = formatMs(group.durationMs);
            }

            function closeSongPanel() {
              document.getElementById('songPanel').classList.remove('open');
              document.getElementById('songPanel').setAttribute('aria-hidden', 'true');
              document.getElementById('songBackdrop').classList.remove('open');
              if (activeFloaterEl) {
                activeFloaterEl.classList.remove('active');
                activeFloaterEl = null;
              }
              openTrackId = null;
            }

            function updateJoinButton() {
              var btn = document.getElementById('joinBtn');
              // Fixed bug: this compares against myTrackId regardless of
              // whether I'm playing or paused, so a paused host can't
              // accidentally "join" (and thereby disrupt) their own track.
              if (openTrackId && myTrackId === openTrackId) {
                btn.textContent = 'Already listening';
                btn.disabled = true;
              } else {
                btn.textContent = 'Join on Spotify';
                btn.disabled = false;
              }
            }

            document.getElementById('songPanelClose').addEventListener('click', closeSongPanel);
            document.getElementById('songBackdrop').addEventListener('click', closeSongPanel);

            document.getElementById('joinBtn').addEventListener('click', function () {
              var group = groupData[openTrackId];
              if (!group) return;
              var errorEl = document.getElementById('joinError');
              errorEl.textContent = '';

              fetch('/spotify/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackUri: group.trackUri, trackId: group.trackId })
              })
                .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
                .then(function (result) {
                  if (!result.res.ok) {
                    errorEl.textContent = result.body.error || 'Could not join';
                    return;
                  }
                  myTrackId = group.trackId;
                  updateJoinButton();
                })
                .catch(function (err) {
                  errorEl.textContent = 'Network error joining song';
                  console.error(err);
                });
            });

            // Real-time ocean updates (every ~4s from the server's poller)
            socket.on('oceanUpdate', function (groups) {
              var newTrackIds = {};
              groups.forEach(function (g) { newTrackIds[g.trackId] = true; });

              Object.keys(floaterEls).forEach(function (trackId) {
                if (!newTrackIds[trackId]) sinkFloater(trackId);
              });

              groupData = {};
              groups.forEach(function (g) {
                groupData[g.trackId] = g;
                renderFloater(g);
              });

              if (groups.length === 0) emptyMessage.style.display = 'block';

              if (openTrackId && groupData[openTrackId]) {
                updatePanelPlaybackState(groupData[openTrackId]);
                document.getElementById('songPanelListeners').textContent =
                  groupData[openTrackId].listenerCount + (groupData[openTrackId].listenerCount === 1 ? ' listener' : ' listeners');
              }
            });

            // Poll MY OWN currently-playing separately, regardless of
            // playing/paused state - this is the fix for the join bug:
            // it makes sure "Join" greys out on my own track even while
            // I'm paused, instead of only while actively playing.
            function pollMyStatus() {
              fetch('/spotify/currently-playing')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                  myTrackId = data.trackId || null;
                  updateJoinButton();
                })
                .catch(function () { /* non-fatal */ });
            }
            pollMyStatus();
            setInterval(pollMyStatus, 4000);
          })();
        </script>
      </body>
    </html>
  `);
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (useMemoryStore) {
    console.warn(
      'DATABASE_URL not set - using in-memory token storage (fine for local testing, tokens reset on restart).'
    );
  }
  startOceanPoller(io);
  console.log('Ocean poller started - checking all logged-in users every 4s.');
});
