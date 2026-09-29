import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { fetchAcceptedChats, fetchMyGroups, revokeChatRequest, createRealGroup, leaveRealGroup } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import type { ChatFriend, RealGroup, RealChatMessage } from './types';

// Real chat/group data layer, backed by the Express + Socket.IO backend
// (backend/routes/chatRequests.js's /accepted + /:id/revoke,
// backend/routes/groups.js, and the private:*/group:* socket events in
// backend/server.js). Deliberately separate from DataContext/mockData,
// which still back nickname/bio/floaterOrder/challenge - none of that is
// part of this data source.
//
// Threads are keyed the same way the (already-restyled) chat UI expects:
// a friend's thread id is their spotifyUserId, a group's thread id is its
// group id.

interface ChatContextValue {
  friends: ChatFriend[];
  groups: RealGroup[];
  loading: boolean;
  messagesFor: (threadId: string) => RealChatMessage[];
  sendMessage: (threadId: string, text: string) => void;
  unfriend: (spotifyUserId: string) => Promise<void>;
  createGroup: (name: string, icon: string | null, memberSpotifyUserIds: string[]) => Promise<string>;
  leaveGroup: (groupId: string) => Promise<void>;
  refresh: () => Promise<void>;
  // Unread tracking (client-side only, in-memory for the session - see
  // setActiveThread below for how a thread stops being "unread").
  unreadThreadIds: Set<string>;
  hasAnyUnread: boolean;
  setActiveThread: (threadId: string | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile } = useAuth();
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [groups, setGroups] = useState<RealGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Record<string, RealChatMessage[]>>({});
  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<string>>(new Set());

  // Keep latest friends/groups available inside socket callbacks/closures
  // without re-subscribing every render.
  const friendsRef = useRef(friends);
  friendsRef.current = friends;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const joinedPrivate = useRef<Set<string>>(new Set());
  const joinedGroups = useRef<Set<string>>(new Set());

  // Which thread (if any) ChatPage currently has open. A message for this
  // exact thread should never be marked unread - the user's already
  // looking at it. Set from ChatPage via setActiveThread whenever `active`
  // changes there (including clearing it on navigating away/back).
  const activeThreadRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  myUserIdRef.current = profile?.spotifyUserId ?? null;

  const setActiveThread = useCallback((threadId: string | null) => {
    activeThreadRef.current = threadId;
    if (!threadId) return;
    // Opening a thread marks it read immediately, regardless of whether it
    // had any unread messages.
    setUnreadThreadIds((prev) => {
      if (!prev.has(threadId)) return prev;
      const next = new Set(prev);
      next.delete(threadId);
      return next;
    });
  }, []);

  // Marks a thread unread unless it's my own message coming back over the
  // socket (private:send/group:send both echo the sender's own message
  // back - that's never "unread" for the sender) or the thread the user
  // currently has open.
  const markUnread = useCallback((threadId: string, fromUserId: string) => {
    if (fromUserId === myUserIdRef.current) return;
    if (activeThreadRef.current === threadId) return;
    setUnreadThreadIds((prev) => {
      if (prev.has(threadId)) return prev;
      const next = new Set(prev);
      next.add(threadId);
      return next;
    });
  }, []);

  const appendMessage = useCallback((threadId: string, message: RealChatMessage) => {
    setMessages((prev) => ({ ...prev, [threadId]: [...(prev[threadId] || []), message] }));
  }, []);

  // Fetches friends + groups and updates state - shared by the initial
  // load, the periodic poll below, and NotificationsPanel's "refresh right
  // after I accept a request" call. `showLoading` is only true for the
  // very first load, so background polls/refreshes don't flash a loading
  // state over an already-populated Chat page.
  const loadChats = useCallback((showLoading: boolean) => {
    if (showLoading) setLoading(true);
    return Promise.all([fetchAcceptedChats(), fetchMyGroups()])
      .then(([chats, myGroups]) => {
        setFriends(chats);
        setGroups(myGroups);
      })
      .catch((err) => {
        console.error('Could not load chats/groups:', err);
      })
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }, []);

  // Load friends + groups whenever login status turns on; clear everything
  // when logged out.
  useEffect(() => {
    if (!isLoggedIn) {
      setFriends([]);
      setGroups([]);
      setMessages({});
      setUnreadThreadIds(new Set());
      joinedPrivate.current.clear();
      joinedGroups.current.clear();
      return;
    }

    loadChats(true);
  }, [isLoggedIn, loadChats]);

  // Poll for newly-accepted friends/groups every 8s while logged in - same
  // pattern as OceanNav's pending chat-request-count poll. Without this,
  // neither side of an accepted chat request sees the other show up until
  // a full page reload: NotificationsPanel manages its own separate
  // `requests` state and (aside from the immediate refresh() call below)
  // has no way to tell ChatContext "a friend was just added", and the
  // other person's browser has no push notification for it either.
  useEffect(() => {
    if (!isLoggedIn) return;
    const id = setInterval(() => {
      loadChats(false);
    }, 8000);
    return () => clearInterval(id);
  }, [isLoggedIn, loadChats]);

  const refresh = useCallback(() => loadChats(false), [loadChats]);

