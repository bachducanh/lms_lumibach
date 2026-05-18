import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@lumibach/db';
import { wsAuthenticate } from '../../common/gateway/ws-auth';

@WebSocketGateway({ namespace: '/quiz', cors: { origin: true, credentials: true } })
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  // attemptId → interval handle
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  // clientId → attemptId
  private readonly clientAttempts = new Map<string, string>();

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

  handleDisconnect(client: Socket) {
    const attemptId = this.clientAttempts.get(client.id);
    if (!attemptId) return;
    this.clientAttempts.delete(client.id);

    // Stop timer if no one else is watching this attempt
    const room = this.server?.sockets?.adapter?.rooms?.get(`attempt:${attemptId}`);
    if (!room || room.size === 0) {
      const timer = this.timers.get(attemptId);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(attemptId);
      }
    }
  }

  @SubscribeMessage('timer:start')
  async handleTimerStart(client: Socket, attemptId: string) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId, studentId: userId, status: 'IN_PROGRESS' },
      select: { startedAt: true, quiz: { select: { timeLimit: true } } },
    });

    if (!attempt?.quiz.timeLimit) return;

    await client.join(`attempt:${attemptId}`);
    this.clientAttempts.set(client.id, attemptId);

    const endMs = new Date(attempt.startedAt).getTime() + attempt.quiz.timeLimit * 60 * 1000;
    const getRemaining = () => Math.max(0, Math.ceil((endMs - Date.now()) / 1000));

    // Send authoritative time immediately
    client.emit('timer:sync', { remaining: getRemaining() });

    // Start server interval for this attempt (only once)
    if (!this.timers.has(attemptId)) {
      const interval = setInterval(() => {
        const remaining = getRemaining();
        this.server.to(`attempt:${attemptId}`).emit('timer:sync', { remaining });
        if (remaining <= 0) {
          this.server.to(`attempt:${attemptId}`).emit('quiz:expired');
          clearInterval(interval);
          this.timers.delete(attemptId);
        }
      }, 10_000);
      this.timers.set(attemptId, interval);
    }
  }
}
