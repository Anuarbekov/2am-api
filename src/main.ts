import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SocketIoCorsAdapter } from './adapters/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.useWebSocketAdapter(new SocketIoCorsAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Locomotive Digital Twin API')
    .setDescription(
      'Backend for telemetry visualization with signal processing',
    )
    .setVersion('1.0')
    .addTag('telemetry')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
  console.log(
    'Socket.IO: namespace /telemetry (Postman “Socket.IO”, or socket.io-client)',
  );
  console.log(
    'Raw WebSocket: /ws/telemetry[?from=&to=], /ws/telemetry/history?from=&to=, /ws/telemetry/requestReplay?minutes= — JSON { event, data }',
  );
  console.log('Browser test page: http://localhost:3000/websocket-test.html');
  console.log('API Docs: http://localhost:3000/api/docs');
}
bootstrap();
