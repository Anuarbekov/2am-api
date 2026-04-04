import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';

export class SocketIoCorsAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
      },
    } as ServerOptions);
  }
}
