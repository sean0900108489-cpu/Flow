import { useMemo, useState } from "react";
import {
  buildGlobalSearchIndex,
  getGlobalSearchResultCounts,
  searchGlobal,
  type GlobalSearchResult,
  type GlobalSearchResultType
} from "../../domain/globalSearch";
import type { AppState } from "../../domain/types";
import { useI18n } from "../../i18n";
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

function resultTypeLabel(resultType: GlobalSearchResultType | "all", t: (key: string) => string) {
  return t({
    all: "All result types",
    thought: "Thought",
    project: "Project",
    universe: "Universe",
    blocking_question: "Blocking question",
    decision_record: "Decision record",
    relationship: "Relationship",
    next_action: "Next action",
    command: "Command"
  }[resultType]);
}

export function GlobalSearchCenter({
  state,
  onOpenGlobalSearchResult
}: {
  state: AppState;
  onOpenGlobalSearchResult: (result: GlobalSearchResult) => void;
}) {
  const { t } = useI18n();
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
    state.universes.find((universe) => universe.id === idValue)?.name ?? t("No universe");

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>{t("Global Search Center")}</h2>
            <p className="muted">{t("Search and open thoughts, projects, universes, decisions, blockers, relationships, actions, and commands.")}</p>
          </div>
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls global-search-controls">
          <label>
            {t("Search")}
            <input
              aria-label={t("Search everything")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("Search everything")}
            />
          </label>
          <label>
            {t("Type filter")}
            <select
              aria-label={t("Type filter")}
              value={type}
              onChange={(event) => setType(event.target.value as GlobalSearchResultType | "all")}
            >
              <option value="all">{t("All result types")}</option>
              {resultTypes.filter((resultType) => resultType !== "all").map((resultType) => (
                <option key={resultType} value={resultType}>{resultTypeLabel(resultType, t)}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Universe filter")}
            <select
              aria-label={t("Universe filter")}
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
            >
              <option value="all">{t("All universes")}</option>
              {state.universes.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Status filter")}
            <select
              aria-label={t("Status filter")}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">{t("All statuses")}</option>
              {statuses.map((item) => (
                <option key={item} value={item}>{t(item)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="metrics global-search-metrics">
          <Metric label={t("Total results")} value={counts.total} />
          <Metric label={t("Thoughts")} value={counts.thoughts} />
          <Metric label={t("Projects")} value={counts.projects} />
          <Metric label={t("Universes")} value={counts.universes} />
          <Metric label={t("Next actions")} value={counts.nextActions} />
          <Metric label={t("Decisions")} value={counts.decisionRecords} />
          <Metric label={t("Commands")} value={counts.commands} />
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <div>
            <h2>{t("Results")}</h2>
            <p className="muted">{t("{count} matching results", { count: counts.total })}</p>
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState>{t("No global search results.")}</EmptyState>
        ) : (
          <div className="stack">
            {results.map((result) => (
              <article className="card global-search-result-card" key={result.id}>
                <div className="line">
                  <strong>{result.title}</strong>
                  <span className="badge">{resultTypeLabel(result.type, t)}</span>
                </div>
                {result.subtitle && <p>{result.subtitle}</p>}
                {bodyPreview(result.body) && <p>{bodyPreview(result.body)}</p>}
                <div className="chips">
                  <span>{t("Status: {status}", { status: t(result.status ?? "none") })}</span>
                  <span>{t("Universe: {name}", { name: universeLabel(result.universeId) })}</span>
                  <span>{t("Score: {score}", { score: result.score })}</span>
                </div>
                <div className="actions">
                  <button className="ghost" onClick={() => onOpenGlobalSearchResult(result)}>{t("Open")}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
