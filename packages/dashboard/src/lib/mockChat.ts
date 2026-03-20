/**
 * Re-exports from mockChatStore for backward compatibility.
 * All route handlers should import from mockChatStore directly to ensure
 * they share the same singleton array reference.
 */
export { getAllMessages as MOCK_MESSAGES_GETTER, getMessages, addMessage } from './mockChatStore';

// Legacy named export — points at the live store array via getter.
// NOTE: for read/write in route handlers, prefer getMessages() and addMessage()
// from mockChatStore to guarantee singleton behaviour across Next.js module instances.
import { getAllMessages } from './mockChatStore';
export const MOCK_MESSAGES = getAllMessages();
