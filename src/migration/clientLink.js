/** Resuelve client.id_linked_user cuando email/teléfono coinciden con app_user. */

function normalizePhoneForMatch(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function buildUserLookup(users) {
  const userByEmail = new Map();
  const userByPhone = new Map();
  for (const u of users) {
    const email = u.email != null ? String(u.email).trim().toLowerCase() : '';
    if (email && !userByEmail.has(email)) userByEmail.set(email, u.id_user);
    const phone = normalizePhoneForMatch(u.phone);
    if (phone && !userByPhone.has(phone)) userByPhone.set(phone, u.id_user);
  }
  return { userByEmail, userByPhone };
}

function createLinkedUserResolver(userByEmail, userByPhone) {
  return function resolveLinkedUserId(email, phone) {
    const mail = email != null ? String(email).trim().toLowerCase() : '';
    if (mail) {
      const byEmail = userByEmail.get(mail);
      if (byEmail) return byEmail;
    }
    const ph = normalizePhoneForMatch(phone);
    if (ph) {
      const byPhone = userByPhone.get(ph);
      if (byPhone) return byPhone;
    }
    return null;
  };
}

module.exports = {
  normalizePhoneForMatch,
  buildUserLookup,
  createLinkedUserResolver,
};
