import { io, type Socket } from 'socket.io-client';

function getSocketOrigin(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  try {
    return new URL(apiUrl).origin;
  } catch {
    return 'http://localhost:4000';
  }
}

export function createSocket(namespace: string): Socket {
  return io(`${getSocketOrigin()}${namespace}`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}
