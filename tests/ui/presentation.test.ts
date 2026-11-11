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
  setAttribute() {}
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
  runInNewContext(readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/, ''), {
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
  expect(text(amazon)).toContain(dataset.createdAt);
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
    expect(text(card)).toContain(source.retrievedAt);
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
