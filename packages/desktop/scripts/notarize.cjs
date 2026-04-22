#!/usr/bin/env node

const path = require('node:path');
const { notarize } = require('@electron/notarize');

function log(message) {
  process.stdout.write(`[notarize] ${message}\n`);
}

function resolveNotarizeOptions() {
  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (appleApiKey && appleApiKeyId && appleApiIssuer) {
    return {
      appleApiKey,
      appleApiKeyId,
      appleApiIssuer,
    };
  }

  const appleId = process.env.VIBESMITH_APPLE_ID || process.env.APPLE_ID;
  const appleIdPassword =
    process.env.VIBESMITH_APPLE_APP_SPECIFIC_PASSWORD ||
    process.env.APPLE_APP_SPECIFIC_PASSWORD ||
    process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.VIBESMITH_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID;

  if (appleId && appleIdPassword && teamId) {
    return {
      appleId,
      appleIdPassword,
      teamId,
    };
  }

  return null;
}

exports.default = async function notarizeApp(context) {
  if (process.env.SKIP_NOTARIZATION === '1') {
    log('Skipping notarization because SKIP_NOTARIZATION=1.');
    return;
  }

  if (context.electronPlatformName !== 'darwin') {
    log(`Skipping notarization for platform ${context.electronPlatformName}.`);
    return;
  }

  const options = resolveNotarizeOptions();
  if (!options) {
    log('Skipping notarization because Apple notarization credentials are not configured.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  log(`Submitting ${appPath} for notarization.`);
  await notarize({
    appPath,
    ...options,
  });
  log('Notarization completed successfully.');
};
