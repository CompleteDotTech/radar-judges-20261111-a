import { createShortlist } from './shortlist.js';

const $ = id => document.getElementById(id);
const labels = { location: 'Location', attendanceMode: 'Attendance', eventDates: 'Event dates', deadline: 'Submission deadline', timezone: 'Timezone', eligibility: 'Eligibility category', prizes: 'Prizes', judging: 'Judging', deliverables: 'What to submit' };
let dataset, shortlist, events = [], requestVersion = 0;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function link(text, url) {
  const node = el('a', text);
  try {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) {
      node.href = parsed.href; node.target = '_blank'; node.rel = 'noopener noreferrer';
    }
  } catch { /* Invalid URLs remain plain text. */ }
  return node;
}
function button(text, action, quiet = false) {
  const node = el('button', text, quiet ? 'quiet' : undefined);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
async function api(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try { const body = await response.json(); if (body.error) message = body.error; } catch { /* Use status. */ }
    throw new Error(message);
  }
  return response.json();
}
function showError(error) {
  $('error').textContent = `Could not load events: ${error.message}`;
  $('error').hidden = false; $('retry').hidden = false;
}
function claim(event, fieldName, research = dataset) {
  const field = event.fields[fieldName];
  const group = el('div', undefined, 'claim');
  const title = el('dt', labels[fieldName]);
  title.append(el('span', field.status, `status ${field.status}`));
  const conflicting = ['conflict', 'conflicting'].includes(field.status);
  const value = el('dd', conflicting ? 'Conflicting source statements. Review all competing findings.' : field.value ?? 'Unknown — not verified in this research.');
  if (!conflicting && field.status !== 'verified' && field.value !== null) value.append(el('p', 'Not verified in this research.'));
  for (const findingId of field.findingIds) {
    const finding = research.findings.find(item => item.id === findingId);
    const source = finding && research.sources.find(item => item.id === finding.sourceId);
    const citation = el('span', undefined, 'citation');
    if (source) {
      citation.append(link(`Source · ${source.title}`, source.url), document.createTextNode(` · Retrieved ${source.retrievedAt}`));
      citation.append(el('span', ` · ${findingId} · ${source.id}`));
    } else citation.textContent = `Evidence unavailable · ${findingId}`;
    value.append(citation);
  }
  group.append(title, value); return group;
}
function closedExample(event) {
  const deadline = event.fields.deadline;
  if (deadline.status !== 'verified' || !deadline.value) return null;
  const instant = Date.parse(deadline.value);
  const reference = Date.parse(dataset.createdAt);
  return Number.isFinite(instant) && Number.isFinite(reference) && instant < reference
    ? el('p', `Historical / closed example — submissions closed before this research snapshot (${dataset.createdAt}).`, 'note') : null;
}
function saveButton(event) {
  const node = button('', () => {
    shortlist.toggle(event.id); renderCards();
    document.querySelectorAll('[data-save-id]').forEach(item => {
      const saved = shortlist.has(item.dataset.saveId);
      item.textContent = saved ? 'Saved ✓' : 'Save event +';
      item.setAttribute('aria-pressed', String(saved));
    });
  }, true);
  node.dataset.saveId = event.id;
  node.textContent = shortlist.has(event.id) ? 'Saved ✓' : 'Save event +';
  node.setAttribute('aria-pressed', String(shortlist.has(event.id)));
  node.setAttribute('aria-label', `Save ${event.name}`);
  return node;
}
function renderCards() {
  const visible = events.filter(event => !$('saved').checked || shortlist.has(event.id));
  $('saved-count').textContent = dataset.events.filter(event => shortlist.has(event.id)).length;
  $('cards').replaceChildren();
  $('result-count').textContent = `${visible.length} of ${dataset.events.length} events${$('saved').checked ? ' · saved shortlist' : ''}`;
  for (const event of visible) {
    const card = el('article', undefined, 'card');
    const top = el('div', undefined, 'card-top');
    top.append(el('span', `EVENT ${String(dataset.events.findIndex(item => item.id === event.id) + 1).padStart(2, '0')}`, 'number'), saveButton(event));
    const official = link('Official website ↗', event.officialUrl); official.className = 'official';
    const fields = el('dl', undefined, 'fields');
    for (const key of ['attendanceMode', 'deadline', 'timezone', 'eligibility']) fields.append(claim(event, key));
    const actions = el('div', undefined, 'actions');
    actions.append(button('View details →', () => openEvent(event.id, false)), button('Evidence', () => openEvent(event.id, true), true));
    card.append(top, el('h3', event.name));
    const closed = closedExample(event);
    if (closed) card.append(closed);
    card.append(official, fields, actions);
    $('cards').append(card);
  }
  if (!visible.length) $('cards').append(el('p', 'No events match these filters. Try resetting the filters or saving an event first.', 'empty'));
}
let panelVersion = 0;
async function openEvent(id, showEvidence) {
  const version = ++panelVersion;
  const target = showEvidence ? $('evidence') : $('detail');
  $('detail').hidden = true; $('evidence').hidden = true;
  target.hidden = false; target.replaceChildren(el('p', 'Loading…')); target.focus();
  try {
    const research = await api(`/api/events/${encodeURIComponent(id)}`);
    if (version !== panelVersion) return;
    const event = research.event;
    target.replaceChildren(button('Close ×', () => { ++panelVersion; target.hidden = true; $('cards').scrollIntoView({ block: 'start' }); }, true), el('p', showEvidence ? 'THE SOURCE NOTES' : 'A CLOSER LOOK', 'eyebrow'), el('h2', event.name), link('Read official rules and restrictions ↗', event.officialUrl));
    const closed = closedExample(event);
    if (closed) target.append(closed);
    if (!showEvidence) {
      target.append(el('p', 'Eligibility is a category, not confirmation that you qualify. Read the official restrictions.', 'note'));
      const fields = el('dl', undefined, 'fields');
      for (const key of Object.keys(labels)) fields.append(claim(event, key, research));
      target.append(fields);
      const actions = el('div', undefined, 'actions');
      actions.append(saveButton(event), button('Read source evidence →', () => openEvent(id, true)));
      target.append(actions);
    } else {
      target.append(el('p', 'Original research quotations are displayed as source material. Unknown fields have no verified claim. Conflicting claims remain visible.', 'note'));
      const unknowns = Object.keys(labels).filter(key => event.fields[key].status !== 'verified');
      if (unknowns.length) target.append(el('p', `Uncertain fields: ${unknowns.map(key => `${labels[key]} (${event.fields[key].status})`).join(', ')}`));
      for (const finding of research.findings) {
        const source = research.sources.find(item => item.id === finding.sourceId);
        const section = el('article', undefined, 'evidence-item');
        section.append(el('h3', `${labels[finding.field] ?? finding.field} · ${finding.status}`), el('p', finding.value), el('blockquote', finding.quote));
        if (source) section.append(link(source.title, source.url), el('p', `Retrieved ${source.retrievedAt} · Source ${source.id}`, 'metadata'));
        section.append(el('p', `Finding ${finding.id} · Role ${finding.role} · Event ${finding.eventId}`, 'metadata'));
        target.append(section);
      }
      if (!research.findings.length) target.append(el('p', 'No claim evidence is available for this event.'));
      target.append(button('Back to details', () => openEvent(id, false), true));
    }
    target.scrollIntoView({ block: 'start' });
  } catch (error) {
    if (version !== panelVersion) return;
    target.replaceChildren(el('p', `Could not load this event: ${error.message}`), button('Try again', () => openEvent(id, showEvidence)), button('Close', () => { target.hidden = true; }, true));
  }
}
async function loadEvents() {
  if (!dataset) return;
  const version = ++requestVersion;
  $('cards').setAttribute('aria-busy', 'true');
  $('error').hidden = true; $('retry').hidden = true;
  const params = new URLSearchParams();
  for (const key of ['mode', 'eligibility', 'after']) if ($(key).value) params.set(key, $(key).value);
  try {
    const response = await api(`/api/events${params.size ? `?${params}` : ''}`);
    if (version !== requestVersion) return;
    events = response.events; renderCards();
  } catch (error) {
    if (version !== requestVersion) return;
    $('cards').replaceChildren(); $('result-count').textContent = 'Events unavailable'; showError(error);
  } finally { if (version === requestVersion) $('cards').setAttribute('aria-busy', 'false'); }
}
async function start() {
  $('error').hidden = true; $('retry').hidden = true;
  try {
    dataset = await api('/api/dataset');
    let storage;
    try { storage = window.localStorage; } catch { storage = null; }
    shortlist = createShortlist(storage, dataset.runId);
    $('identity').textContent = `Dataset run: ${dataset.runId} · Research mode: ${dataset.researchMode} · Researched ${dataset.createdAt} · Dataset ${dataset.datasetId}`;
    const missing = Math.max(dataset.shortfall || 0, 5 - dataset.events.length);
    $('shortfall').textContent = missing > 0 ? `Source shortfall: ${missing} event(s) missing from the target of five. Only supplied events are shown.` : 'Five researched events. Follow the evidence, then make your pick.';
    await loadEvents();
  } catch (error) { $('identity').textContent = 'Research unavailable'; $('cards').setAttribute('aria-busy', 'false'); showError(error); }
}
$('filters').addEventListener('submit', event => event.preventDefault());
for (const key of ['mode', 'eligibility', 'after']) $(key).addEventListener('change', loadEvents);
$('saved').addEventListener('change', () => { if (dataset) renderCards(); });
$('filters').addEventListener('reset', () => setTimeout(loadEvents, 0));
$('retry').addEventListener('click', () => dataset ? loadEvents() : start());
start();
