import { io, type Socket } from 'socket.io-client';

const DEFAULT_API_PORT = '4000';

/** Cổng của NestJS, suy ra từ NEXT_PUBLIC_API_URL nếu đó là URL tuyệt đối. */
function getApiPort(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl?.startsWith('http')) {
    try {
      return new URL(apiUrl).port || DEFAULT_API_PORT;
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_API_PORT;
}

function getSocketOrigin(): string {
  // NEXT_PUBLIC_WS_URL là địa chỉ WebSocket chỉ định rõ. Cần thiết khi chạy sau
  // reverse-proxy / Cloudflare Tunnel, nơi WS không dùng chung cổng với API.
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    // URL không kèm cổng ⇒ đang chạy ở 443/80, tức sau reverse-proxy hoặc
    // Cloudflare Tunnel. Phải nối WS vào CÙNG origin: Cloudflare chỉ proxy vài
    // cổng nhất định (443, 2053, 2083, 2087, 2096, 8443) nên `:4000` sẽ chết.
    // cloudflared định tuyến riêng /socket.io sang NestJS — xem docs/DOMAIN_SETUP.md.
    if (!window.location.port) return window.location.origin;

    // Có cổng ⇒ truy cập trực tiếp (localhost hoặc IP LAN). Bám theo host đang
    // truy cập và chỉ đổi sang cổng API — hardcode localhost sẽ khiến máy khách
    // trong LAN nối vào chính nó và WebSocket không bao giờ kết nối được.
    return `${window.location.protocol}//${window.location.hostname}:${getApiPort()}`;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl?.startsWith('http')) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      /* fall through */
    }
  }
  return `http://localhost:${DEFAULT_API_PORT}`;
}

export function createSocket(namespace: string): Socket {
  return io(`${getSocketOrigin()}${namespace}`, {
    withCredentials: true,
    // Thứ tự có chủ đích: nối bằng long-polling trước, rồi socket.io tự nâng cấp
    // lên WebSocket nếu được. Sau Cloudflare Tunnel mà chưa có rule
    // `path: ^/socket\.io` thì WebSocket bị chặn — đặt 'websocket' trước sẽ phải
    // chờ nó thất bại mới lùi về polling, còn thế này thì kết nối được ngay.
    transports: ['polling', 'websocket'],
  });
}
