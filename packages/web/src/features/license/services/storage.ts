/**
 * License key local storage
 */

export const LICENSE_STORAGE_KEY = 'vibesmith-license-key';

export function getStoredLicenseKey(): string | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(LICENSE_STORAGE_KEY);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function setStoredLicenseKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LICENSE_STORAGE_KEY, key.trim());
}

export function clearStoredLicenseKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LICENSE_STORAGE_KEY);
}
