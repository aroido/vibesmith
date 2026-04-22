const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

function loadAnalyticsIdentityModule(configHome) {
  const previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const previousHome = process.env.HOME;
  process.env.XDG_CONFIG_HOME = configHome;
  process.env.HOME = configHome;

  const modulePath = require.resolve('../.tmp-test-build/electron/analytics-identity.js');
  delete require.cache[modulePath];

  try {
    return require(modulePath);
  } finally {
    if (previousXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
    }

    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
  }
}

test('getAnalyticsIdentity persists a stable installation distinct id', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'vibesmith-analytics-identity-'));

  try {
    const { getAnalyticsIdentity } = loadAnalyticsIdentityModule(configHome);
    const firstIdentity = getAnalyticsIdentity();
    const secondIdentity = getAnalyticsIdentity();

    assert.equal(firstIdentity.scope, 'installation');
    assert.match(firstIdentity.distinctId, /^vbs-install-/);
    assert.equal(secondIdentity.distinctId, firstIdentity.distinctId);

    const reloadedIdentity =
      loadAnalyticsIdentityModule(configHome).getAnalyticsIdentity();
    assert.equal(reloadedIdentity.distinctId, firstIdentity.distinctId);
    assert.equal(reloadedIdentity.scope, 'installation');
  } finally {
    rmSync(configHome, { recursive: true, force: true });
  }
});
