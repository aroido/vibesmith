#!/usr/bin/env node

const { execFileSync, spawnSync } = require('node:child_process');

const VALID_TARGETS = new Set(['zip', 'dmg', 'dir']);
const TARGET_TO_SCRIPT = {
  zip: 'dist:mac:zip',
  dmg: 'dist:mac:dmg',
  dir: 'pack',
};

function log(message) {
  process.stdout.write(`[internal-mac-build] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[internal-mac-build] ${message}\n`);
  process.exit(1);
}

function runNpmScript(scriptName, env, dryRun) {
  if (dryRun) {
    log(`(dry-run) npm run ${scriptName}`);
    return;
  }

  const result = spawnSync('npm', ['run', scriptName], {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    fail(`Script failed: npm run ${scriptName}`);
  }
}

function normalizeIdentity(identity) {
  if (!identity) {
    return '';
  }

  return identity
    .replace(/^Developer ID Application:\s*/i, '')
    .replace(/^Apple Development:\s*/i, '')
    .trim();
}

function discoverSigningIdentity() {
  const fromEnv = normalizeIdentity(process.env.VIBESMITH_INTERNAL_SIGN_IDENTITY);
  if (fromEnv) {
    return {
      identity: fromEnv,
      source: 'env',
    };
  }

  try {
    const output = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8',
    });

    const developerIdMatches = [
      ...output.matchAll(/"Developer ID Application:\s*([^"]+)"/g),
    ].map((match) => match[1].trim());

    if (developerIdMatches.length > 0) {
      return {
        identity: normalizeIdentity(developerIdMatches[0]),
        source: 'keychain:developer-id',
      };
    }

    const appleDevelopmentMatches = [
      ...output.matchAll(/"Apple Development:\s*([^"]+)"/g),
    ].map((match) => match[1].trim());

    if (appleDevelopmentMatches.length > 0) {
      return {
        identity: normalizeIdentity(appleDevelopmentMatches[0]),
        source: 'keychain:apple-development',
      };
    }
  } catch (error) {
    log(`identity discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return null;
}

function resolveSignMode() {
  const raw = (process.env.VIBESMITH_INTERNAL_SIGN ?? 'auto').trim().toLowerCase();
  if (raw === 'auto' || raw === 'always' || raw === 'never') {
    return raw;
  }
  fail(`Invalid VIBESMITH_INTERNAL_SIGN value: "${raw}". Use one of: auto, always, never`);
}

function main() {
  if (process.platform !== 'darwin') {
    fail('This script only supports macOS.');
  }

  const target = process.argv[2] ?? 'zip';
  const dryRun = process.argv.includes('--dry-run');

  if (!VALID_TARGETS.has(target)) {
    fail(`Invalid target "${target}". Use one of: zip, dmg, dir`);
  }

  const signMode = resolveSignMode();
  const packagingScript = TARGET_TO_SCRIPT[target];
  const baseEnv = {
    ...process.env,
    VIBESMITH_BUILD_FLAVOR: 'internal',
  };

  let selectedIdentity = null;
  let signingEnabled = false;
  let fallbackToUnsigned = false;

  if (signMode !== 'never') {
    selectedIdentity = discoverSigningIdentity();
    signingEnabled = Boolean(selectedIdentity?.identity);

    if (!signingEnabled && signMode === 'always') {
      fail(
        'Signing identity not found. Set VIBESMITH_INTERNAL_SIGN_IDENTITY or install a local signing certificate.'
      );
    }

    if (!signingEnabled && signMode === 'auto') {
      fallbackToUnsigned = true;
    }
  } else {
    fallbackToUnsigned = true;
  }

  if (signingEnabled && selectedIdentity) {
    baseEnv.CSC_NAME = selectedIdentity.identity;
    delete baseEnv.CSC_IDENTITY_AUTO_DISCOVERY;
    log(
      `target=${target}, sign_mode=${signMode}, signing=enabled, identity="${selectedIdentity.identity}" (${selectedIdentity.source})`
    );
  } else {
    baseEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    delete baseEnv.CSC_NAME;
    log(`target=${target}, sign_mode=${signMode}, signing=disabled`);
    if (fallbackToUnsigned) {
      log(
        'unsigned internal build selected. On managed macOS this may be blocked by Gatekeeper/endpoint policy.'
      );
    }
  }

  runNpmScript('build:api-executable', baseEnv, dryRun);
  runNpmScript(packagingScript, baseEnv, dryRun);
}

main();
