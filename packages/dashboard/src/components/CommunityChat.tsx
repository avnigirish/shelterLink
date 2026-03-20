'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, UserType } from '@/types/shelter';

interface Props {
  shelterId: string;
  initialMessages: ChatMessage[];
}

const USER_TYPE_COLORS: Record<UserType, string> = {
  VOLUNTEER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DONOR:     'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  STAFF:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ADMIN:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const USER_TYPE_OPTIONS: Exclude<UserType, 'ADMIN'>[] = ['VOLUNTEER', 'DONOR', 'STAFF'];

const inputClass = `text-sm border border-surface-border dark:border-dark-border rounded px-2 py-1.5
  bg-surface-DEFAULT dark:bg-dark-elevated
  text-text-DEFAULT dark:text-dark-text
  placeholder:text-text-faint dark:placeholder:text-dark-subtle
  focus:outline-none focus:ring-2 focus:ring-brand-500`;

export function CommunityChat({ shelterId, initialMessages }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [senderName, setSenderName] = useState('');
  const [userType, setUserType] = useState<Exclude<UserType, 'ADMIN'>>('VOLUNTEER');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // TODO: replace with AppSync subscription for real-time updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/${shelterId}`);
        if (res.ok) {
          const data = await res.json() as ChatMessage[];
          setMessages(data);
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [shelterId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageText.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/chat/${shelterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: senderName.trim() || 'Anonymous',
          message: messageText.trim(),
          userType,
        }),
      });
      setMessageText('');
      const res = await fetch(`/api/chat/${shelterId}`);
      if (res.ok) {
        const data = await res.json() as ChatMessage[];
        setMessages(data);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Community chat"
      className="border border-surface-border dark:border-dark-border rounded-lg overflow-hidden
        bg-surface-DEFAULT dark:bg-dark-surface">
      <div className="px-4 py-3 border-b border-surface-border dark:border-dark-border
        bg-surface-muted dark:bg-dark-elevated">
        <h3 className="text-base font-semibold text-text-DEFAULT dark:text-dark-text">Community Chat</h3>
      </div>

      {/* Message list */}
      <ul
        ref={listRef}
        aria-live="polite"
        aria-label="Chat messages"
        className="h-64 overflow-y-auto px-4 py-3 space-y-3 list-none"
      >
        {messages.length === 0 ? (
          <li className="text-text-subtle dark:text-dark-subtle text-sm text-center py-8">
            No messages yet — be the first to post
          </li>
        ) : (
          messages.map((msg) => (
            <li key={`${msg.roomId}-${msg.timestamp}`} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-text-DEFAULT dark:text-dark-text">{msg.senderName}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${USER_TYPE_COLORS[msg.userType]}`}
                  aria-label={`User type: ${msg.userType.toLowerCase()}`}
                >
                  {msg.userType}
                </span>
                <span className="text-xs text-text-subtle dark:text-dark-subtle">{relativeTime(msg.timestamp)}</span>
              </div>
              <p className="text-sm text-text-muted dark:text-dark-muted">{msg.message}</p>
            </li>
          ))
        )}
      </ul>

      {/* Input form */}
      <form
        onSubmit={handleSend}
        className="border-t border-surface-border dark:border-dark-border px-4 py-3 space-y-2"
        aria-label="Send a message"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Your name (optional)"
            className={`flex-1 ${inputClass}`}
            aria-label="Your name"
          />
          <select
            value={userType}
            onChange={(e) => setUserType(e.target.value as Exclude<UserType, 'ADMIN'>)}
            className={inputClass}
            aria-label="Your role"
          >
            {USER_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message…"
            className={`flex-1 ${inputClass}`}
            aria-label="Message"
            required
          />
          <button
            type="submit"
            disabled={sending || !messageText.trim()}
            className="px-3 py-1.5 text-sm font-medium
              bg-brand-500 hover:bg-brand-600 text-white rounded
              disabled:opacity-50
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1
              dark:focus:ring-offset-dark-surface"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
