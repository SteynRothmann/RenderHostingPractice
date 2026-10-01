import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useChat } from '../../data/ChatContext';
import Conversation from './Conversation';
import CreateGroupPanel from './CreateGroupPanel';
import ChatProfileOverlay from './ChatProfileOverlay';

type Active = { type: 'friend' | 'group'; id: string } | null;

export default function ChatPage() {
  const { friends, groups, unfriend, leaveGroup, unreadThreadIds, setActiveThread } = useChat();
  const [params] = useSearchParams();

  const withId = params.get('with');

  const [tab, setTab] = useState<'friends' | 'groups'>('friends');

  const [active, setActive] = useState<Active>(
    withId && friends.some((f) => f.spotifyUserId === withId)
      ? { type: 'friend', id: withId }
      : null
  );

  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [showThread, setShowThread] = useState(Boolean(withId));
  // spotifyUserId of whoever's inline profile overlay (part 5) is open, or
  // null when closed - triggered from a friend's header or a group
  // message's sender name/avatar (see Conversation.tsx's onPersonClick).
  const [profileOverlayId, setProfileOverlayId] = useState<string | null>(null);

  const hasUnreadFriends = friends.some((f) => unreadThreadIds.has(f.spotifyUserId));
  const hasUnreadGroups = groups.some((g) => unreadThreadIds.has(g.id));

  // Tell ChatContext which thread (if any) is on-screen right now, so it
  // can suppress the unread dot for messages arriving in that thread and
  // clear it the moment a thread is opened. Runs whenever `active` changes
  // (covers selectFriend/selectGroup below, CreateGroupPanel's onCreated,
  // and the deep-link-from-notifications initial state), and clears it on
  // unmount so navigating away from Chat entirely doesn't leave a thread
  // marked "active" forever (which would silently swallow its next unread
  // dot).
  useEffect(() => {
    setActiveThread(active ? active.id : null);
    return () => setActiveThread(null);
  }, [active, setActiveThread]);

  function selectFriend(id: string) {
    setActive({ type: 'friend', id });
    setShowThread(true);
  }

  function selectGroup(id: string) {
    setActive({ type: 'group', id });
    setShowThread(true);
  }

  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-[#0a192f] text-white">

      {/* Underwater atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        {/* Deep ocean gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a2140] via-[#071c3d] to-[#031426]" />

        {/* Soft underwater glow */}
        <div className="absolute -left-32 top-16 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-[120px]" />

        {/* Light rays */}
        <div className="absolute -top-40 left-[15%] h-[700px] w-32 rotate-[18deg] bg-gradient-to-b from-cyan-200/[0.08] to-transparent blur-xl" />

        <div className="absolute -top-40 left-[45%] h-[650px] w-44 rotate-[14deg] bg-gradient-to-b from-blue-200/[0.06] to-transparent blur-2xl" />

        <div className="absolute -top-40 right-[12%] h-[700px] w-28 rotate-[20deg] bg-gradient-to-b from-cyan-200/[0.05] to-transparent blur-xl" />

        {/* Floating bubbles */}
        <motion.span
          className="absolute bottom-[12%] left-[8%] h-2 w-2 rounded-full border border-cyan-200/20 bg-cyan-200/5"
          animate={{
            y: [0, -90],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.span
          className="absolute bottom-[18%] left-[38%] h-3 w-3 rounded-full border border-cyan-200/15 bg-cyan-200/5"
          animate={{
            y: [0, -120],
            x: [0, 8, -4],
            opacity: [0, 0.45, 0],
          }}
          transition={{
            duration: 11,
            delay: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.span
          className="absolute bottom-[8%] right-[20%] h-1.5 w-1.5 rounded-full border border-cyan-200/20"
          animate={{
            y: [0, -100],
            x: [0, -6, 3],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 9,
            delay: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.span
          className="absolute bottom-[28%] right-[7%] h-2.5 w-2.5 rounded-full border border-cyan-200/15"
          animate={{
            y: [0, -80],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 10,
            delay: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Shared WaveLength secondary header */}
      <div className="relative z-10">
        <PageHeader title="Chat" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-5 pb-5 pt-4">
        {/* Sidebar */}
        <aside
          className={`${
            showThread ? 'hidden' : 'flex'
          } w-full flex-col overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#071330]/55 shadow-[0_16px_50px_rgba(2,10,25,0.35)] backdrop-blur-xl md:flex md:w-[320px] md:shrink-0`}        >

          {/* Friends / Groups tabs */}
          <nav className="flex border-b border-white/10 text-sm font-medium">
            {(['friends', 'groups'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`relative flex-1 py-4 capitalize transition ${
                  tab === item
                    ? 'text-white'
                    : 'text-white/45 hover:text-white/75'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item}
                  {((item === 'friends' && hasUnreadFriends) || (item === 'groups' && hasUnreadGroups)) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Unread messages" />
                  )}
                </span>

                {tab === item && (
                  <motion.span
                    layoutId="chat-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan-300"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 40,
                    }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar heading */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              {tab === 'groups' ? 'Your groups' : 'Friends'}
            </span>

            {tab === 'groups' && (
              <button
                type="button"
                onClick={() => setGroupPanelOpen(true)}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                + New group
              </button>
            )}
          </div>

          {/* Conversation list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'friends' && (
              <>
                {friends.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-white/40">
                    No chats yet — accept a request from Notifications.
                  </p>
                )}

                {friends.map((friend) => {
                  const selected =
                    active?.type === 'friend' && active.id === friend.spotifyUserId;

                  return (
                    <button
                      key={friend.spotifyUserId}
                      type="button"
                      onClick={() => selectFriend(friend.spotifyUserId)}

                      className={`
                        mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3
                        rounded-xl border px-3 py-3 text-left
                        transition duration-200
                        ${
                          selected
                            ? 'border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.10)]'
                            : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-slate-700 transition ${
                            selected
                              ? 'border-cyan-300/60 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
                              : 'border-white/10'
                          }`}
                        >
                          {friend.profileImage ? (
                            <img
                              src={friend.profileImage}
                              alt={friend.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-white">
                              {friend.displayName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        {unreadThreadIds.has(friend.spotifyUserId) && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#071330] bg-red-500"
                            aria-label="New message"
                          />
                        )}
                      </div>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-white">
                          {friend.displayName}
                        </span>

                        <span className="flex items-center gap-1 truncate text-xs text-white/40">
                          <span className="truncate">Tap to chat</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {tab === 'groups' && (
              <>
                {groups.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-white/40">
                    No groups yet.
                  </p>
                )}

                {groups.map((group) => {
                  const selected =
                    active?.type === 'group' && active.id === group.id;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => selectGroup(group.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        selected
                          ? 'bg-cyan-400/15'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {group.icon ? (
                          <img
                            src={group.icon}
                            alt={group.name}
                            className="h-11 w-11 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 text-sm font-semibold text-white">
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {unreadThreadIds.has(group.id) && (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#071330] bg-red-500"
                            aria-label="New message"
                          />
                        )}
                      </div>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-white">
                          {group.name}
                        </span>

                        <span className="block truncate text-xs text-white/40">
                          {group.members.length} members
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Conversation area */}
        <main
          className={`${
            showThread ? 'flex' : 'hidden'
          } min-w-0 flex-1 overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#071330]/35 shadow-[0_16px_50px_rgba(2,10,25,0.3)] backdrop-blur-xl md:flex`}
        >
          {!active && (
            <div className="hidden flex-1 items-center justify-center bg-[#071c3d]/35 text-sm text-white/40 md:flex">
              Pick a conversation to get started
            </div>
          )}

          {active?.type === 'friend' &&
            (() => {
              const friend = friends.find((f) => f.spotifyUserId === active.id);
              if (!friend) return null;

              return (
                <Conversation
                  threadId={friend.spotifyUserId}
                  title={friend.displayName}
                  icon={friend.profileImage}
                  // No real backend support yet for looking up an arbitrary
                  // Spotify account's live listening status by
                  // spotifyUserId from the chat feature - the Ocean page
                  // only knows sessions by internal bearer-token userId,
                  // broadcast publicly by trackId, not searchable by
                  // spotifyUserId here. Falls back to the static "Chat"
                  // subtitle until that's built.
                  listeningSongTitle={null}
                  onHeaderClick={() => setProfileOverlayId(friend.spotifyUserId)}
                  onPersonClick={(id) => setProfileOverlayId(id)}
                  onBack={() => {
                    // Hides the thread on mobile (desktop keeps it visible
                    // via md:flex) - either way, the user's no longer
                    // looking at it, so it can go back to being markable
                    // unread.
                    setShowThread(false);
                    setActiveThread(null);
                  }}
                  menuLabel="Unfriend"
                  onMenuAction={() => {
                    if (
                      confirm(
                        `Unfriend and delete this chat with ${friend.displayName}? This will also unfollow them.`
                      )
                    ) {
                      unfriend(friend.spotifyUserId);
                      setActive(null);
                      setShowThread(false);
                    }
                  }}
                />
              );
            })()}

          {active?.type === 'group' &&
            (() => {
              const group = groups.find((g) => g.id === active.id);
              if (!group) return null;

              return (
                <Conversation
                  threadId={group.id}
                  title={group.name}
                  icon={group.icon}
                  members={group.members}
                  onPersonClick={(id) => setProfileOverlayId(id)}
                  onBack={() => {
                    setShowThread(false);
                    setActiveThread(null);
                  }}
                  menuLabel="Leave group"
                  onMenuAction={() => {
                    if (confirm(`Leave and delete "${group.name}"?`)) {
                      leaveGroup(group.id);
                      setActive(null);
                      setShowThread(false);
                    }
                  }}
                />
              );
            })()}
        </main>
      </div>

      <CreateGroupPanel
        open={groupPanelOpen}
        onClose={() => setGroupPanelOpen(false)}
        onCreated={(id) => {
          setTab('groups');
          setActive({ type: 'group', id });
          setShowThread(true);
        }}
      />

      <ChatProfileOverlay
        spotifyUserId={profileOverlayId}
        onClose={() => setProfileOverlayId(null)}
        onUnfriended={() => {
          // Same cleanup as the existing "⋮" → Unfriend flow above: the
          // friend (and their chat) no longer exists, so close the thread.
          setActive(null);
          setShowThread(false);
        }}
      />
    </div>
  );
}