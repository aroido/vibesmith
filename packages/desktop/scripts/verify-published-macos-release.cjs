#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { _electron: electron } = require('@playwright/test');

function parseArgs(argv) {
  const options = {
    repo: process.env.GITHUB_REPOSITORY || '',
    tag: process.env.RELEASE_TAG || '',
    outputDir: process.env.VIBESMITH_RELEASE_VERIFY_OUTPUT_DIR || '',
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--repo' && next) {
      options.repo = next;
      index += 1;
    } else if (current === '--tag' && next) {
      options.tag = next;
      index += 1;
    } else if (current === '--output-dir' && next) {
      options.outputDir = next;
      index += 1;
    } else if (current === '--token' && next) {
      options.token = next;
      index += 1;
    }
  }

  if (!options.repo) {
    throw new Error('Missing required --repo argument or GITHUB_REPOSITORY environment variable.');
  }
  if (!options.tag) {
    throw new Error('Missing required --tag argument or RELEASE_TAG environment variable.');
  }

  return options;
}

async function requestJson(url, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vibesmith-release-verifier',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub API request failed (${response.status}) for ${url}: ${body}`);
  }

  return response.json();
}

async function downloadAsset(asset, targetPath, token) {
  const headers = {
    Accept: 'application/octet-stream',
    'User-Agent': 'vibesmith-release-verifier',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const assetApiUrl = `https://api.github.com/repos/${asset.repo}/releases/assets/${asset.id}`;
  let response = await fetch(assetApiUrl, {
    headers,
    redirect: 'follow',
  });

  if (!response.ok) {
    response = await fetch(asset.browser_download_url, {
      headers: {
        'User-Agent': 'vibesmith-release-verifier',
      },
      redirect: 'follow',
    });
  }

  if (!response.ok) {
    throw new Error(`Failed to download ${asset.name} (${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, bytes);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRelease(repo, tag, token) {
  const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    try {
      const release = await requestJson(releaseUrl, token);
      if (Array.isArray(release.assets) && release.assets.length > 0) {
        return release;
      }
    } catch (error) {
      if (attempt === 17) {
        throw error;
      }
    }

    await sleep(5_000);
  }

  throw new Error(`Timed out waiting for release assets for ${repo}@${tag}.`);
}

function parseLatestMacYml(yamlText) {
  const pathMatch = yamlText.match(/^path:\s*(.+)$/m);
  const shaMatch = yamlText.match(/^sha512:\s*(.+)$/m);
  if (!pathMatch || !shaMatch) {
    throw new Error('latest-mac.yml is missing required path/sha512 fields.');
  }

  return {
    zipName: pathMatch[1].trim(),
    sha512: shaMatch[1].trim(),
  };
}

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(readFileSync(filePath));
  return hash.digest('base64');
}

function runChecked(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function findAppBundle(mountPoint) {
  const result = runChecked('find', [mountPoint, '-maxdepth', '2', '-type', 'd', '-name', '*.app']);
  const appPath = result
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!appPath) {
    throw new Error(`No .app bundle found inside mounted DMG at ${mountPoint}.`);
  }

  return appPath;
}

function resolveMountPoint(hdiutilOutput) {
  const match = hdiutilOutput.match(/\/Volumes\/[^\n]+/);
  if (!match) {
    throw new Error(`Unable to determine DMG mount point from output:\n${hdiutilOutput}`);
  }
  return match[0].trim();
}

function isMainWindowUrl(url) {
  if (!url) {
    return false;
  }
  if (url.includes('splash.html')) {
    return false;
  }
  return url.includes('index.html') || url.includes('#/');
}

async function waitForMainWindow(app, timeoutMs = 30_000) {
  const startedAt = Date.now();
  const seenUrls = new Set();

  while (Date.now() - startedAt < timeoutMs) {
    for (const windowPage of app.windows()) {
      const url = windowPage.url();
      if (url) {
        seenUrls.add(url);
      }
      if (isMainWindowUrl(url)) {
        return windowPage;
      }
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }

    const nextWindow = await app.waitForEvent('window', {
      timeout: Math.min(2_000, remainingMs),
    }).catch(() => null);

    if (nextWindow) {
      const nextUrl = nextWindow.url();
      if (nextUrl) {
        seenUrls.add(nextUrl);
      }
      if (isMainWindowUrl(nextUrl)) {
        return nextWindow;
      }
    }
  }

  throw new Error(
    `Main window was not found within ${timeoutMs}ms. Seen URLs: ${Array.from(seenUrls).join(', ') || '(none)'}`
  );
}

function isPostHogEventEndpoint(url) {
  if (!url.includes('posthog.com')) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.includes('/i/v0/e/') || parsed.pathname.includes('/e/');
  } catch {
    return false;
  }
}

function parsePostHogRequest(request) {
  if (!isPostHogEventEndpoint(request.url())) {
    return null;
  }

  const postData = request.postData();
  if (!postData) {
    return null;
  }

  try {
    const payload = JSON.parse(postData);
    if (typeof payload.event !== 'string' || !payload.properties || typeof payload.properties !== 'object') {
      return null;
    }

    return {
      eventName: payload.event,
      properties: payload.properties,
    };
  } catch {
    return null;
  }
}

async function waitForAnalyticsReady(page) {
  const startedAt = Date.now();
  let lastStatus = null;

  while (Date.now() - startedAt < 20_000) {
    lastStatus = await page.evaluate(() => {
      return window.__vibesmithAnalytics?.getStatus?.() ?? null;
    });

    if (
      lastStatus?.configured === true &&
      lastStatus?.ready === true &&
      lastStatus?.enabled === true
    ) {
      return lastStatus;
    }

    await sleep(1_000);
  }

  throw new Error(`Analytics did not become ready. Last status: ${JSON.stringify(lastStatus)}`);
}

async function waitForPostHogEvent(page, eventName, matcher) {
  const request = await page.waitForRequest(
    (nextRequest) => {
      const parsed = parsePostHogRequest(nextRequest);
      return parsed?.eventName === eventName && matcher(parsed.properties);
    },
    { timeout: 20_000 }
  );

  const parsed = parsePostHogRequest(request);
  if (!parsed) {
    throw new Error(`Failed to parse PostHog request for ${eventName}.`);
  }
  return parsed;
}

function writeReport(outputDir, report, failed) {
  mkdirSync(outputDir, { recursive: true });

  const summaryLines = [
    '# Published macOS release verification',
    '',
    `- Repository: \`${report.repo}\``,
    `- Tag: \`${report.tag}\``,
    `- DMG: \`${report.assets.dmgName || 'n/a'}\``,
    `- ZIP: \`${report.assets.zipName || 'n/a'}\``,
    `- latest-mac.yml: \`${report.assets.latestMacYmlName || 'n/a'}\``,
    `- latest-mac sha512 match: \`${report.checks.sha512Matches === true ? 'ok' : 'failed'}\``,
    `- codesign verify: \`${report.checks.codesignVerified === true ? 'ok' : 'failed'}\``,
    `- spctl accepted: \`${report.checks.spctlAccepted === true ? 'ok' : 'failed'}\``,
    `- notarized developer id: \`${report.checks.notarizedDeveloperId === true ? 'ok' : 'failed'}\``,
    `- onboarding visible on clean profile: \`${report.checks.onboardingVisible === true ? 'ok' : 'failed'}\``,
    `- analytics ready: \`${report.checks.analyticsReady === true ? 'ok' : 'failed'}\``,
    `- PostHog transport seen: \`${report.checks.posthogTransportSeen === true ? 'ok' : 'failed'}\``,
  ];

  if (failed) {
    summaryLines.push('', `- Failure: ${failed.message}`);
  }

  if (report.spctlOutput) {
    summaryLines.push('', '## spctl output', '', '```text', report.spctlOutput.trim(), '```');
  }

  writeFileSync(path.join(outputDir, 'summary.md'), `${summaryLines.join('\n')}\n`, 'utf8');
  writeFileSync(path.join(outputDir, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv);
  const outputDir = options.outputDir || path.resolve(process.cwd(), 'packages/desktop/.tmp-release-verify-report');
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'vibesmith-release-verify-'));
  const downloadsDir = path.join(tempRoot, 'downloads');
  const mountedCopyDir = path.join(tempRoot, 'mounted-app');
  const isolatedUserDataDir = path.join(tempRoot, 'user-data');
  mkdirSync(downloadsDir, { recursive: true });
  mkdirSync(mountedCopyDir, { recursive: true });
  mkdirSync(isolatedUserDataDir, { recursive: true });

  const report = {
    repo: options.repo,
    tag: options.tag,
    assets: {},
    checks: {},
    runtime: {},
    spctlOutput: '',
  };

  let mountPoint = null;
  let electronApp = null;

  try {
    const release = await waitForRelease(options.repo, options.tag, options.token);
    const assets = release.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      repo: options.repo,
      browser_download_url: asset.browser_download_url,
    }));

    const latestMacYmlAsset = assets.find((asset) => asset.name.endsWith('latest-mac.yml'));
    const dmgAsset = assets.find((asset) => asset.name === 'VibeSmith.dmg') || assets.find((asset) => asset.name.endsWith('.dmg'));

    assert(latestMacYmlAsset, 'Unable to find latest-mac.yml in published release assets.');
    assert(dmgAsset, 'Unable to find a DMG asset in published release assets.');

    const latestMacYmlPath = path.join(downloadsDir, latestMacYmlAsset.name);
    const dmgPath = path.join(downloadsDir, dmgAsset.name);

    await downloadAsset(latestMacYmlAsset, latestMacYmlPath, options.token);
    await downloadAsset(dmgAsset, dmgPath, options.token);

    const latestMacYml = parseLatestMacYml(readFileSync(latestMacYmlPath, 'utf8'));
    const zipAsset = assets.find((asset) => asset.name === latestMacYml.zipName);
    assert(zipAsset, `Unable to find ZIP asset referenced by latest-mac.yml: ${latestMacYml.zipName}`);

    const zipPath = path.join(downloadsDir, zipAsset.name);
    await downloadAsset(zipAsset, zipPath, options.token);

    report.assets = {
      dmgName: dmgAsset.name,
      zipName: zipAsset.name,
      latestMacYmlName: latestMacYmlAsset.name,
    };

    const zipSha512 = sha512Base64(zipPath);
    report.checks.sha512Matches = zipSha512 === latestMacYml.sha512;
    assert(report.checks.sha512Matches, 'latest-mac.yml sha512 does not match the downloaded ZIP asset.');

    const hdiutilOutput = runChecked('hdiutil', ['attach', '-nobrowse', '-readonly', dmgPath]);
    mountPoint = resolveMountPoint(hdiutilOutput);

    const sourceAppPath = findAppBundle(mountPoint);
    const copiedAppPath = path.join(mountedCopyDir, path.basename(sourceAppPath));
    runChecked('cp', ['-R', sourceAppPath, copiedAppPath]);

    const binaryName = path.basename(copiedAppPath, '.app');
    const executablePath = path.join(copiedAppPath, 'Contents', 'MacOS', binaryName);

    runChecked('codesign', ['--verify', '--deep', '--strict', copiedAppPath]);
    report.checks.codesignVerified = true;

    const spctlResult = spawnSync('spctl', ['-a', '-vv', copiedAppPath], {
      encoding: 'utf8',
    });
    report.spctlOutput = `${spctlResult.stdout || ''}\n${spctlResult.stderr || ''}`.trim();
    assert.equal(spctlResult.status, 0, `spctl rejected the app bundle.\n${report.spctlOutput}`);
    report.checks.spctlAccepted = /accepted/i.test(report.spctlOutput);
    report.checks.notarizedDeveloperId = /Notarized Developer ID/i.test(report.spctlOutput);
    assert(report.checks.spctlAccepted, `spctl did not report accepted status.\n${report.spctlOutput}`);
    assert(report.checks.notarizedDeveloperId, `spctl did not report Notarized Developer ID.\n${report.spctlOutput}`);

    electronApp = await electron.launch({
      executablePath,
      args: [],
      env: {
        ...process.env,
        VIBESMITH_USER_DATA_DIR: isolatedUserDataDir,
        VIBESMITH_POSTHOG_ALLOW_WEBDRIVER: 'true',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    const runtimePaths = await electronApp.evaluate(({ app }) => {
      return {
        userData: app.getPath('userData'),
        sessionData: app.getPath('sessionData'),
        logs: app.getPath('logs'),
      };
    });
    report.runtime.paths = runtimePaths;
    assert.equal(runtimePaths.userData, isolatedUserDataDir, 'Release app did not honor VIBESMITH_USER_DATA_DIR.');

    const page = await waitForMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');

    const onboardingPopover = page.locator('.driver-popover').first();
    report.checks.onboardingVisible = await onboardingPopover.isVisible({ timeout: 15_000 }).catch(() => false);
    assert(report.checks.onboardingVisible, 'Onboarding popover did not appear for the clean release profile.');

    report.runtime.onboardingState = await page.evaluate(() => {
      return {
        onboardingStatus: window.localStorage.getItem('vibesmith_onboarding_status'),
        driverActive: document.querySelector('.driver-popover') !== null,
      };
    });
    assert.equal(report.runtime.onboardingState.onboardingStatus, null, 'Clean release profile unexpectedly had onboarding state.');
    assert.equal(report.runtime.onboardingState.driverActive, true, 'Driver onboarding overlay was not active.');

    const analyticsStatus = await waitForAnalyticsReady(page);
    report.checks.analyticsReady = true;
    report.runtime.analyticsStatus = analyticsStatus;

    const verificationEventName = 'release_artifact_verification';
    const posthogEventPromise = waitForPostHogEvent(
      page,
      verificationEventName,
      (properties) => properties.source === 'github_actions_release_verify'
    );
    await page.evaluate(async (eventName) => {
      await window.__vibesmithAnalytics?.track?.(eventName, {
        source: 'github_actions_release_verify',
      });
      await window.__vibesmithAnalytics?.forceFlush?.();
    }, verificationEventName);
    const posthogRequest = await posthogEventPromise;
    report.checks.posthogTransportSeen = true;
    report.runtime.posthogRequest = {
      eventName: posthogRequest.eventName,
      properties: {
        source: posthogRequest.properties.source,
      },
    };

    writeReport(outputDir, report, null);
  } catch (error) {
    writeReport(outputDir, report, error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    if (electronApp) {
      await electronApp.close().catch(() => {});
    }
    if (mountPoint) {
      spawnSync('hdiutil', ['detach', mountPoint, '-force'], { encoding: 'utf8' });
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
