import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';

const formatDate: (value: unknown) => string | null = runInNewContext(
  readFileSync(new URL('../../public/dates.js', import.meta.url), 'utf8').replace('export function', 'function') + '\nformatDate;',
);

test.each([
  ['2026-11-28T15:00:00-08:00', 'Nov 28, 2026 at 3:00 PM (UTC−08:00)'],
  ['2026-11-28', 'Nov 28, 2026'],
  ['2026-11-30T23:59:00+05:30', 'Nov 30, 2026 at 11:59 PM (UTC+05:30)'],
  ['2026-12-05T20:00:00Z', 'Dec 5, 2026 at 8:00 PM (UTC)'],
  ['2026-11-11T05:27:13.069Z', 'Nov 11, 2026 at 5:27:13.069 AM (UTC)'],
  ['2028-02-29', 'Feb 29, 2028'],
])('formats %s using its written calendar and offset', (input, expected) => {
  expect(formatDate(input)).toBe(expected);
});

test.each([null, undefined, '', 'unknown', '2026-02-29', '2026-04-31', '2026-13-01',
  '2026-11-28T24:00:00Z', '2026-11-28T12:60:00Z', '2026-11-28T12:00:60Z',
  '2026-11-28T12:00:00+24:00', '2026-11-28T12:00:00+05:60', '2026-11-28T12:00:00',
  'November 5 to December 5, 2026'])('rejects missing, invalid or prose value %s', input => {
  expect(formatDate(input)).toBeNull();
});
