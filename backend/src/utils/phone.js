function normalizePhone(input) {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '');
}

function chatToPhone(chatId) {
  if (!chatId) return '';
  return normalizePhone(chatId.split('@')[0]);
}

function phoneToChatId(phone) {
  return `${normalizePhone(phone)}@c.us`;
}

module.exports = { normalizePhone, chatToPhone, phoneToChatId };
