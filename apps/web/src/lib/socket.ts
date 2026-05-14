import { io, type Socket } from 'socket.io-client';

function getSocketOrigin(): string {
  // NEXT_PUBLIC_WS_URL is the explicit WebSocket server origin.
  // WebSocket connections can't go through Next.js rewrites so they need
  // a direct URL to the NestJS server.
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  if (apiUrl.startsWith('http')) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      /* fall through */
    }
  }
  // NEXT_PUBLIC_API_URL is relative (rewrite mode) — WS falls back to current origin
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';
}

export function createSocket(namespace: string): Socket {
  return io(`${getSocketOrigin()}${namespace}`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}
