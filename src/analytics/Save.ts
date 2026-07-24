/**
 * Save — the tiny bit of client persistence we allow (privacy-first).
 *
 *  - `session_id`: a pseudonymous random UUID in **sessionStorage** (cleared on
 *    tab close). It ties analytics events into a funnel; it is NOT a persistent
 *    cross-site identifier and carries no PII.
 *  - mute preference: a small UX convenience persisted in **localStorage**.
 *
 * All access is defensively guarded — storage can throw (Safari private mode,
 * disabled cookies), in which case we degrade gracefully to an in-memory id.
 */
const SESSION_KEY = 'beamrun_session_id';
const MUTE_KEY = 'beamrun_mute';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `br-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function safeStorage(kind: 'session' | 'local'): Storage | null {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    // Touch it to confirm access (throws in some privacy modes).
    const probe = '__brp__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

let memoSessionId: string | null = null;

/** Get (or lazily create) the pseudonymous session id. */
export function getSessionId(): string {
  const store = safeStorage('session');
  if (!store) {
    if (!memoSessionId) memoSessionId = randomId();
    return memoSessionId;
  }
  let id = store.getItem(SESSION_KEY);
  if (!id) {
    id = randomId();
    try {
      store.setItem(SESSION_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

export interface MutePref {
  music: boolean;
  sfx: boolean;
}

/** Read the persisted mute preference, or null if none saved. */
export function getMutePref(): MutePref | null {
  const store = safeStorage('local');
  if (!store) return null;
  try {
    const raw = store.getItem(MUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MutePref>;
    return { music: !!parsed.music, sfx: !!parsed.sfx };
  } catch {
    return null;
  }
}

export function setMutePref(pref: MutePref): void {
  const store = safeStorage('local');
  if (!store) return;
  try {
    store.setItem(MUTE_KEY, JSON.stringify(pref));
  } catch {
    /* ignore */
  }
}
