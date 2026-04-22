export type OpenReleaseNotesEventDetail = {
  version: string | null;
};

export const OPEN_RELEASE_NOTES_EVENT = 'vibesmith:open-release-notes';
export const RELEASE_NOTES_REQUEST_VERSION_KEY =
  'vibesmith.updater.pendingReleaseNotesVersion';

const ANY_VERSION = '*';

function normalizeVersion(version: string | null | undefined): string {
  if (typeof version !== 'string') {
    return '';
  }
  return version.trim();
}

export function requestOpenReleaseNotes(version?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedVersion = normalizeVersion(version);
  window.sessionStorage.setItem(
    RELEASE_NOTES_REQUEST_VERSION_KEY,
    normalizedVersion || ANY_VERSION
  );

  window.dispatchEvent(
    new CustomEvent<OpenReleaseNotesEventDetail>(OPEN_RELEASE_NOTES_EVENT, {
      detail: {
        version: normalizedVersion || null,
      },
    })
  );
}

export function consumePendingReleaseNotesRequest(version?: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const requestedVersion = window.sessionStorage.getItem(
    RELEASE_NOTES_REQUEST_VERSION_KEY
  );
  if (!requestedVersion) {
    return false;
  }

  const normalizedVersion = normalizeVersion(version);
  const matches =
    requestedVersion === ANY_VERSION ||
    normalizedVersion.length === 0 ||
    requestedVersion === normalizedVersion;

  if (matches) {
    window.sessionStorage.removeItem(RELEASE_NOTES_REQUEST_VERSION_KEY);
    return true;
  }

  return false;
}
