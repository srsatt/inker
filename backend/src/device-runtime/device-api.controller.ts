import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { DisplayService } from '../api/display/display.service';
import { DefaultScreenService } from '../api/display/default-screen.service';
import { LogService } from '../api/log/log.service';
import { SetupService } from '../api/setup/setup.service';
import { SetupScreenService } from '../api/setup/setup-screen.service';
import { ScreenRendererService } from '../screen-designer/services/screen-renderer.service';

@Controller('api')
export class DeviceApiController {
  private readonly logger = new Logger(DeviceApiController.name);

  constructor(
    private readonly displayService: DisplayService,
    private readonly defaultScreenService: DefaultScreenService,
    private readonly setupService: SetupService,
    private readonly setupScreenService: SetupScreenService,
    private readonly logService: LogService,
    private readonly screenRendererService: ScreenRendererService,
    private readonly configService: ConfigService,
  ) {}

  @Get('display')
  @HttpCode(HttpStatus.OK)
  async getDisplay(@Headers() headers: Record<string, string>) {
    const deviceApiKey = this.extractHeader(headers, [
      'http_id',
      'HTTP_ID',
      'Http-Id',
      'http-id',
      'id',
      'ID',
      'x-device-id',
      'device-id',
      'access-token',
      'Access-Token',
    ]);
    const base64 = this.extractHeader(headers, ['base64', 'BASE64', 'Base64']);
    const firmwareVersion = this.extractHeader(headers, [
      'http_fw_version',
      'HTTP_FW_VERSION',
      'Http-Fw-Version',
      'http-fw-version',
      'fw-version',
      'firmware-version',
      'Firmware-Version',
      'version',
    ]);
    const metrics = this.extractMetrics(headers);

    if (!deviceApiKey) {
      throw new UnprocessableEntityException({
        type: '/problem_details#device_id',
        status: 'unprocessable_content',
        detail: 'Invalid device ID.',
        instance: '/api/display',
        extensions: { errors: { HTTP_ID: ['is missing'] } },
      });
    }

    try {
      return await this.displayService.getDisplayContent(
        deviceApiKey,
        base64 === 'true',
        metrics,
        this.getBaseUrlFromRequest(headers),
        firmwareVersion,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          type: '/problem_details#device_id',
          status: 'not_found',
          detail: 'Invalid device ID.',
          instance: '/api/display',
        });
      }
      throw error;
    }
  }

  @Get('setup')
  @HttpCode(HttpStatus.OK)
  async getSetup(@Headers() headers: Record<string, string>) {
    const macAddress = this.extractHeader(headers, [
      'http_id',
      'HTTP_ID',
      'Http-Id',
      'http-id',
      'id',
      'ID',
      'mac-address',
      'mac_address',
      'x-device-id',
    ]);
    const firmwareVersion = this.extractHeader(headers, [
      'http_fw_version',
      'HTTP_FW_VERSION',
      'Http-Fw-Version',
      'http-fw-version',
      'fw-version',
      'firmware-version',
      'version',
    ]);
    const modelName = this.extractHeader(headers, [
      'http_model',
      'HTTP_MODEL',
      'Http-Model',
      'http-model',
      'model',
      'device-model',
      'x-device-model',
    ]);

    if (!macAddress) {
      throw new UnprocessableEntityException({
        type: '/problem_details#device_setup',
        status: 'unprocessable_content',
        detail: 'Invalid request headers.',
        instance: '/api/setup',
        extensions: { errors: { HTTP_ID: ['is missing'] } },
      });
    }

    try {
      const result = await this.setupService.provisionDevice(
        macAddress,
        firmwareVersion,
        this.extractMetrics(headers),
        this.getBaseUrlFromRequest(headers),
        modelName,
      );
      this.logger.log(`Device setup: ${macAddress}`);
      return result;
    } catch (error) {
      this.logger.error(`[SETUP] Device provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnprocessableEntityException({
        type: '/problem_details#device_setup',
        status: 'not_found',
        detail: 'Device setup failed',
        instance: '/api/setup',
      });
    }
  }

  @Get('setup/')
  @HttpCode(HttpStatus.OK)
  async getSetupLegacy(@Headers() headers: Record<string, string>) {
    return this.getSetup(headers);
  }

  @Post('log')
  @HttpCode(HttpStatus.OK)
  async createLog(@Headers() headers: Record<string, string>, @Body() body: any) {
    const deviceApiKey = this.extractHeader(headers, [
      'http_id',
      'HTTP_ID',
      'Http-Id',
      'http-id',
      'id',
      'ID',
      'x-device-id',
      'access-token',
      'Access-Token',
    ]);

    if (!deviceApiKey) {
      throw new UnprocessableEntityException({
        type: '/problem_details#device_log',
        status: 'unprocessable_content',
        detail: 'Device API key required',
        instance: '/api/log',
        extensions: { errors: { HTTP_ID: ['is missing'] } },
      });
    }

    return this.logService.createLog(deviceApiKey, body || {});
  }

  @Get('setup-screen.bmp')
  @HttpCode(HttpStatus.OK)
  async getSetupScreenBmp(@Res() res: Response) {
    const imageBuffer = await this.setupScreenService.getSetupScreenBmpBuffer();
    this.sendImage(res, imageBuffer, 'image/bmp', 'no-store');
  }

  @Get('default-screen.bmp')
  @HttpCode(HttpStatus.OK)
  async getDefaultScreenBmp(@Res() res: Response) {
    const imageBuffer = await this.defaultScreenService.getDefaultScreenBmpBuffer();
    this.sendImage(res, imageBuffer, 'image/bmp', 'no-store');
  }

  @Get('device-images/screen/:id')
  @HttpCode(HttpStatus.OK)
  async renderUploadedScreen(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const imageFormat = format === 'bmp' ? 'bmp' : 'png';
    const imageBuffer = await this.displayService.getScreenImageBuffer(id, imageFormat);
    this.sendImage(res, imageBuffer, imageFormat === 'bmp' ? 'image/bmp' : 'image/png');
  }

  @Get('device-images/design/:id')
  @HttpCode(HttpStatus.OK)
  async renderScreenDesignPublic(
    @Param('id', ParseIntPipe) id: number,
    @Query('battery') battery: string,
    @Query('wifi') wifi: string,
    @Query('deviceName') deviceName: string,
    @Query('firmwareVersion') firmwareVersion: string,
    @Query('macAddress') macAddress: string,
    @Query('mode') mode: string,
    @Query('format') format: string,
    @Query('preview') preview: string,
    @Res() res: Response,
  ) {
    try {
      const renderMode = this.getRenderMode(mode, preview);
      const imageFormat = format === 'bmp' && renderMode !== 'preview' ? 'bmp' : 'png';
      const imageBuffer = await this.screenRendererService.renderScreenDesign(
        id,
        this.getDeviceContext(battery, wifi, deviceName, firmwareVersion, macAddress),
        renderMode,
        imageFormat,
      );
      this.sendImage(res, imageBuffer, imageFormat === 'bmp' ? 'image/bmp' : 'image/png');
    } catch (error) {
      this.logger.error(`Failed to render screen design ${id}: ${error instanceof Error ? error.message : String(error)}`);
      const fallbackBuffer = await this.defaultScreenService.getDefaultScreenBuffer();
      this.sendImage(res, fallbackBuffer, 'image/png', 'no-store');
    }
  }

  @Get('device-images/playlist-composer/:id')
  @HttpCode(HttpStatus.OK)
  async renderPlaylistComposerPublic(
    @Param('id', ParseIntPipe) id: number,
    @Query('battery') battery: string,
    @Query('wifi') wifi: string,
    @Query('deviceName') deviceName: string,
    @Query('firmwareVersion') firmwareVersion: string,
    @Query('macAddress') macAddress: string,
    @Query('mode') mode: string,
    @Query('format') format: string,
    @Query('preview') preview: string,
    @Res() res: Response,
  ) {
    const renderMode = this.getRenderMode(mode, preview);
    const imageFormat = format === 'bmp' && renderMode !== 'preview' ? 'bmp' : 'png';
    const imageBuffer = await this.screenRendererService.renderPlaylistComposer(
      id,
      this.getDeviceContext(battery, wifi, deviceName, firmwareVersion, macAddress),
      renderMode,
      imageFormat,
    );
    this.sendImage(res, imageBuffer, imageFormat === 'bmp' ? 'image/bmp' : 'image/png');
  }

  private getBaseUrlFromRequest(headers: Record<string, string>): string {
    const configuredUrl = this.configService.get<string>('api.url');
    if (configuredUrl && configuredUrl !== `http://localhost:${this.configService.get('port', 43337)}`) {
      return configuredUrl;
    }

    let host = headers.host || headers.Host || `localhost:${this.configService.get('port', 43337)}`;
    const protocol = headers['x-forwarded-proto']
      || (headers['x-forwarded-ssl'] === 'on' ? 'https' : null)
      || (host.endsWith(':443') ? 'https' : null)
      || 'http';

    if (!host.includes(':')) {
      const inkerPort = this.configService.get<number>('inkerPort', 80);
      if (inkerPort && inkerPort !== 80) host = `${host}:${inkerPort}`;
    }

    return `${protocol}://${host}`;
  }

  private extractHeader(headers: Record<string, string>, possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      if (headers[name]) return headers[name];
    }
    const headerKeys = Object.keys(headers);
    for (const name of possibleNames) {
      const matchingKey = headerKeys.find((key) => key.toLowerCase() === name.toLowerCase());
      if (matchingKey && headers[matchingKey]) return headers[matchingKey];
    }
    return undefined;
  }

  private extractMetrics(headers: Record<string, string>): { battery?: number; wifi?: number } {
    const batteryVoltageStr = this.extractHeader(headers, [
      'battery-voltage',
      'Battery-Voltage',
      'battery_voltage',
      'batteryvoltage',
    ]);
    const rssiStr = this.extractHeader(headers, ['rssi', 'RSSI', 'Rssi', 'wifi-rssi', 'wifi_rssi']);
    const batteryVoltage = batteryVoltageStr ? parseFloat(batteryVoltageStr) : undefined;
    return {
      battery: batteryVoltage !== undefined && !isNaN(batteryVoltage)
        ? this.voltageToPercentage(batteryVoltage)
        : undefined,
      wifi: rssiStr ? parseInt(rssiStr, 10) : undefined,
    };
  }

  private voltageToPercentage(voltage: number): number {
    if (voltage >= 4.2) return 100;
    if (voltage <= 3.0) return 0;
    return Math.round(((voltage - 3.0) / 1.2) * 100);
  }

  private getRenderMode(mode: string, preview: string): 'device' | 'preview' | 'einkPreview' {
    if (mode === 'preview' || mode === 'einkPreview' || mode === 'device') return mode;
    if (preview === 'true' || preview === '1') return 'preview';
    return 'device';
  }

  private getDeviceContext(
    battery: string,
    wifi: string,
    deviceName: string,
    firmwareVersion: string,
    macAddress: string,
  ) {
    return {
      battery: battery ? parseFloat(battery) : undefined,
      wifi: wifi ? parseInt(wifi, 10) : undefined,
      deviceName: deviceName || undefined,
      firmwareVersion: firmwareVersion || undefined,
      macAddress: macAddress || undefined,
    };
  }

  private sendImage(
    res: Response,
    imageBuffer: Buffer,
    contentType: 'image/bmp' | 'image/png',
    cacheControl = 'no-store, no-cache, must-revalidate, proxy-revalidate',
  ) {
    res.set({
      'Content-Type': contentType,
      'Content-Length': imageBuffer.length,
      'Cache-Control': cacheControl,
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.send(imageBuffer);
  }
}
