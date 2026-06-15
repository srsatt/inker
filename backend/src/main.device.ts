import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DeviceRuntimeModule } from './device-runtime/device-runtime.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

process.env.PORT ||= '43337';
process.env.HOST ||= '0.0.0.0';
process.env.SCREEN_RENDERER_ENGINE ||= 'takumi';
process.env.NODE_ENV ||= 'production';

async function bootstrap() {
  const app = await NestFactory.create(DeviceRuntimeModule, {
    logger: ['log', 'warn', 'error'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 43337);
  const host = configService.get<string>('host', '0.0.0.0');

  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
  }

  await app.listen(port, host);
  console.log(`Inker device runtime listening at http://${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start Inker device runtime:', error);
  process.exit(1);
});
