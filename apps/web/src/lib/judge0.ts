// Judge0 CE client — server-side only

const BASE_URL = (process.env.JUDGE0_API_URL || 'http://localhost:2358').replace(/\/$/, '');
const API_KEY = process.env.JUDGE0_API_KEY;

// ── Language IDs ─────────────────────────────────────────────

export const LANGUAGE_ID = {
  PYTHON3: 71, // Python (3.8.1)
  JAVASCRIPT: 63, // JavaScript / Node.js (12.14.0)
  CPP17: 54, // C++ (GCC 9.2.0)
} as const;

export type CodeLanguage = keyof typeof LANGUAGE_ID;

// ── Status IDs ───────────────────────────────────────────────

export const STATUS_ID = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
} as const;

// ── Types ─────────────────────────────────────────────────────

export type Judge0Status = {
  id: number;
  description: string;
};

export type Judge0Result = {
  token: string;
  status: Judge0Status;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null; // e.g. "0.042" (seconds)
  memory: number | null; // KB
};

export type SubmitCodeOptions = {
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
  cpuTimeLimit?: number; // seconds  (default: 5)
  memoryLimit?: number; // KB       (default: 262144 = 256 MB)
};

// ── Helpers ───────────────────────────────────────────────────

function encode(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64');
}

function decode(s: string | null | undefined): string | null {
  if (!s) return null;
  return Buffer.from(s, 'base64').toString('utf-8');
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-Auth-Token'] = API_KEY;
  return h;
}

function decodeResult(raw: Judge0Result): Judge0Result {
  return {
    ...raw,
    stdout: decode(raw.stdout),
    stderr: decode(raw.stderr),
    compile_output: decode(raw.compile_output),
    message: decode(raw.message),
  };
}

// ── Public API ────────────────────────────────────────────────

/** Submit code to Judge0 and return the submission token. */
export async function submitCode(opts: SubmitCodeOptions): Promise<string> {
  const body = {
    language_id: opts.languageId,
    source_code: encode(opts.sourceCode),
    stdin: opts.stdin ? encode(opts.stdin) : null,
    expected_output: opts.expectedOutput ? encode(opts.expectedOutput) : null,
    cpu_time_limit: opts.cpuTimeLimit ?? 5,
    memory_limit: opts.memoryLimit ?? 262144,
    base64_encoded: true,
  };

  const res = await fetch(`${BASE_URL}/submissions?base64_encoded=true&wait=false`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge0 submit failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { token: string };
  return json.token;
}

/** Fetch the current result for a submission token. */
export async function getSubmission(token: string): Promise<Judge0Result> {
  const fields = 'token,status,stdout,stderr,compile_output,message,time,memory';
  const res = await fetch(`${BASE_URL}/submissions/${token}?base64_encoded=true&fields=${fields}`, {
    headers: headers(),
  });

  if (!res.ok) throw new Error(`Judge0 get failed (${res.status})`);
  return decodeResult((await res.json()) as Judge0Result);
}

/**
 * Poll until the submission is done (status > PROCESSING) or timeout.
 * Throws on timeout.
 */
export async function waitForResult(
  token: string,
  { timeoutMs = 15_000, intervalMs = 500 } = {}
): Promise<Judge0Result> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await getSubmission(token);
    if (result.status.id > 2) return result;
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Judge0 timeout: no result after ${timeoutMs}ms`);
}

/** Submit, wait for result, and return in one call. Convenience wrapper. */
export async function runCode(opts: SubmitCodeOptions): Promise<Judge0Result> {
  const token = await submitCode(opts);
  return waitForResult(token);
}

/** True if the submission passed all test cases. */
export function isAccepted(status: Judge0Status): boolean {
  return status.id === STATUS_ID.ACCEPTED;
}

/** Returns true if Judge0 is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/system_info`, {
      headers: headers(),
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** List all languages Judge0 supports (useful for debugging). */
export async function listLanguages(): Promise<Array<{ id: number; name: string }>> {
  const res = await fetch(`${BASE_URL}/languages`, { headers: headers() });
  if (!res.ok) throw new Error(`Judge0 languages failed (${res.status})`);
  return res.json() as Promise<Array<{ id: number; name: string }>>;
}
