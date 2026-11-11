// Format the written calendar components, never the browser's local timezone.
// Only complete ISO dates and timestamps with an explicit offset are accepted.
export function formatDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction, offset] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1]) return null;
  const date = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}, ${year}`;
  if (hour === undefined) return date;
  const h = Number(hour);
  if (h > 23 || Number(minute) > 59 || Number(second ?? 0) > 59) return null;
  if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59)) return null;
  const seconds = Number(second ?? 0) || fraction ? `:${second ?? '00'}${fraction ?? ''}` : '';
  const zone = offset === 'Z' ? 'UTC' : `UTC${offset.replace('-', '−')}`;
  return `${date} at ${h % 12 || 12}:${minute}${seconds} ${h < 12 ? 'AM' : 'PM'} (${zone})`;
}
