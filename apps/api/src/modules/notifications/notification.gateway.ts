import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@lumibach/db';
import { wsAuthenticate } from '../../common/gateway/ws-auth';
import type { NotificationItem } from '@lumibach/types';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: true, credentials: true } })
export class NotificationGateway implements OnGatewayConnection {
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
    await client.join(`user:${user.id}`);
  }

  emitToUser(userId: string, notification: NotificationItem) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
