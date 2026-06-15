import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const stateDir = join(root, '.inker-proxy');
const statePath = join(stateDir, 'rpi.json');

const config = {
  user: process.env.RPI_USER || 'srsatt',
  host: process.env.RPI_HOST || 'birdnet-pi.local',
  key: process.env.RPI_KEY || '~/.ssh/birdnet-pi',
  publicPort: process.env.RPI_PUBLIC_PORT || '3337',
  tunnelPort: process.env.RPI_TUNNEL_PORT || '43337',
  localHost: process.env.RPI_LOCAL_HOST || '127.0.0.1',
  localPort: process.env.RPI_LOCAL_PORT || '3337',
};

type State = {
  sshPid?: number;
  remoteProxyPid?: number;
  publicPort: string;
  tunnelPort: string;
};

function sshArgs(remoteCommand?: string) {
  const args = [
    '-i', config.key,
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    `${config.user}@${config.host}`,
  ];
  if (remoteCommand) {
    args.push(remoteCommand);
  }
  return args;
}

async function run(args: string[], options: { quiet?: boolean } = {}) {
  const child = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  if (exitCode !== 0 && !options.quiet) {
    throw new Error(`${args.join(' ')}\n${stderr || stdout}`);
  }

  return { stdout, stderr, exitCode };
}

async function readState(): Promise<State | null> {
  try {
    return JSON.parse(await readFile(statePath, 'utf8')) as State;
  } catch {
    return null;
  }
}

async function killLocalPid(pid?: number) {
  if (!pid) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

async function remote(command: string, quiet = false) {
  return run(['ssh', ...sshArgs(command)], { quiet });
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function waitRemoteListen(port: string, label: string) {
  const result = await remote(
    `for i in 1 2 3 4 5 6 7 8 9 10; do ss -ltn '( sport = :${port} )' | grep -q LISTEN && exit 0; sleep 0.2; done; ss -ltn '( sport = :${port} )'`,
    true,
  );

  if (result.exitCode !== 0) {
    const log = await remote('tail -40 /tmp/inker-rpi-proxy.log 2>/dev/null || true', true);
    throw new Error(
      `${label} did not start on port ${port}.\n${result.stdout || result.stderr}${log.stdout ? `\nProxy log:\n${log.stdout}` : ''}`,
    );
  }
}

async function down() {
  const state = await readState();

  await killLocalPid(state?.sshPid);

  if (state?.remoteProxyPid) {
    await remote(`kill ${state.remoteProxyPid} 2>/dev/null || true`, true);
  }

  await remote(`pkill -f 'TARGET=.*${config.tunnelPort}' 2>/dev/null || true`, true);
  await rm(statePath, { force: true });
  console.log('RPi proxy down');
}

function proxyPython() {
  return [
    'import socket,threading,os',
    `TARGET=("127.0.0.1",${config.tunnelPort})`,
    'def close(sock):',
    '    try: sock.shutdown(socket.SHUT_RDWR)',
    '    except OSError: pass',
    '    try: sock.close()',
    '    except OSError: pass',
    'def pipe(src,dst):',
    '    try:',
    '        while True:',
    '            data=src.recv(65536)',
    '            if not data: break',
    '            dst.sendall(data)',
    '    except OSError: pass',
    '    finally:',
    '        close(src); close(dst)',
    'def handle(client):',
    '    try: upstream=socket.create_connection(TARGET)',
    '    except OSError:',
    '        close(client); return',
    '    threading.Thread(target=pipe,args=(client,upstream),daemon=True).start()',
    '    threading.Thread(target=pipe,args=(upstream,client),daemon=True).start()',
    'listener=socket.socket(socket.AF_INET,socket.SOCK_STREAM)',
    'listener.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)',
    `listener.bind(("0.0.0.0",${config.publicPort}))`,
    'listener.listen(128)',
    'print(os.getpid(), flush=True)',
    'while True:',
    '    client,addr=listener.accept()',
    '    threading.Thread(target=handle,args=(client,),daemon=True).start()',
  ].join('\n');
}

async function up() {
  await mkdir(stateDir, { recursive: true });
  await down();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`http://${config.localHost}:${config.localPort}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    throw new Error(`Nothing answers at http://${config.localHost}:${config.localPort}. Start Inker first, usually: bun run dev`);
  }

  let sshPid: number | undefined;
  const existingTunnel = await remote(`ss -ltn '( sport = :${config.tunnelPort} )'`, true);

  if (!existingTunnel.stdout.includes('LISTEN')) {
    const tunnel = Bun.spawn([
      'ssh',
      '-N',
      '-i', config.key,
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-R', `127.0.0.1:${config.tunnelPort}:${config.localHost}:${config.localPort}`,
      `${config.user}@${config.host}`,
    ], {
      stdout: 'ignore',
      stderr: 'pipe',
    });

    const quickExit = await Promise.race([
      tunnel.exited.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 700)),
    ]);

    if (quickExit) {
      const stderr = await new Response(tunnel.stderr).text();
      throw new Error(`SSH reverse tunnel failed:\n${stderr}`);
    }

    sshPid = tunnel.pid;
    await waitRemoteListen(config.tunnelPort, 'SSH reverse tunnel');
  } else {
    console.log(`Reusing existing Pi tunnel on 127.0.0.1:${config.tunnelPort}`);
  }

  const startProxy = await remote(`nohup python3 -u -c ${shellQuote(proxyPython())} >/tmp/inker-rpi-proxy.log 2>&1 & echo $!`);
  const remoteProxyPid = Number(startProxy.stdout.trim().split(/\s+/).at(-1));
  await waitRemoteListen(config.publicPort, 'RPi public proxy');

  const verify = await remote(`ss -ltn '( sport = :${config.publicPort} or sport = :${config.tunnelPort} )'`);
  await writeFile(statePath, JSON.stringify({
    sshPid,
    remoteProxyPid,
    publicPort: config.publicPort,
    tunnelPort: config.tunnelPort,
  } satisfies State, null, 2));

  const url = `http://${config.host}:${config.publicPort}`;
  const api = await fetch(`${url}/api/setup`).catch((error) => error);

  console.log(`RPi proxy up: ${url}`);
  console.log(`Local target: http://${config.localHost}:${config.localPort}`);
  console.log(`State: ${statePath}`);
  console.log(verify.stdout.trim());
  if (api instanceof Error) {
    console.log(`Verify API: failed (${api.message})`);
  } else {
    console.log(`Verify API: HTTP ${api.status}`);
  }
}

if (Bun.argv.includes('--down')) {
  await down();
} else {
  await up();
}
