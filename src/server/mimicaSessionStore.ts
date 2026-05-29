type MimicaSessionState = {
  sessionId: string;
  active: boolean;
  mode: "mimica" | "tararear" | null;
  songId: number | null;
  songTitle: string | null;
  artist: string | null;
  videoId: string | null;
  revealPressed: boolean;
  updatedAt: number;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

const store = new Map<string, MimicaSessionState>();

function cleanupExpiredSessions(now = Date.now()) {
  store.forEach((session, sessionId) => {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      store.delete(sessionId);
    }
  });
}

export function getMimicaSession(sessionId: string): MimicaSessionState | null {
  cleanupExpiredSessions();
  return store.get(sessionId) ?? null;
}

export function upsertMimicaSession(
  sessionId: string,
  patch: Partial<Omit<MimicaSessionState, "sessionId" | "updatedAt">>
): MimicaSessionState {
  cleanupExpiredSessions();
  const current = store.get(sessionId);
  const next: MimicaSessionState = {
    sessionId,
    active: patch.active ?? current?.active ?? false,
    mode: patch.mode ?? current?.mode ?? null,
    songId: patch.songId ?? current?.songId ?? null,
    songTitle: patch.songTitle ?? current?.songTitle ?? null,
    artist: patch.artist ?? current?.artist ?? null,
    videoId: patch.videoId ?? current?.videoId ?? null,
    revealPressed: patch.revealPressed ?? current?.revealPressed ?? false,
    updatedAt: Date.now(),
  };
  store.set(sessionId, next);
  return next;
}

export function clearMimicaReveal(sessionId: string): MimicaSessionState | null {
  const current = store.get(sessionId);
  if (!current) {
    return null;
  }
  const next = {
    ...current,
    revealPressed: false,
    updatedAt: Date.now(),
  };
  store.set(sessionId, next);
  return next;
}
