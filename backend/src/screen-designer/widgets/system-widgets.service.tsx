import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class BatteryWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'battery';
  constructor(private readonly style: WidgetStyleService) {}
  async render({ config, deviceContext }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const level = deviceContext?.battery ?? 85;
    return {
      content: <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{config.showIcon ? batteryIcon(level) : null}{config.showPercentage ? <span>{level}%</span> : null}</div>,
      style: { fontSize: `${config.fontSize || 16}px`, justifyContent: 'center', color: this.style.sanitizeColor(config.color || '#000000') },
    };
  }
}

@Injectable()
export class WifiWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'wifi';
  constructor(private readonly style: WidgetStyleService) {}
  async render({ config, deviceContext }: WidgetRenderContext): Promise<WidgetRenderResult> {
    return {
      content: <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{config.showIcon !== false ? wifiIcon() : null}{config.showStrength !== false ? <span>{deviceContext?.wifi ?? -55} dBm</span> : null}</div>,
      style: { fontSize: `${config.fontSize || 16}px`, justifyContent: 'center', color: this.style.sanitizeColor(config.color || '#000000') },
    };
  }
}

@Injectable()
export class DeviceInfoWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'deviceinfo';
  constructor(private readonly style: WidgetStyleService) {}
  async render({ config, deviceContext }: WidgetRenderContext): Promise<WidgetRenderResult> {
    return {
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          {config.showName !== false ? <div style={{ fontWeight: 'bold' }}>{deviceContext?.deviceName || 'TRMNL Device'}</div> : null}
          {config.showFirmware !== false ? <div style={{ color: '#666' }}>Firmware: {deviceContext?.firmwareVersion || 'v1.0.0'}</div> : null}
          {config.showMac ? <div style={{ color: '#888', fontSize: '12px' }}>{deviceContext?.macAddress || 'AA:BB:CC:DD:EE:FF'}</div> : null}
        </div>
      ),
      style: { fontSize: `${config.fontSize || 14}px`, justifyContent: 'center' },
    };
  }
}

function batteryIcon(level: number) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="6" width="18" height="12" rx="2" /><rect x="19" y="9" width="4" height="6" rx="1" /><rect x="3" y="8" width={Math.round((level / 100) * 14)} height="8" fill="currentColor" rx="1" /></svg>;
}

function wifiIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8.111 16.404a5.5 5.5 0 017.778 0" /><path d="M12 20h.01" /><path d="M4.93 13.071c3.904-3.905 10.236-3.905 14.141 0" /><path d="M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>;
}
