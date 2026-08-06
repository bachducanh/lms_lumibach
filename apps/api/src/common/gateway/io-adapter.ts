import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/**
 * Cho phép socket.io phục vụ ở cả `/socket.io` lẫn `/socket.io/`.
 *
 * Mặc định engine.io chỉ nhận đường dẫn CÓ dấu `/` cuối. Khi client đi vòng qua
 * rewrite của Next.js (đường dự phòng long-polling lúc chưa cấu hình được
 * `path: ^/socket\.io` ở cloudflared), Next chuẩn hoá đường dẫn và bỏ mất dấu đó,
 * khiến request rơi vào router của Nest và trả 404.
 *
 * `addTrailingSlash: false` làm engine.io khớp theo tiền tố `/socket.io`, nên
 * nhận được cả hai dạng — kết nối trực tiếp vào cổng 4000 vẫn chạy như cũ.
 */
export class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, addTrailingSlash: false });
  }
}
