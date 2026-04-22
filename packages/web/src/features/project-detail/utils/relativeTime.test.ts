// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRelativeTime } from './relativeTime';

describe('getRelativeTime', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('should return "justNow" for less than 1 minute ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:30Z'));
    expect(getRelativeTime('2026-01-01T12:00:00Z')).toEqual({ key: 'justNow', count: 0 });
  });

  it('should return minutes for less than 1 hour ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:05:00Z'));
    expect(getRelativeTime('2026-01-01T12:00:00Z')).toEqual({ key: 'minutesAgo', count: 5 });
  });

  it('should return hours for less than 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T15:00:00Z'));
    expect(getRelativeTime('2026-01-01T12:00:00Z')).toEqual({ key: 'hoursAgo', count: 3 });
  });

  it('should return days for less than 7 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-04T12:00:00Z'));
    expect(getRelativeTime('2026-01-01T12:00:00Z')).toEqual({ key: 'daysAgo', count: 3 });
  });

  it('should return weeks for 7+ days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(getRelativeTime('2026-01-01T12:00:00Z')).toEqual({ key: 'weeksAgo', count: 2 });
  });
});
