'use strict';

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES_PER_CONVERSATION = 80;
const MAX_MESSAGE_CHARS = 16000;
const MAX_TITLE_CHARS = 120;
const MAX_TOTAL_CHARS = 2 * 1024 * 1024;

function validateHistory(input) {
  const list = Array.isArray(input) ? input : input?.conversations;
  if (!Array.isArray(list)) throw new Error('Chat history must contain a conversations array.');
  if (list.length > MAX_CONVERSATIONS) throw new Error('Chat history exceeds the conversation limit.');
  let total = 0;
  const seen = new Set();
  const safe = list.map((item) => {
    const id = String(item?.id || '');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || seen.has(id)) throw new Error('Chat history contains an invalid or duplicate conversation ID.');
    seen.add(id);
    const title = String(item?.title || 'New conversation').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, MAX_TITLE_CHARS);
    if (!Array.isArray(item?.messages) || item.messages.length > MAX_MESSAGES_PER_CONVERSATION) throw new Error('Chat history contains an invalid message list.');
    const messages = item.messages.map((message) => {
      if (!['user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string') throw new Error('Chat history contains an invalid message.');
      const content = message.content.slice(0, MAX_MESSAGE_CHARS);
      total += content.length;
      if (total > MAX_TOTAL_CHARS) throw new Error('Chat history exceeds the 2 MB text limit.');
      return { role: message.role, content };
    });
    const date = new Date(item?.updatedAt);
    return { id, title, updatedAt: Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(), messages };
  });
  return safe.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

module.exports = { validateHistory, MAX_CONVERSATIONS, MAX_MESSAGES_PER_CONVERSATION, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS };
