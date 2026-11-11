import type { Hono } from 'hono';

export type FieldStatus = 'verified' | 'unknown' | 'conflicting' | 'conflict';
export type AttendanceMode = 'online' | 'in-person' | 'hybrid';
export type Eligibility = 'open' | 'student-only';
export type FieldName = 'location' | 'attendanceMode' | 'eventDates' | 'deadline' | 'timezone' | 'eligibility' | 'prizes' | 'judging' | 'deliverables';
export interface ResearchField {
  value: string | null;
  status: FieldStatus;
  findingIds: string[];
}
export interface RadarEvent {
  id: string;
  name: string;
  officialUrl: string;
  fields: Record<FieldName, ResearchField>;
}
export interface Source {
  id: string;
  url: string;
  title: string;
  retrievedAt: string;
  query: string;
  contentHash: string;
  contentPath: string;
}
export type ResearchRole = 'discovery' | 'requirements' | 'comparison';
export interface Finding {
  id: string;
  eventId: string;
  role: ResearchRole;
  field: FieldName;
  value: string;
  sourceId: string;
  quote: string;
  status: FieldStatus;
}
export interface Candidate {
  id: string;
  name: string;
  url: string;
  sourceUrls: string[];
  rationale: string;
}
export interface RoleReport {
  role: ResearchRole;
  status: string;
  startedAt: string;
  completedAt: string;
  queries: string[];
  candidates: Candidate[];
  sources: Source[];
  findings: Finding[];
  errors: string[];
}
export interface Dataset {
  schemaVersion: 1;
  runId: string;
  datasetId: string;
  createdAt: string;
  researchMode: string;
  events: RadarEvent[];
  sources: Source[];
  findings: Finding[];
  roles: RoleReport[];
  shortfall: number;
}
export interface EventFilters {
  mode?: AttendanceMode | 'unknown';
  eligibility?: Eligibility | 'students' | 'unknown';
  after?: string;
}
/** API implementations must await this dependency: app.ts loads it on first use. */
export type FilterEvents = (events: RadarEvent[], filters: EventFilters) => RadarEvent[] | Promise<RadarEvent[]>;
export interface RunIdentity { runId: string; datasetId: string }
export interface EventsResponse extends RunIdentity { events: RadarEvent[] }
export interface EventDetailResponse extends RunIdentity { event: RadarEvent; findings: Finding[]; sources: Source[] }
export type EvidenceResponse = Omit<Dataset, 'events'>;
export interface ApiError { error: string }
export interface AppOptions { dataset?: Dataset; publicDir?: string }
export type CreateApi = (dataset: Dataset, filter: FilterEvents) => Hono;
export interface ShortlistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface Shortlist {
  list(): string[];
  has(id: string): boolean;
  toggle(id: string): boolean;
}
export type CreateShortlist = (storage: ShortlistStorage, runId: string) => Shortlist;
