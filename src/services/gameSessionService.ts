async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || "No se pudo completar la solicitud al servidor."
    );
  }
  return response.json() as Promise<T>;
}

export interface CreateGameSessionInput {
  mode?: string;
  yearMin?: number | null;
  yearMax?: number | null;
  onlySpanish?: boolean;
  timerEnabled?: boolean;
}

export async function createGameSession(
  payload: CreateGameSessionInput
): Promise<void> {
  await fetchJson<{ ok: boolean }>("/api/game-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: payload.mode ?? "auto",
      yearMin:
        typeof payload.yearMin === "number" && Number.isFinite(payload.yearMin)
          ? Math.trunc(payload.yearMin)
          : null,
      yearMax:
        typeof payload.yearMax === "number" && Number.isFinite(payload.yearMax)
          ? Math.trunc(payload.yearMax)
          : null,
      onlySpanish: payload.onlySpanish === true,
      timerEnabled: payload.timerEnabled === true,
    }),
  });
}
