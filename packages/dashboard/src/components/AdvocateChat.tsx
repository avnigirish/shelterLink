'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'advocate';
  text: string;
}

const STARTERS = [
  'I have blankets to donate — where should I go?',
  'What does this shelter need most right now?',
  'How can I help as a first-time volunteer?',
];

interface NeedChip {
  item: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface Props {
  shelterId?: string;
  context?: 'home' | 'shelter';
  needs?: NeedChip[];
}

export function AdvocateChat({ shelterId, context = 'home', needs = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [acting, setActing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg = text.trim();
    setInput('');

    // Capture history BEFORE adding new messages (completed turns only)
    const history = messages.filter((m) => m.text.trim() !== '');

    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setStreaming(true);
    setActing(false);

    // Add empty advocate message to fill in
    setMessages((prev) => [...prev, { role: 'advocate', text: '' }]);

    try {
      const res = await fetch('/api/advocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, shelterId, context, history }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'advocate', text: err.error ?? 'Something went wrong. Please try again.' };
          return updated;
        });
        return;
      }

      const contentType = res.headers.get('content-type') ?? '';

      // Streaming SSE response (legacy path)
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data) as { text?: string };
              if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'advocate',
                    text: (updated[updated.length - 1]?.text ?? '') + parsed.text,
                  };
                  return updated;
                });
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
      } else {
        // Agentic JSON response
        const json = await res.json() as { text?: string; toolUsed?: string };

        // Show "Taking action…" briefly if a tool was used
        if (json.toolUsed) {
          setActing(true);
          await new Promise((r) => setTimeout(r, 600));
          setActing(false);
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'advocate', text: json.text ?? 'No response.' };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'advocate',
          text: "I'm having trouble connecting right now. Please browse the shelter list directly to find where your help is needed most.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setActing(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Community Advocate chat"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full
            bg-brand-500 hover:bg-brand-600 text-white shadow-lg
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
            dark:focus:ring-offset-dark-surface transition-all"
        >
          <span className="text-lg" aria-hidden="true">🤝</span>
          <span className="text-sm font-semibold hidden sm:inline">Community Advocate</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="ShelterLink Community Advocate"
          aria-modal="false"
          className="fixed bottom-6 right-6 z-50 w-full max-w-sm flex flex-col
            bg-surface-DEFAULT dark:bg-dark-surface
            border border-surface-border dark:border-dark-border
            rounded-2xl shadow-panel dark:shadow-panel-dark overflow-hidden"
          style={{ height: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b border-surface-border dark:border-dark-border
            bg-brand-500 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">🤝</span>
              <div>
                <p className="text-sm font-semibold leading-none">Community Advocate</p>
                <p className="text-xs opacity-80 mt-0.5">Powered by Amazon Nova</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close advocate chat"
              className="p-1.5 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            aria-live="polite"
            aria-label="Conversation"
          >
            {isEmpty && (
              <div className="space-y-3">
                <p className="text-xs text-text-subtle dark:text-dark-subtle leading-relaxed">
                  Hi! I can help you find the right shelter for your donation, summarize what's happening here, or walk you through how ShelterLink works.
                </p>
                <p className="text-xs font-semibold text-text-faint dark:text-dark-subtle uppercase tracking-wide">Try asking:</p>
                <div className="space-y-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg
                        border border-surface-border dark:border-dark-border
                        bg-surface-subtle dark:bg-dark-elevated
                        text-text-muted dark:text-dark-muted
                        hover:border-brand-300 dark:hover:border-brand-600
                        hover:text-brand-600 dark:hover:text-brand-400
                        focus:outline-none focus:ring-2 focus:ring-brand-500
                        transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-500 text-white rounded-br-sm'
                      : 'bg-surface-subtle dark:bg-dark-elevated text-text-DEFAULT dark:text-dark-text rounded-bl-sm border border-surface-border dark:border-dark-border'
                  }`}
                >
                  {msg.text ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mt-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mt-1">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    <span className="flex gap-1 items-center text-text-faint dark:text-dark-subtle">
                      {acting ? (
                        <span className="text-brand-400 dark:text-brand-300">Taking action…</span>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick-select need chips */}
          {needs.length > 0 && !streaming && (
            <div className="px-3 pt-2 pb-1 border-t border-surface-border dark:border-dark-border">
              <p className="text-xs text-text-faint dark:text-dark-subtle mb-1.5">This shelter needs:</p>
              <div className="flex flex-wrap gap-1.5">
                {needs.slice(0, 6).map((n) => (
                  <button
                    key={n.item}
                    type="button"
                    onClick={() => setInput(`I have ${n.item} to donate — where should I bring them?`)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors
                      focus:outline-none focus:ring-2 focus:ring-brand-500
                      ${n.priority === 'CRITICAL'
                        ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40'
                        : n.priority === 'HIGH'
                        ? 'border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                        : 'border-surface-border dark:border-dark-border text-text-muted dark:text-dark-muted bg-surface-subtle dark:bg-dark-elevated hover:border-brand-300 dark:hover:border-brand-600'
                      }`}
                  >
                    {n.item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 px-3 py-3 border-t border-surface-border dark:border-dark-border"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about donations, needs, or how to help…"
              disabled={streaming}
              aria-label="Message to Community Advocate"
              className="flex-1 text-xs px-3 py-2 rounded-lg
                border border-surface-border dark:border-dark-border
                bg-surface-DEFAULT dark:bg-dark-elevated
                text-text-DEFAULT dark:text-dark-text
                placeholder:text-text-faint dark:placeholder:text-dark-subtle
                focus:outline-none focus:ring-2 focus:ring-brand-500
                disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="Send message"
              className="px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                dark:focus:ring-offset-dark-surface
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
