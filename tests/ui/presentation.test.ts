import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { createApi } from '../../src/api/index.js';
import { filterEvents } from '../../src/filter/index.js';
import { dataset } from '../acceptance/data.js';

// Small DOM surface used by the app; all HTTP calls stay in process.
class Node {
  children: Node[] = [];
  textContent = '';
  value = '';
  checked = false;
  hidden = false;
  dataset: Record<string, string> = {};
  href = '';
  listeners: Record<string, (...args: any[]) => any> = {};
  constructor(public tag = '') {}
  append(...nodes: Node[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; this.textContent = ''; }
  attributes: Record<string, string> = {};
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener(name: string, action: (...args: any[]) => any) { this.listeners[name] = action; }
  focus() {}
  scrollIntoView() {}
}
const text = (node: Node): string => [node.textContent, ...node.children.map(text)].join(' ');
const all = (node: Node): Node[] => [node, ...node.children.flatMap(all)];
async function browser(research = dataset) {
  const nodes = new Map<string, Node>();
  const get = (id: string) => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id)!; };
  const app = createApi(research, filterEvents);
  const requests: string[] = [];
  runInNewContext(readFileSync(new URL('../../public/dates.js', import.meta.url), 'utf8').replace('export function', 'function') + '\n' + readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, ''), {
    document: { getElementById: get, createElement: (tag: string) => new Node(tag),
      createTextNode: (value: string) => Object.assign(new Node(), { textContent: value }), querySelectorAll: () => [] },
    window: { localStorage: null }, URL, URLSearchParams, setTimeout,
    createShortlist: () => ({ has: () => false, toggle() {} }),
    fetch: (path: string) => { requests.push(path); return app.request(path); },
  });
  const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
  await settle();
  return { get, requests, settle };
}

test('cards and details label Amazon closed at the snapshot and preserve current events', async () => {
  const { get, settle } = await browser();
  const cards = get('cards').children;
  const amazon = cards.find(card => text(card).includes('Amazon'))!;
  expect(text(amazon)).toContain('Historical / closed example');
  expect(text(amazon)).toContain('Nov 11, 2026');
  expect(all(amazon).some(node => node.attributes.datetime === dataset.createdAt)).toBe(true);
  const paypal = cards.find(card => text(card).includes('PayPal'))!;
  expect(text(paypal)).not.toContain('Historical / closed example');
  for (const card of [amazon, paypal]) {
    await all(card).find(node => node.textContent === 'View details →')!.listeners.click();
    await settle();
    expect(text(get('detail')).includes('Historical / closed example')).toBe(card === amazon);
  }
  const earlier = await browser({ ...dataset, createdAt: '2026-10-01T00:00:00Z' });
  expect(text(earlier.get('cards'))).not.toContain('Historical / closed example');
});

test('conflicting fields retain competing citations; canonical UI categories reach API', async () => {
  const research = structuredClone(dataset);
  const event = research.events[0];
  const originals = research.findings.filter(finding => finding.eventId === event.id);
  const findings = [originals[0], originals.at(-1)!].map((finding, index) => ({
    ...finding, id: `synthetic-competing-${index}`, field: 'eligibility' as const,
    value: index ? 'open' : 'student-only', quote: 'Synthetic conflicting eligibility fixture',
  }));
  research.findings.push(...findings);
  event.fields.judging = { value: null, status: 'unknown', findingIds: [] };
  event.fields.eligibility = { value: null, status: 'conflicting', findingIds: findings.map(finding => finding.id) };
  const { get, requests, settle } = await browser(research);
  const card = get('cards').children[0];
  expect(text(card)).toContain('Conflicting source statements');
  for (const finding of findings) {
    const source = research.sources.find(source => source.id === finding.sourceId)!;
    expect(text(card)).toContain(finding.id);
    expect(all(card).some(node => node.attributes.datetime === source.retrievedAt)).toBe(true);
    expect(all(card).some(node => node.href === source.url)).toBe(true);
  }
  await all(card).find(node => node.textContent === 'View details →')!.listeners.click();
  await settle();
  expect(text(get('detail'))).toContain('Conflicting source statements');
  expect(text(get('detail'))).toContain('not verified');
  for (const category of ['student-only', 'open', 'unknown']) {
    get('eligibility').value = category;
    await get('eligibility').listeners.change();
    expect(requests.at(-1)).toBe(`/api/events?eligibility=${category}`);
  }
  const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
  for (const category of ['student-only', 'open', 'unknown']) expect(html).toContain(`value="${category}"`);
  expect(html).toContain('Eligibility categories do not determine whether you qualify');
});


test('readable dates reach cards, details, evidence and snapshot without changing raw quotes', async () => {
  const research = structuredClone(dataset);
  const event = research.events[0];
  event.fields.deadline.value = '2026-11-28T15:00:00-08:00';
  event.fields.eventDates.value = '2026-11-28';
  const finding = research.findings.find(item => item.eventId === event.id && item.field === 'deadline')!;
  finding.value = event.fields.deadline.value;
  finding.quote = 'Exact evidence: 2026-11-28T15:00:00-08:00';
  const before = JSON.stringify(research);
  const { get, settle } = await browser(research);
  const card = get('cards').children[0];
  const expected = 'Nov 28, 2026 at 3:00 PM (UTC−08:00)';
  expect(text(card)).toContain(expected);
  expect(text(get('identity'))).toContain('Nov 11, 2026');
  expect(all(get('identity')).find(node => node.tag === 'details') && text(all(get('identity')).find(node => node.tag === 'details')!)).toContain(research.runId);
  await all(card).find(node => node.textContent === 'View details →')!.listeners.click();
  await settle();
  expect(text(get('detail'))).toContain(expected);
  expect(all(get('detail')).some(node => node.tag === 'time' && node.attributes.datetime === '2026-11-28')).toBe(true);
  await all(card).find(node => node.textContent === 'Evidence')!.listeners.click();
  await settle();
  expect(text(get('evidence'))).toContain(expected);
  expect(all(get('evidence')).find(node => node.tag === 'blockquote' && node.textContent === finding.quote)).toBeDefined();
  expect(all(get('evidence')).some(node => node.attributes.datetime === finding.value)).toBe(true);
  expect(JSON.stringify(research)).toBe(before);
});

test('invalid and uncertain deadlines remain unverified with exact values available', async () => {
  for (const [value, status] of [['2026-02-30', 'verified'], [null, 'unknown'], ['2026-11-28T15:00:00-08:00', 'unknown'], ['2026-11-28', 'conflicting']] as const) {
    const research = structuredClone(dataset);
    research.events[0].fields.deadline = { value, status, findingIds: [] };
    const { get } = await browser(research);
    const card = get('cards').children[0];
    expect(text(card)).toContain(status === 'conflicting' ? 'Conflicting source statements' : 'Unknown — not verified');
    expect(text(card)).not.toContain('Invalid Date');
    if (value && status !== 'conflicting') expect(all(card).some(node => node.attributes.title === value)).toBe(true);
  }
});
