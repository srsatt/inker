import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const command = Bun.argv.slice(2);

if (command.length === 0) {
  console.error('Usage: bun run scripts/with-sqlite-env.ts <command> [...args]');
  process.exit(1);
}

await mkdir(join(import.meta.dir, '..', 'data'), { recursive: true });

const child = Bun.spawn(command, {
  cwd: join(import.meta.dir, '..'),
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || 'file:../data/inker.db',
  },
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
});

process.exit(await child.exited);
