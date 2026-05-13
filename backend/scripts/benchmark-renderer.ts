import 'reflect-metadata';
import { execFileSync } from 'child_process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ScreenRendererService } from '../src/screen-designer/services/screen-renderer.service';

const screenId = Number(process.env.RENDER_BENCH_SCREEN_ID || '1');
const iterations = Number(process.env.RENDER_BENCH_ITERATIONS || '10');
const warmups = Number(process.env.RENDER_BENCH_WARMUPS || '2');
const engine = process.env.SCREEN_RENDERER_ENGINE || 'puppeteer';

interface Sample {
  index: number;
  ms: number;
  bytes: number;
  rssMb: number;
  treeRssMb: number;
  heapMb: number;
}

async function main() {
  forceGc();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const renderer = app.get(ScreenRendererService);

  try {
    for (let i = 0; i < warmups; i++) {
      await renderer.renderScreenDesign(screenId, undefined, 'preview', 'png');
      forceGc();
    }

    const before = memory();
    const samples: Sample[] = [];
    const totalStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const buffer = await renderer.renderScreenDesign(screenId, undefined, 'preview', 'png');
      const ms = performance.now() - start;
      const mem = memory();
      samples.push({ index: i + 1, ms, bytes: buffer.byteLength, rssMb: mem.rssMb, treeRssMb: treeRssMb(), heapMb: mem.heapMb });
    }

    forceGc();
    const after = memory();
    const totalMs = performance.now() - totalStart;
    const times = samples.map(sample => sample.ms);

    console.log(JSON.stringify({
      engine,
      screenId,
      warmups,
      iterations,
      totalMs: round(totalMs),
      avgMs: round(avg(times)),
      minMs: round(Math.min(...times)),
      maxMs: round(Math.max(...times)),
      p50Ms: round(percentile(times, 0.5)),
      p95Ms: round(percentile(times, 0.95)),
      outputBytes: samples.at(-1)?.bytes || 0,
      memory: {
        before,
        after,
        peakRssMb: round(Math.max(...samples.map(sample => sample.rssMb))),
        peakTreeRssMb: round(Math.max(...samples.map(sample => sample.treeRssMb))),
        peakHeapMb: round(Math.max(...samples.map(sample => sample.heapMb))),
      },
      samples: samples.map(sample => ({
        ...sample,
        ms: round(sample.ms),
        rssMb: round(sample.rssMb),
        treeRssMb: round(sample.treeRssMb),
        heapMb: round(sample.heapMb),
      })),
    }, null, 2));
  } finally {
    await app.close();
  }
}

function memory() {
  const usage = process.memoryUsage();
  return {
    rssMb: round(usage.rss / 1024 / 1024),
    heapMb: round(usage.heapUsed / 1024 / 1024),
    externalMb: round(usage.external / 1024 / 1024),
  };
}

function treeRssMb(): number {
  try {
    const pids = [process.pid, ...childPids(process.pid)];
    const rssKb = execFileSync('ps', ['-o', 'rss=', '-p', pids.join(',')], { encoding: 'utf8' })
      .split('\n')
      .map(line => Number(line.trim()))
      .filter(Number.isFinite)
      .reduce((sum, value) => sum + value, 0);
    return round(rssKb / 1024);
  } catch {
    return memory().rssMb;
  }
}

function childPids(pid: number): number[] {
  try {
    const direct = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
      .split('\n')
      .map(line => Number(line.trim()))
      .filter(Number.isFinite);
    return direct.flatMap(child => [child, ...childPids(child)]);
  } catch {
    return [];
  }
}

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value));
  return sorted[index];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function forceGc() {
  (globalThis as any).Bun?.gc?.(true);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
