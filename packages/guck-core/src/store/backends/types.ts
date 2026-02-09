import {
  GuckEvent,
  GuckSearchParams,
  GuckStatsParams,
  GuckSessionsParams,
} from "../../schema.js";

export type SearchResult = { events: GuckEvent[]; truncated: boolean };
export type StatsResult = { buckets: Array<{ key: string; count: number }> };
export type SessionsResult = {
  sessions: Array<{ session_id: string; last_ts: string; event_count: number; error_count: number }>;
};

export type ReadBackend = {
  search: (params: GuckSearchParams) => Promise<SearchResult>;
  stats: (params: GuckStatsParams) => Promise<StatsResult>;
  sessions: (params: GuckSessionsParams) => Promise<SessionsResult>;
};
