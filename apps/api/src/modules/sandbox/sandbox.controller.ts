import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SandboxService } from './sandbox.service';

@ApiTags('sandbox')
@Controller({ path: 'sandbox', version: '1' })
export class SandboxController {
  constructor(private readonly service: SandboxService) {}

  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Chạy code (không lưu) — sandbox' })
  run(
    @Body()
    body: {
      languageId: number;
      sourceCode: string;
      stdin?: string;
    }
  ) {
    return this.service.runCode(body);
  }
}
