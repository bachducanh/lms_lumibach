import { BadRequestException, Injectable } from '@nestjs/common';
import { Judge0Service } from '../../common/judge0/judge0.service';

@Injectable()
export class SandboxService {
  constructor(private readonly judge0: Judge0Service) {}

  async runCode(body: { languageId: number; sourceCode: string; stdin?: string }) {
    if (!body.sourceCode.trim()) throw new BadRequestException('Code trống');

    const result = await this.judge0.runCode({
      languageId: body.languageId,
      sourceCode: body.sourceCode,
      stdin: body.stdin?.trim() || undefined,
      cpuTimeLimit: 10,
      memoryLimit: 262144,
    });

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compile_output,
      time: result.time,
      memory: result.memory,
    };
  }
}
