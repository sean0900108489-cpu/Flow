import { useMemo, useState } from "react";
import {
  buildGlobalSearchIndex,
  getGlobalSearchResultCounts,
  searchGlobal,
  type GlobalSearchResult,
  type GlobalSearchResultType
} from "../../domain/globalSearch";
import type { AppState } from "../../domain/types";
import { EmptyState } from "../common/EmptyState";
import { Metric } from "../common/Metric";

const resultTypes: Array<GlobalSearchResultType | "all"> = [
  "all",
  "thought",
  "project",
  "universe",
  "blocking_question",
  "decision_record",
  "relationship",
  "next_action",
  "command"
];

function bodyPreview(value: string | undefined) {
  const body = value?.trim() ?? "";

  if (body.length <= 180) return body;

  return `${body.slice(0, 177)}...`;
}

export function GlobalSearchCenter({
  state,
  onOpenGlobalSearchResult
}: {
  state: AppState;
  onOpenGlobalSearchResult: (result: GlobalSearchResult) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [type, setType] = useState<GlobalSearchResultType | "all">("all");
  const [universeId, setUniverseId] = useState<string | "all">("all");
  const [status, setStatus] = useState<string | "all">("all");

  const allResults = useMemo(() => buildGlobalSearchIndex(state), [state]);
  const statuses = useMemo(
    () => Array.from(new Set(allResults.map((result) => result.status).filter((item): item is string => Boolean(item)))).sort(),
    [allResults]
  );
  const results = useMemo(
    () => searchGlobal(state, { searchText, type, universeId, status }),
    [searchText, state, status, type, universeId]
  );
  const counts = useMemo(() => getGlobalSearchResultCounts(results), [results]);

  const universeLabel = (idValue: string | undefined) =>
    state.universes.find((universe) => universe.id === idValue)?.name ?? "No universe";

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>Global Search Center</h2>
            <p className="muted">Search and open thoughts, projects, universes, decisions, blockers, relationships, actions, and commands.</p>
          </div>
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls global-search-controls">
          <label>
            Search
            <input
              aria-label="Search everything"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search everything"
            />
          </label>
          <label>
            Type filter
            <select
              aria-label="Type filter"
              value={type}
              onChange={(event) => setType(event.target.value as GlobalSearchResultType | "all")}
            >
              <option value="all">All result types</option>
              {resultTypes.filter((resultType) => resultType !== "all").map((resultType) => (
                <option key={resultType} value={resultType}>{resultType}</option>
              ))}
            </select>
          </label>
          <label>
            Universe filter
            <select
              aria-label="Universe filter"
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
            >
              <option value="all">All universes</option>
              {state.universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status filter
            <select
              aria-label="Status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="metrics global-search-metrics">
          <Metric label="Total results" value={counts.total} />
          <Metric label="Thoughts" value={counts.thoughts} />
          <Metric label="Projects" value={counts.projects} />
          <Metric label="Universes" value={counts.universes} />
          <Metric label="Next actions" value={counts.nextActions} />
          <Metric label="Decisions" value={counts.decisionRecords} />
          <Metric label="Commands" value={counts.commands} />
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <div>
            <h2>Results</h2>
            <p className="muted">{counts.total} matching results</p>
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState>No global search results.</EmptyState>
        ) : (
          <div className="stack">
            {results.map((result) => (
              <article className="card global-search-result-card" key={result.id}>
                <div className="line">
                  <strong>{result.title}</strong>
                  <span className="badge">{result.type}</span>
                </div>
                {result.subtitle && <p>{result.subtitle}</p>}
                {bodyPreview(result.body) && <p>{bodyPreview(result.body)}</p>}
                <div className="chips">
                  <span>Status: {result.status ?? "none"}</span>
                  <span>Universe: {universeLabel(result.universeId)}</span>
                  <span>Score: {result.score}</span>
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => onOpenGlobalSearchResult(result)}>Open</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
