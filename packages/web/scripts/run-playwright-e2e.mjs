import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;

function resolvePreferredPort() {
  const requestedPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? DEFAULT_PORT);
  return Number.isFinite(requestedPort) && requestedPort > 0
    ? requestedPort
    : DEFAULT_PORT;
}

function findAvailablePort(host, preferredPort) {
  const attemptPort = (port) =>
    new Promise((resolve, reject) => {
      const server = createServer();

      server.once('error', (error) => {
        server.close();
        reject(error);
      });

      server.listen(port, host, () => {
        const address = server.address();
        const resolvedPort =
          typeof address === 'object' && address ? address.port : port;
        server.close(() => resolve(resolvedPort));
      });
    });

  return attemptPort(preferredPort).catch(() => attemptPort(0));
}

const host = process.env.PLAYWRIGHT_WEB_HOST ?? DEFAULT_HOST;
const port = await findAvailablePort(host, resolvePreferredPort());
const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)];
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(npxCommand, playwrightArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_WEB_HOST: host,
    PLAYWRIGHT_WEB_PORT: String(port),
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
