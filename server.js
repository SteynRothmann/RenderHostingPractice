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

app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>WaveLength</title>
        <style>
          body {
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #1d1e66;
            color: #fff;
          }
        </style>
      </head>
      <body>
        <h1>WaveLength coming soon</h1>
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