  // Subscribe to incoming message events once.
  useEffect(() => {
    const socket = getSocket();

    function onPrivateMessage(message: RealChatMessage & { to: string }) {
      // Thread id for a private chat is "the other person's spotifyUserId" -
      // whichever end of from/to isn't a friend I already know, prefer the
      // one that isn't in my own friends list check via `from` (I'm never
      // the thread id for my own view).
      const myFriendIds = new Set(friendsRef.current.map((f) => f.spotifyUserId));
      const otherId = myFriendIds.has(message.from) ? message.from : message.to;
      appendMessage(otherId, message);
      markUnread(otherId, message.from);
    }

    function onGroupMessage(message: RealChatMessage & { groupId: string }) {
      appendMessage(message.groupId, message);
      markUnread(message.groupId, message.from);
    }

    socket.on('private:message', onPrivateMessage);
    socket.on('group:message', onGroupMessage);
    return () => {
      socket.off('private:message', onPrivateMessage);
      socket.off('group:message', onGroupMessage);
    };
  }, [appendMessage, markUnread]);

  // Join a private room for every accepted friend once loaded. Acked (see
  // server.js's private:join handler) so a join that never actually lands
  // - e.g. emitted right as reauthSocket() is tearing the connection down
  // for a reconnect - gets noticed and retried, instead of the friend
  // being silently marked "joined" locally while the server never put this
  // socket in their room (which would otherwise mean private messages for
  // that thread never arrive live until some unrelated future reconnect).
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();
    for (const friend of friends) {
      if (joinedPrivate.current.has(friend.spotifyUserId)) continue;
      joinedPrivate.current.add(friend.spotifyUserId);
      socket.emit('private:join', { otherUserId: friend.spotifyUserId }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          console.error(`Could not join private room with ${friend.spotifyUserId}:`, ack?.error);
          joinedPrivate.current.delete(friend.spotifyUserId); // allow a retry on the next render
        }
      });
    }
  }, [friends, isLoggedIn]);

  // Join a room for every group once loaded.
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();
    for (const group of groups) {
      if (joinedGroups.current.has(group.id)) continue;
      joinedGroups.current.add(group.id);
      socket.emit('group:join', { groupId: group.id }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          console.error(`Could not join group room ${group.id}:`, ack?.error);
          joinedGroups.current.delete(group.id); // allow a retry on the next render
        }
      });
    }
  }, [groups, isLoggedIn]);

  // Re-join rooms after a socket reconnect (e.g. reauthSocket() on
  // login/logout tore the connection down and brought it back up).
  useEffect(() => {
    const socket = getSocket();
    function onConnect() {
      joinedPrivate.current.clear();
      joinedGroups.current.clear();
      for (const friend of friendsRef.current) {
        joinedPrivate.current.add(friend.spotifyUserId);
        socket.emit('private:join', { otherUserId: friend.spotifyUserId }, (ack: { ok: boolean; error?: string }) => {
          if (!ack?.ok) {
            console.error(`Could not join private room with ${friend.spotifyUserId}:`, ack?.error);
            joinedPrivate.current.delete(friend.spotifyUserId);
          }
        });
      }
      for (const group of groupsRef.current) {
        joinedGroups.current.add(group.id);
        socket.emit('group:join', { groupId: group.id });
      }
    }
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, []);

  const messagesFor = useCallback((threadId: string) => messages[threadId] || [], [messages]);

  // Sender receives their own message back over the socket too: the
  // ported server broadcasts private:send via io.to(roomId).emit(...) and
  // the sender is in that room via private:join, and group:send loops
  // every socket in the room (including the sender's) via
  // fetchSockets()/emit(...) - so no optimistic local append is needed
  // here in either case.
  const sendMessage = useCallback((threadId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = getSocket();

    const isGroup = groupsRef.current.some((g) => g.id === threadId);
    if (isGroup) {
      socket.emit('group:send', { groupId: threadId, text: trimmed }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) console.error('Could not send group message:', ack?.error);
      });
    } else {
      socket.emit('private:send', { toUserId: threadId, text: trimmed });
    }
  }, []);

  const unfriend = useCallback(async (spotifyUserId: string) => {
    const friend = friendsRef.current.find((f) => f.spotifyUserId === spotifyUserId);
    if (!friend) return;
    await revokeChatRequest(friend.requestId);
    setFriends((prev) => prev.filter((f) => f.spotifyUserId !== spotifyUserId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[spotifyUserId];
      return next;
    });
    setUnreadThreadIds((prev) => {
      if (!prev.has(spotifyUserId)) return prev;
      const next = new Set(prev);
      next.delete(spotifyUserId);
      return next;
    });
    joinedPrivate.current.delete(spotifyUserId);
  }, []);

  const createGroup = useCallback(async (name: string, icon: string | null, memberSpotifyUserIds: string[]) => {
    const group = await createRealGroup(name, icon, memberSpotifyUserIds);
    setGroups((prev) => [...prev, group]);
    const socket = getSocket();
    joinedGroups.current.add(group.id);
    socket.emit('group:join', { groupId: group.id });
    return group.id;
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    await leaveRealGroup(groupId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setUnreadThreadIds((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
    joinedGroups.current.delete(groupId);
    getSocket().emit('group:leave', { groupId });
  }, []);

  const hasAnyUnread = unreadThreadIds.size > 0;

  return (
    <ChatContext.Provider
      value={{
        friends,
        groups,
        loading,
        messagesFor,
        sendMessage,
        unfriend,
        createGroup,
        leaveGroup,
        refresh,
        unreadThreadIds,
        hasAnyUnread,
        setActiveThread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
