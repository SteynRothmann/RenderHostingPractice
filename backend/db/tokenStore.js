// Stores Spotify tokens per user using a local JSON file (tokens.json)
// so tokens persist across server restarts without needing a DATABASE_URL.

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'tokens.json');

// Helper to read store from disk
function loadStore() {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading tokens.json:', err);
  }
  return {};
}

// Helper to write store to disk
function saveStore(store) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing tokens.json:', err);
  }
}

async function saveTokens(userId, tokenData) {
  const store = loadStore();
  const existing = store[userId] || {};
  
  const { accessToken, refreshToken, expiresAt, spotifyUserId, displayName, profileUrl, email, profileImage } = tokenData;

  // A refresh-only save doesn't include profile fields - merge so those aren't wiped
  store[userId] = {
    accessToken,
    refreshToken,
    expiresAt,
    spotifyUserId: spotifyUserId !== undefined ? spotifyUserId : existing.spotifyUserId,
    displayName: displayName !== undefined ? displayName : existing.displayName,
    profileUrl: profileUrl !== undefined ? profileUrl : existing.profileUrl,
    email: email !== undefined ? email : existing.email,
    profileImage: profileImage !== undefined ? profileImage : existing.profileImage,
  };

  saveStore(store);
}

async function getTokens(userId) {
  const store = loadStore();
  return store[userId] || null;
}

// Used by the background poller to know which sessions to check.
async function getAllUserIds() {
  const store = loadStore();
  return Object.keys(store);
}

// Looks up stored profile info by real Spotify account ID.
async function getTokensBySpotifyUserId(spotifyUserId) {
  const store = loadStore();
  for (const entry of Object.values(store)) {
    if (entry.spotifyUserId === spotifyUserId) return entry;
  }
  return null;
}

module.exports = { 
  saveTokens, 
  getTokens, 
  getTokensBySpotifyUserId, 
  getAllUserIds, 
  useMemoryStore: false 
};