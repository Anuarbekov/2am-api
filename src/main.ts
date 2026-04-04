import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

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
  console.log('WebSocket: ws://localhost:3000/telemetry');
  console.log('API Docs: http://localhost:3000/api/docs');
}
bootstrap();
