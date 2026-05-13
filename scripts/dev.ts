import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const singlePort = Bun.argv.includes('--single');
const skipMcp = Bun.argv.includes('--no-mcp') || process.env.INKER_DEV_MCP === '0';

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || 'file:../data/inker.db',
  HOST: process.env.HOST || '127.0.0.1',
  PORT: singlePort ? (process.env.SINGLE_PORT || '3337') : (process.env.PORT || '3338'),
  VITE_HOST: process.env.VITE_HOST || '127.0.0.1',
  VITE_PORT: process.env.VITE_PORT || '3337',
  VITE_BACKEND_PORT: process.env.VITE_BACKEND_PORT || process.env.PORT || '3338',
};

type Child = ReturnType<typeof Bun.spawn>;
type SpawnStdin = 'inherit' | 'pipe' | 'ignore';

async function runOnce(name: string, args: string[], cwd: string) {
  const child = Bun.spawn(args, {
    cwd,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await child.exited;

  if (exitCode !== 0) {
    throw new Error(`${name} exited with code ${exitCode}`);
  }
}

function spawn(name: string, args: string[], cwd: string, stdin: SpawnStdin = 'inherit'): Child {
  const child = Bun.spawn(args, {
    cwd,
    env,
    stdin,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  child.exited.then((exitCode) => {
    if (!shuttingDown && exitCode !== 0) {
      console.error(`${name} exited with code ${exitCode}`);
      shutdown(exitCode);
    }
  });

  return child;
}

let shuttingDown = false;
const children: Child[] = [];

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill();
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

await mkdir(join(backend, 'data'), { recursive: true });
await mkdir(join(backend, 'uploads', 'screens'), { recursive: true });
await mkdir(join(backend, 'uploads', 'firmware'), { recursive: true });
await mkdir(join(backend, 'uploads', 'widgets'), { recursive: true });
await mkdir(join(backend, 'uploads', 'captures'), { recursive: true });
await mkdir(join(backend, 'uploads', 'drawings'), { recursive: true });
await mkdir(join(backend, 'logs'), { recursive: true });

console.log('Preparing SQLite database...');
await runOnce('prisma db push', ['bun', 'run', 'prisma:push'], backend);
await runOnce('prisma seed', ['bun', 'run', 'prisma:seed'], backend);

if (singlePort) {
  console.log('Building frontend for single-port mode...');
  await runOnce('frontend build', ['bun', 'run', 'build'], frontend);
}

console.log(`Starting backend http://${env.HOST}:${env.PORT}`);
children.push(spawn('backend', ['bun', '--watch', 'src/main.ts'], backend));

if (!singlePort) {
  console.log(`Starting frontend http://${env.VITE_HOST}:${env.VITE_PORT}`);
  children.push(spawn('frontend', [
    'bunx',
    '--bun',
    'vite',
    '--host',
    env.VITE_HOST,
    '--port',
    env.VITE_PORT,
    '--strictPort',
  ], frontend));
}

if (!skipMcp) {
  console.log('Starting MCP server for local agent tooling');
  children.push(spawn('mcp', ['bun', 'run', '--silent', 'mcp'], root, 'pipe'));
}

await new Promise(() => {});
