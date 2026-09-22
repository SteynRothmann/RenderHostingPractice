require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const authRouter = require('./routes/auth');
const spotifyRouter = require('./routes/spotify');
const { useMemoryStore } = require('./db/tokenStore');

const app = express();
app.use(cookieParser());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (useMemoryStore) {
    console.warn(
      'DATABASE_URL not set - using in-memory token storage (fine for local testing, tokens reset on restart).'
    );
  }
});
