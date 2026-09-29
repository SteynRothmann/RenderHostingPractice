import { io, type Socket } from 'socket.io-client';
import { API_URL, getStoredToken } from './api';

// One shared Socket.IO connection for the whole app, reused across
// components/re-renders rather than opened per-mount. The backend
// broadcasts an 'oceanUpdate' event (an array of OceanGroup) to every
// connected socket once per poll cycle - see backend/lib/spotifyPoller.js.
// This is intentionally public: guests (not logged in) still see the
// ocean, same as the backend's own /ocean test page.
//
// Private/group chat events (see ChatContext.tsx) need this connection to
// carry the same bearer-token identity used for REST calls, so it's sent
// as Socket.IO connection auth (`auth: { token }`) rather than a cookie -
// same reasoning as api.ts: frontend/backend live on different
// *.onrender.com subdomains, so a cookie here would be a blocked
// third-party cookie.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { withCredentials: true, auth: { token: getStoredToken() } });
  }
  return socket;
}

// Call this after login completes or logout finishes, so the socket's
// authenticated identity actually updates instead of staying stale (a
// stale socket auth would keep the private/group chat channels working -
// or not working - as whichever account was logged in when the socket
// first connected, regardless of who's actually logged in now).
export function reauthSocket(): void {
  if (!socket) return;
  socket.auth = { token: getStoredToken() };
  socket.disconnect();
  socket.connect();
}
