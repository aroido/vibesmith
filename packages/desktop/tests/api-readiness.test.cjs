const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const test = require('node:test');

const {
  API_HEALTH_PATH,
  checkApiReadiness,
  isVibeSmithHealthPayload,
} = require('../.tmp-test-build/electron/api-readiness.js');

async function startServer(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get dynamic test server port');
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server) {
  server.close();
  await once(server, 'close');
}

test('isVibeSmithHealthPayload validates expected signature', () => {
  assert.equal(
    isVibeSmithHealthPayload({
      status: 'ok',
      service: 'vibesmith-api',
      version: '0.1.0',
    }),
    true
  );
  assert.equal(
    isVibeSmithHealthPayload({
      status: 'ok',
      service: 'another-api',
    }),
    false
  );
  assert.equal(
    isVibeSmithHealthPayload({
      status: 'not-ok',
      service: 'vibesmith-api',
    }),
    false
  );
});

test('checkApiReadiness rejects 404 response (false positive guard)', async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    if (req.url === API_HEALTH_PATH) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const result = await checkApiReadiness(baseUrl);
    assert.equal(result.ready, false);
    if (!result.ready) {
      assert.equal(result.reason, 'http-error');
      assert.equal(result.status, 404);
    }
  } finally {
    await stopServer(server);
  }
});

test('checkApiReadiness rejects non-VibeSmith payload on 200', async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    if (req.url === API_HEALTH_PATH) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'other-service' }));
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const result = await checkApiReadiness(baseUrl);
    assert.equal(result.ready, false);
    if (!result.ready) {
      assert.equal(result.reason, 'unexpected-payload');
      assert.equal(result.status, 200);
    }
  } finally {
    await stopServer(server);
  }
});

test('checkApiReadiness accepts VibeSmith health payload', async () => {
  const { server, baseUrl } = await startServer((req, res) => {
    if (req.url === API_HEALTH_PATH) {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'vibesmith-api',
          version: '0.1.0',
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const result = await checkApiReadiness(baseUrl);
    assert.equal(result.ready, true);
    if (result.ready) {
      assert.equal(result.payload.service, 'vibesmith-api');
      assert.equal(result.payload.status, 'ok');
    }
  } finally {
    await stopServer(server);
  }
});
