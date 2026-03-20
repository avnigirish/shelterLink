// Feature: community-activity-feed
// Unit tests for CommunityChat polling and submission
// Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4

import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommunityChat } from './CommunityChat';
import type { ChatMessage } from '@/types/shelter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SHELTER_ID = 'shelter-001';

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    roomId: SHELTER_ID,
    timestamp: new Date('2024-01-01T12:00:00Z').toISOString(),
    senderName: 'Alice',
    message: 'Hello everyone',
    userType: 'VOLUNTEER',
    ...overrides,
  };
}

const INITIAL_MESSAGES: ChatMessage[] = [
  makeMsg({ timestamp: new Date('2024-01-01T12:00:00Z').toISOString(), message: 'First message' }),
  makeMsg({ timestamp: new Date('2024-01-01T12:01:00Z').toISOString(), message: 'Second message', userType: 'DONOR' }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okJson(data: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);
}

/** Flush all pending microtasks/promises. */
async function flushPromises() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

// ---------------------------------------------------------------------------
// Polling tests — use fake timers
// ---------------------------------------------------------------------------

describe('renders initial messages', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('displays all messages passed via initialMessages prop', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(okJson([])));
    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={INITIAL_MESSAGES} />);
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('shows empty state when initialMessages is empty', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(okJson([])));
    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
  });
});

describe('polling', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  // Req 6.1 — polls GET every 3 s
  it('calls GET /api/chat/[shelterId] after 3 seconds', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson([]));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/chat/${SHELTER_ID}`);
  });

  it('polls again after another 3 seconds', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson([]));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Req 6.2 — interval cleared on unmount
  it('stops polling after unmount', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson([]));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => { vi.advanceTimersByTime(9000); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no new calls after unmount
  });

  // Req 6.3 — silent error handling
  it('silently ignores fetch errors and continues polling', async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(Promise.reject(new Error('Network error')))
      .mockReturnValue(okJson([]));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Req 6.4 — auto-scroll on new messages
  it('sets scrollTop when new messages arrive from polling', async () => {
    const newMessages = [makeMsg({ message: 'New arrival' })];
    const fetchMock = vi.fn().mockReturnValue(okJson(newMessages));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    const list = screen.getByRole('list', { name: /chat messages/i });
    let scrollTopSet = false;
    Object.defineProperty(list, 'scrollTop', {
      set() { scrollTopSet = true; },
      get() { return 0; },
      configurable: true,
    });

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText('New arrival')).toBeInTheDocument();
    expect(scrollTopSet).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Submission tests — use real timers so async/await resolves naturally
// ---------------------------------------------------------------------------

describe('message submission', () => {
  beforeEach(() => { vi.useRealTimers(); });
  afterEach(() => { vi.restoreAllMocks(); });

  // Req 7.1 — POSTs with correct fields
  it('POSTs message with senderName, message, and userType on submit', async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(okJson({}))   // POST
      .mockReturnValue(okJson([]));       // GET after POST
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello shelter' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: /send a message/i }));
    });

    const postCall = fetchMock.mock.calls.find(
      ([, opts]) => (opts as RequestInit)?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.senderName).toBe('Bob');
    expect(body.message).toBe('Hello shelter');
    expect(body.userType).toBe('VOLUNTEER');
  });

  // Req 7.2 — anonymous fallback when senderName blank
  it('sends "Anonymous" when senderName is left blank', async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(okJson({}))
      .mockReturnValue(okJson([]));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Anonymous message' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: /send a message/i }));
    });

    const postCall = fetchMock.mock.calls.find(
      ([, opts]) => (opts as RequestInit)?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.senderName).toBe('Anonymous');
  });

  // Req 7.3 — immediate GET after successful POST
  it('fetches latest messages immediately after a successful POST', async () => {
    const updatedMessages = [makeMsg({ message: 'Posted message' })];
    const fetchMock = vi.fn()
      .mockReturnValueOnce(okJson({}))
      .mockReturnValue(okJson(updatedMessages));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Posted message' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: /send a message/i }));
    });

    expect(screen.getByText('Posted message')).toBeInTheDocument();

    // call[0] = POST, call[1] = immediate GET (no second arg)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/chat/${SHELTER_ID}`);
    expect(fetchMock.mock.calls[1][1]).toBeUndefined();
  });

  // Req 7.4 — send button disabled + "Sending…" during POST
  it('disables send button and shows "Sending…" while POST is in flight', async () => {
    let resolvePost!: (v: Response) => void;
    const pendingPost = new Promise<Response>((res) => { resolvePost = res; });

    const fetchMock = vi.fn()
      .mockReturnValueOnce(pendingPost)
      .mockReturnValue(okJson([]));
    vi.stubGlobal('fetch', fetchMock);

    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'In flight' } });

    // Start the submit but don't await — we want to inspect mid-flight state
    act(() => {
      fireEvent.submit(screen.getByRole('form', { name: /send a message/i }));
    });

    // Flush enough microtasks for setSending(true) to propagate
    await flushPromises();

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();

    // Resolve the POST and let the component finish
    await act(async () => {
      resolvePost({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    expect(screen.getByRole('button', { name: /^send$/i })).toBeInTheDocument();
  });

  it('send button is disabled when message input is empty', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(okJson([])));
    render(<CommunityChat shelterId={SHELTER_ID} initialMessages={[]} />);
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();
  });
});
