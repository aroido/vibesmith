export interface RelativeTimeResult {
  key: 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo' | 'weeksAgo';
  count: number;
}

export function getRelativeTime(dateString: string): RelativeTimeResult {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffMin < 1) return { key: 'justNow', count: 0 };
  if (diffHr < 1) return { key: 'minutesAgo', count: diffMin };
  if (diffDay < 1) return { key: 'hoursAgo', count: diffHr };
  if (diffDay < 7) return { key: 'daysAgo', count: diffDay };
  return { key: 'weeksAgo', count: diffWeek };
}
