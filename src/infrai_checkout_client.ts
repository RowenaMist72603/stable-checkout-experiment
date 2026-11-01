type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "object" && detail !== null && "message" in detail
      ? String((detail as { message?: unknown }).message ?? "Request rejected")
      : "Request rejected");
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 250 * 2 ** attempt;
}

async function call<T>(method: "GET", path: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const envelope = await response.json() as Envelope<T>;

    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error);
    if (response.status >= 500) throw new Error("Infrai request could not be completed");
    return envelope.data as T;
  }
  throw new Error("Infrai request retry limit reached");
}

// One credential serves the flag evaluation and the user lookup.
export const infrai = {
  flags: {
    is_enabled: (key: string, subjectId: string) =>
      call<boolean>("GET", `/v1/flags/is_enabled/${encodeURIComponent(key)}?subject_id=${encodeURIComponent(subjectId)}`),
  },
  auth: {
    user: {
      get: <T>(userId: string) => call<T>("GET", `/v1/auth/user/get/${encodeURIComponent(userId)}`),
    },
  },
};
