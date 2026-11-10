import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatChannel } from '@midnight-city/shared';
import { MessageSquare, Send, Shield, Skull } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

export function ChatPanel() {
  const room = useGameStore((s) => s.room);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const sendChat = useGameStore((s) => s.sendChat);

  const [activeChannel, setActiveChannel] = useState<ChatChannel>('PUBLIC');
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const me = room?.players.find((p) => p.id === room.myPlayerId);
  const phase = room?.game.phase ?? 'LOBBY';

  const availableChannels = useMemo(() => {
    if (!room || !me) return ['PUBLIC'] as ChatChannel[];
    const list: ChatChannel[] = ['PUBLIC'];
    const isMafia = me.role === 'MAFIA';
    const isDead = me.isPlaying && !me.isAlive;
    const isGod =
      room.settings.narratorMode === 'HUMAN_HOST' &&
      me.isHost &&
      !me.isPlaying &&
      phase !== 'LOBBY';

    if (isMafia || isGod || phase === 'GAME_OVER') {
      list.push('MAFIA');
    }
    if (
      room.settings.allowDeadChat &&
      (isDead || isGod || phase === 'GAME_OVER') &&
      phase !== 'LOBBY' &&
      phase !== 'ROLE_REVEAL'
    ) {
      list.push('GHOST');
    }
    return list;
  }, [room, me, phase]);

  useEffect(() => {
    if (!availableChannels.includes(activeChannel)) {
      setActiveChannel('PUBLIC');
    }
  }, [availableChannels, activeChannel]);

  useEffect(() => {
    if (
      room?.game.phase === 'NIGHT' &&
      room.game.night?.subPhase === 'MAFIA_TURN' &&
      me?.role === 'MAFIA' &&
      me.isAlive
    ) {
      setActiveChannel('MAFIA');
    }
  }, [room?.game.phase, room?.game.night?.subPhase, me?.role, me?.isAlive]);

  const canWrite = useMemo(() => {
    if (!room || !me) return false;
    if (activeChannel === 'PUBLIC') {
      if (phase === 'NIGHT') return false;
      if (
        (phase === 'DAWN' ||
          phase === 'DAY_DISCUSSION' ||
          phase === 'DAY_VOTE' ||
          phase === 'VOTE_RESULT') &&
        me.isPlaying &&
        !me.isAlive
      ) {
        return false;
      }
      return true;
    }
    if (activeChannel === 'MAFIA') {
      return (
        phase === 'NIGHT' &&
        room.game.night?.subPhase === 'MAFIA_TURN' &&
        me.isPlaying &&
        me.isAlive &&
        me.role === 'MAFIA'
      );
    }
    if (activeChannel === 'GHOST') {
      return (
        room.settings.allowDeadChat &&
        phase !== 'LOBBY' &&
        phase !== 'ROLE_REVEAL' &&
        me.isPlaying &&
        !me.isAlive
      );
    }
    return false;
  }, [room, me, phase, activeChannel]);

  const filteredMessages = useMemo(
    () => chatMessages.filter((m) => m.channel === activeChannel),
    [chatMessages, activeChannel]
  );

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredMessages.length, activeChannel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !canWrite) return;
    const ok = await sendChat(activeChannel, text);
    if (ok) {
      setDraft('');
    }
  };

  return (
    <section
      className="noir-card rounded-xl flex flex-col h-80 lg:h-[26rem] overflow-hidden"
      aria-label="Text chat panel"
    >
      <div className="flex items-center border-b border-gold-500/20 bg-noir-900/70 px-2 pt-2 gap-1">
        {availableChannels.map((ch) => {
          const selected = activeChannel === ch;
          return (
            <button
              key={ch}
              type="button"
              onClick={() => setActiveChannel(ch)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold tracking-wider uppercase transition-colors ${
                selected
                  ? ch === 'MAFIA'
                    ? 'bg-crimson-900/70 text-crimson-200 border-t border-x border-crimson-500/50'
                    : ch === 'GHOST'
                      ? 'bg-purple-950/70 text-purple-200 border-t border-x border-purple-500/50'
                      : 'bg-noir-800 text-gold-200 border-t border-x border-gold-500/40'
                  : 'text-cream-400 hover:text-cream-100'
              }`}
            >
              {ch === 'PUBLIC' && <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />}
              {ch === 'MAFIA' && <Shield className="w-3.5 h-3.5" aria-hidden="true" />}
              {ch === 'GHOST' && <Skull className="w-3.5 h-3.5" aria-hidden="true" />}
              {ch === 'PUBLIC' ? 'City' : ch === 'MAFIA' ? 'Syndicate' : 'Ghost'}
            </button>
          );
        })}
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 text-sm"
        aria-live="polite"
      >
        {filteredMessages.length === 0 ? (
          <p className="text-xs text-cream-400/70 text-center py-8 italic">
            {activeChannel === 'MAFIA'
              ? 'Private Syndicate whispers during Mafia night turns appear here.'
              : activeChannel === 'GHOST'
                ? 'Spectator spirits gather here.'
                : 'No messages yet in City chat.'}
          </p>
        ) : (
          filteredMessages.map((msg) => (
            <div key={msg.id} className="leading-snug break-words">
              <span
                className={`font-semibold mr-1.5 ${
                  msg.channel === 'MAFIA'
                    ? 'text-crimson-300'
                    : msg.channel === 'GHOST'
                      ? 'text-purple-300'
                      : 'text-gold-300'
                }`}
              >
                {msg.senderName}:
              </span>
              <span className="text-cream-100">{msg.content}</span>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-2 border-t border-gold-500/20 bg-noir-950/70 flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!canWrite}
          maxLength={500}
          placeholder={
            canWrite
              ? `Message ${activeChannel.toLowerCase()}...`
              : activeChannel === 'PUBLIC' && phase === 'NIGHT'
                ? 'City sleeps — chat silenced'
                : 'Read-only right now'
          }
          aria-label="Chat message input"
          className="flex-1 bg-noir-900 border border-gold-500/25 rounded-lg px-3 py-1.5 text-sm text-cream-100 placeholder:text-cream-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canWrite || draft.trim().length === 0}
          aria-label="Send chat message"
          className="px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-noir-950 font-semibold text-sm disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}

