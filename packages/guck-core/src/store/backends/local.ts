import {
  GuckConfig,
  GuckEvent,
  GuckSearchParams,
  GuckSessionsParams,
  GuckStatsParams,
} from "../../schema.js";
import { listSessions, searchEvents, statsEvents } from "../file-store.js";
import { ReadBackend, SearchResult, SessionsResult, StatsResult } from "./types.js";

type LocalBackendOptions = {
  storeDir: string;
  config: GuckConfig;
  backendId?: string;
};

const tagLocalSource = (event: GuckEvent, backendId?: string): GuckEvent => {
  const source = event.source ?? { kind: "mcp" as const };
  return {
    ...event,
    source: {
      ...source,
      backend: "local",
      backend_id: backendId ?? source.backend_id,
    },
  };
};

export const createLocalBackend = (options: LocalBackendOptions): ReadBackend => {
  const { storeDir, config, backendId } = options;

  return {
    search: async (params: GuckSearchParams): Promise<SearchResult> => {
      const result = await searchEvents(storeDir, config, params);
      return {
        ...result,
        events: result.events.map((event) => tagLocalSource(event, backendId)),
      };
    },
    stats: async (params: GuckStatsParams): Promise<StatsResult> => {
      return statsEvents(storeDir, config, params);
    },
    sessions: async (params: GuckSessionsParams): Promise<SessionsResult> => {
      return listSessions(storeDir, config, params);
    },
  };
};
