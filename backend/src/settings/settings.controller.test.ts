import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PinAuthGuard } from '../auth/guards/pin-auth.guard';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

describe('SettingsController (e2e)', () => {
  let app: INestApplication;

  const mockWelcomeConfig = { enabled: true, title: 'Hello World', subtitle: 'This is inker!', autoAssignPlaylist: true };

  const mockSettingsService = {
    getAll: async () => ({ github_token: null }),
    set: async () => undefined,
    delete: async () => undefined,
    testGitHubToken: async () => ({ valid: true, message: 'Token valid!' }),
    getWelcomeScreenConfig: async () => mockWelcomeConfig,
    setWelcomeScreenConfig: async (config: any) => config,
    invalidateDefaultScreen: async () => undefined,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    })
      .overrideGuard(PinAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /settings', () => {
    it('should return all settings', async () => {
      const response = await request(app.getHttpServer())
        .get('/settings')
        .expect(200);

      expect(response.body.data).toHaveProperty('github_token');
    });
  });

  describe('PUT /settings/:key', () => {
    it('should update a setting', async () => {
      const response = await request(app.getHttpServer())
        .put('/settings/github_token')
        .send({ value: 'ghp_test123' })
        .expect(200);

      expect(response.body.data).toHaveProperty('success', true);
    });
  });

  describe('DELETE /settings/:key', () => {
    it('should delete a setting', async () => {
      const response = await request(app.getHttpServer())
        .delete('/settings/github_token')
        .expect(200);

      expect(response.body.data).toHaveProperty('success', true);
    });
  });

  describe('GET /settings/welcome-screen', () => {
    it('should return welcome screen config', async () => {
      const response = await request(app.getHttpServer())
        .get('/settings/welcome-screen')
        .expect(200);

      expect(response.body.data).toHaveProperty('enabled', true);
      expect(response.body.data).toHaveProperty('title', 'Hello World');
    });
  });

  describe('PUT /settings/welcome-screen', () => {
    it('should save welcome screen config', async () => {
      const response = await request(app.getHttpServer())
        .put('/settings/welcome-screen')
        .send({ enabled: false, title: 'Test', subtitle: 'Sub', autoAssignPlaylist: false })
        .expect(200);

      expect(response.body.data).toHaveProperty('enabled', false);
      expect(response.body.data).toHaveProperty('title', 'Test');
    });

    it('should reject invalid config', async () => {
      await request(app.getHttpServer())
        .put('/settings/welcome-screen')
        .send({ enabled: 'not-a-bool' })
        .expect(400);
    });
  });

  describe('POST /settings/test-github-token', () => {
    it('should test a GitHub token', async () => {
      const response = await request(app.getHttpServer())
        .post('/settings/test-github-token')
        .send({ token: 'ghp_test123' })
        .expect(201);

      expect(response.body.data).toHaveProperty('valid', true);
    });
  });
});
