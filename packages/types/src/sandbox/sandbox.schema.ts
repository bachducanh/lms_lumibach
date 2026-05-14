export const SANDBOX_LANGUAGE_ID = {
  PYTHON3: 71,
  JAVASCRIPT: 63,
  CPP17: 54,
} as const;

export type SandboxRunResult = {
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null;
  memory: number | null;
};
