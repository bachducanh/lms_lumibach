import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const LANGUAGE_ID = {
  PYTHON3: 71,
  JAVASCRIPT: 63,
  CPP17: 54,
} as const;

export type Judge0Status = { id: number; description: string };
export type Judge0Result = {
  token: string;
  status: Judge0Status;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
};

export type SubmitCodeOptions = {
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
  cpuTimeLimit?: number;
  memoryLimit?: number;
};

@Injectable()
export class Judge0Service {
  private readonly logger = new Logger(Judge0Service.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('JUDGE0_API_URL') ?? 'http://localhost:2358').replace(
      /\/$/,
      ''
    );
    this.apiKey = this.config.get<string>('JUDGE0_API_KEY');
  }

  private encode(s: string): string {
    return Buffer.from(s, 'utf-8').toString('base64');
  }

  private decode(s: string | null | undefined): string | null {
    if (!s) return null;
    return Buffer.from(s, 'base64').toString('utf-8');
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-Auth-Token'] = this.apiKey;
    return h;
  }

  private decodeResult(raw: Judge0Result): Judge0Result {
    return {
      ...raw,
      stdout: this.decode(raw.stdout),
      stderr: this.decode(raw.stderr),
      compile_output: this.decode(raw.compile_output),
      message: this.decode(raw.message),
    };
  }

  async submitCode(opts: SubmitCodeOptions): Promise<string> {
    const body = {
      language_id: opts.languageId,
      source_code: this.encode(opts.sourceCode),
      stdin: opts.stdin ? this.encode(opts.stdin) : null,
      expected_output: opts.expectedOutput ? this.encode(opts.expectedOutput) : null,
      cpu_time_limit: opts.cpuTimeLimit ?? 5,
      memory_limit: opts.memoryLimit ?? 262144,
      base64_encoded: true,
    };

    const res = await fetch(`${this.baseUrl}/submissions?base64_encoded=true&wait=false`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Judge0 submit failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { token: string };
    return json.token;
  }

  async getSubmission(token: string): Promise<Judge0Result> {
    const fields = 'token,status,stdout,stderr,compile_output,message,time,memory';
    const res = await fetch(
      `${this.baseUrl}/submissions/${token}?base64_encoded=true&fields=${fields}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Judge0 get failed (${res.status})`);
    return this.decodeResult((await res.json()) as Judge0Result);
  }

  async waitForResult(
    token: string,
    { timeoutMs = 15_000, intervalMs = 500 } = {}
  ): Promise<Judge0Result> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await this.getSubmission(token);
      if (result.status.id > 2) return result;
      await new Promise<void>((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Judge0 timeout after ${timeoutMs}ms`);
  }

  async runCode(opts: SubmitCodeOptions): Promise<Judge0Result> {
    const token = await this.submitCode(opts);
    return this.waitForResult(token);
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_info`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
