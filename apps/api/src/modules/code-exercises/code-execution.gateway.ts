import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@lumibach/db';
import { wsAuthenticate } from '../../common/gateway/ws-auth';
import type { CodeSubmissionStatus } from '@lumibach/db';

export type SubmissionCompletePayload = {
  status: CodeSubmissionStatus;
  score: number | null;
  maxScore: number | null;
};

@WebSocketGateway({ namespace: '/code-execution', cors: { origin: true, credentials: true } })
export class CodeExecutionGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaClient
  ) {}

  async handleConnection(client: Socket) {
    const user = await wsAuthenticate(client, this.config, this.prisma);
    if (!user) {
      client.disconnect();
      return;
    }
    client.data.userId = user.id;
  }

  @SubscribeMessage('submission:join')
  async handleJoin(client: Socket, submissionId: string) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const sub = await this.prisma.codeSubmission.findUnique({
      where: { id: submissionId },
      select: { studentId: true },
    });
    if (!sub || sub.studentId !== userId) return;

    await client.join(`submission:${submissionId}`);
  }

  emitResult(submissionId: string, payload: SubmissionCompletePayload) {
    if (!this.server) return;
    this.server.to(`submission:${submissionId}`).emit('submission:complete', payload);
  }
}
