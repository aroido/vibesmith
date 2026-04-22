#!/usr/bin/env node

const DEFAULT_REPO = "aroido/vibesmith";
const DEFAULT_TAP_REPO = "aroido/homebrew-vibesmith";
const DEFAULT_TAP_PATH = "Casks/vibesmith.rb";

function parseArgs(argv) {
  const options = {
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    tag: process.env.RELEASE_TAG || "",
    tapRepo: process.env.HOMEBREW_TAP_REPO || DEFAULT_TAP_REPO,
    tapPath: process.env.HOMEBREW_TAP_PATH || DEFAULT_TAP_PATH,
    token:
      process.env.HOMEBREW_TAP_GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_TOKEN ||
      "",
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--repo" && next) {
      options.repo = next;
      index += 1;
    } else if (current === "--tag" && next) {
      options.tag = next;
      index += 1;
    } else if (current === "--tap-repo" && next) {
      options.tapRepo = next;
      index += 1;
    } else if (current === "--tap-path" && next) {
      options.tapPath = next;
      index += 1;
    } else if (current === "--token" && next) {
      options.token = next;
      index += 1;
    } else if (current === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${current}`);
    }
  }

  if (!options.tag) {
    throw new Error("Missing required --tag argument or RELEASE_TAG environment variable.");
  }

  if (!options.token && !options.dryRun) {
    throw new Error(
      "Missing Homebrew tap GitHub token. Set HOMEBREW_TAP_GITHUB_TOKEN or use --token."
    );
  }

  return options;
}

function normalizeVersion(tag) {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

function createGithubHeaders(accept, token) {
  const headers = {
    Accept: accept,
    "User-Agent": "vibesmith-homebrew-sync",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function requestJson(url, token) {
  const response = await fetch(url, {
    headers: createGithubHeaders("application/vnd.github+json", token),
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function requestText(url, token) {
  const response = await fetch(url, {
    headers: createGithubHeaders("application/octet-stream", token),
  });

  if (!response.ok) {
    throw new Error(`GitHub asset request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

function selectDmgAsset(assets, version) {
  const matches = assets.filter((asset) => {
    const name = String(asset?.name || "");
    return name.endsWith(".dmg") && !name.endsWith(".dmg.blockmap");
  });

  if (matches.length === 0) {
    throw new Error("No DMG asset found on the GitHub release.");
  }

  const versionedName = `VibeSmith-${version}.dmg`;
  return (
    matches.find((asset) => asset.name === versionedName) ||
    matches.find((asset) => asset.name !== "VibeSmith.dmg") ||
    matches[0]
  );
}

async function resolveSha256(repo, release, dmgAsset, token) {
  const digest = String(dmgAsset?.digest || "");
  if (digest.startsWith("sha256:")) {
    return digest.slice("sha256:".length);
  }

  const checksumAsset = Array.isArray(release.assets)
    ? release.assets.find((asset) => asset?.name === "SHA256SUMS.txt")
    : null;

  if (!checksumAsset) {
    throw new Error("SHA256SUMS.txt was not found on the GitHub release.");
  }

  const checksumText = await requestText(
    `https://api.github.com/repos/${repo}/releases/assets/${checksumAsset.id}`,
    token
  );

  const line = checksumText
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.endsWith(` ${dmgAsset.name}`));

  if (!line) {
    throw new Error(`Unable to find a SHA256 entry for ${dmgAsset.name}.`);
  }

  const [sha256] = line.split(/\s+/);
  if (!sha256) {
    throw new Error(`Unable to parse SHA256 for ${dmgAsset.name}.`);
  }

  return sha256;
}

function buildCask(version, sha256, tag, assetName) {
  return `cask "vibesmith" do
  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/aroido/vibesmith/releases/download/${tag}/${assetName}"
  name "VibeSmith"
  desc "AI agent components manager for Claude Code and Cursor"
  homepage "https://github.com/aroido/vibesmith"

  depends_on arch: :arm64

  app "VibeSmith.app"

  auto_updates true

  zap trash: [
    "~/Library/Application Support/VibeSmith",
    "~/Library/Preferences/com.vibesmith.app.plist",
  ]
end
`;
}

function decodeBase64(content) {
  return Buffer.from(content, "base64").toString("utf8");
}

async function fetchTapFile(tapRepo, tapPath, token) {
  const file = await requestJson(
    `https://api.github.com/repos/${tapRepo}/contents/${tapPath}`,
    token
  );

  if (!file?.sha || !file?.content) {
    throw new Error(`Unable to load ${tapRepo}/${tapPath} from GitHub contents API.`);
  }

  return {
    sha: file.sha,
    content: decodeBase64(file.content.replace(/\n/g, "")),
  };
}

async function updateTapFile(tapRepo, tapPath, token, previousSha, nextContent, tag) {
  const response = await fetch(`https://api.github.com/repos/${tapRepo}/contents/${tapPath}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "vibesmith-homebrew-sync",
    },
    body: JSON.stringify({
      message: `chore: sync vibesmith cask for ${tag}`,
      content: Buffer.from(nextContent, "utf8").toString("base64"),
      sha: previousSha,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to update ${tapRepo}/${tapPath} (${response.status}): ${body}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const version = normalizeVersion(options.tag);
  const release = await requestJson(
    `https://api.github.com/repos/${options.repo}/releases/tags/${options.tag}`,
    options.token
  );

  const dmgAsset = selectDmgAsset(release.assets || [], version);
  const sha256 = await resolveSha256(options.repo, release, dmgAsset, options.token);
  const nextContent = buildCask(version, sha256, options.tag, dmgAsset.name);

  if (options.dryRun) {
    process.stdout.write(nextContent);
    return;
  }

  const currentFile = await fetchTapFile(options.tapRepo, options.tapPath, options.token);
  if (currentFile.content === nextContent) {
    console.log(`Homebrew tap already matches ${options.tag}.`);
    return;
  }

  await updateTapFile(
    options.tapRepo,
    options.tapPath,
    options.token,
    currentFile.sha,
    nextContent,
    options.tag
  );

  console.log(`Updated ${options.tapRepo}/${options.tapPath} for ${options.tag}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
