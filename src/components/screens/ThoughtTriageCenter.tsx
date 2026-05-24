import { useEffect, useMemo, useState } from "react";
import type { AppState, ThoughtItem, ThoughtType, Universe } from "../../domain/types";
import {
  listThoughtsForTriage,
  type ThoughtTriageItem,
  type ThoughtTriagePatch,
  type ThoughtTriageStage
} from "../../domain/thoughtTriage";
import { universeOptionsForItemUniverseIds } from "../../domain/universeActions";
import { useI18n } from "../../i18n";
import { EmptyState } from "../common/EmptyState";
import { Metric } from "../common/Metric";
import { SelectThoughtType } from "../common/SelectThoughtType";
import { SelectUniverse } from "../common/SelectUniverse";

const typeOptions: Array<ThoughtType | "all"> = ["all", "inspiration", "task", "project", "goal", "question", "note"];
const stageOptions: Array<ThoughtTriageStage | "all"> = [
  "all",
  "needs_universe",
  "needs_context",
  "needs_next_action",
  "ready"
];

const stageLabel: Record<ThoughtTriageStage, string> = {
  needs_universe: "Needs universe",
  needs_context: "Needs context",
  needs_next_action: "Needs next action",
  ready: "Ready"
};

function universeLabel(universes: Universe[], universeId: string) {
  return universes.find((universe) => universe.id === universeId)?.name ?? "No universe";
}

function TriageCard({
  item,
  universes,
  onUpdateTriage,
  onMarkTriaged,
  onPromote,
  onArchive,
  onViewThought
}: {
  item: ThoughtTriageItem;
  universes: Universe[];
  onUpdateTriage: (thoughtId: string, patch: ThoughtTriagePatch) => { ok: boolean; error?: string };
  onMarkTriaged: (thoughtId: string) => { ok: boolean; error?: string };
  onPromote: (thoughtId: string) => { ok: boolean; error?: string };
  onArchive: (thoughtId: string) => void;
  onViewThought: (thoughtId: string) => void;
}) {
  const { t } = useI18n();
  const { thought } = item;
  const [draft, setDraft] = useState<Required<ThoughtTriagePatch>>({
    title: thought.title,
    content: thought.content,
    type: thought.type,
    universeId: thought.universeId,
    why: thought.why,
    outcome: thought.outcome,
    nextAction: thought.nextAction
  });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDraft({
      title: thought.title,
      content: thought.content,
      type: thought.type,
      universeId: thought.universeId,
      why: thought.why,
      outcome: thought.outcome,
      nextAction: thought.nextAction
    });
  }, [thought]);

  const updateDraft = (patch: Partial<Required<ThoughtTriagePatch>>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = () => {
    const result = onUpdateTriage(thought.id, draft);
    setNotice(result.ok ? "Triage saved." : result.error ?? "Triage could not be saved.");
  };

  const markTriaged = () => {
    const result = onMarkTriaged(thought.id);
    setNotice(result.ok ? "Thought moved to active." : result.error ?? "Thought could not be marked triaged.");
  };

  const promote = () => {
    const result = onPromote(thought.id);
    setNotice(result.ok ? "Thought promoted to project." : result.error ?? "Thought could not be promoted.");
  };

  return (
    <article className="card triage-card">
      <div className="line">
        <strong>{thought.title}</strong>
        <span className={`badge triage-${item.stage}`}>{t(stageLabel[item.stage])}</span>
      </div>
      <p>{thought.content || t("No content yet.")}</p>
      <div className="chips">
        <span>{t(thought.type)}</span>
        <span>{universeLabel(universes, thought.universeId) === "No universe" ? t("No universe") : universeLabel(universes, thought.universeId)}</span>
        <span>{t("{score}% complete", { score: item.score })}</span>
      </div>
      {item.missingFields.length > 0 && (
        <p className="muted">{t("Missing: {fields}", { fields: item.missingFields.join(", ") })}</p>
      )}
      {notice && <div className={notice.includes("could not") ? "warn" : "notice"}>{t(notice)}</div>}

      <div className="triage-grid">
        <label>
          {t("Triage type")}
          <SelectThoughtType value={draft.type} onChange={(type) => updateDraft({ type })} />
        </label>
        <label>
          {t("Triage universe")}
          <SelectUniverse value={draft.universeId} universes={universes} onChange={(universeId) => updateDraft({ universeId })} />
        </label>
      </div>
      <label>
        {t("Triage why")}
        <textarea value={draft.why} onChange={(event) => updateDraft({ why: event.target.value })} />
      </label>
      <label>
        {t("Triage outcome")}
        <textarea value={draft.outcome} onChange={(event) => updateDraft({ outcome: event.target.value })} />
      </label>
      <label>
        {t("Triage next action")}
        <input value={draft.nextAction} onChange={(event) => updateDraft({ nextAction: event.target.value })} />
      </label>

      <div className="actions">
        <button className="ghost" onClick={() => onViewThought(thought.id)}>{t("View Detail")}</button>
        <button className="ghost" onClick={save}>{t("Save Triage")}</button>
        <button onClick={markTriaged} disabled={item.stage !== "ready"}>{t("Mark Triaged")}</button>
        <button className="ghost" onClick={promote}>{t("Promote to Project")}</button>
        <button className="danger" onClick={() => onArchive(thought.id)}>{t("Archive")}</button>
      </div>
    </article>
  );
}

export function ThoughtTriageCenter({
  state,
  universes,
  onUpdateTriage,
  onMarkTriaged,
  onPromote,
  onArchive,
  onViewThought
}: {
  state: AppState;
  universes: Universe[];
  onUpdateTriage: (thoughtId: string, patch: ThoughtTriagePatch) => { ok: boolean; error?: string };
  onMarkTriaged: (thoughtId: string) => { ok: boolean; error?: string };
  onPromote: (thoughtId: string) => { ok: boolean; error?: string };
  onArchive: (thoughtId: string) => void;
  onViewThought: (thoughtId: string) => void;
}) {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<ThoughtType | "all">("all");
  const [universeFilter, setUniverseFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<ThoughtTriageStage | "all">("all");
  const allItems = useMemo(() => listThoughtsForTriage(state), [state]);
  const visibleItems = useMemo(
    () => listThoughtsForTriage(state, {
      searchText,
      type: typeFilter,
      universeId: universeFilter,
      stage: stageFilter
    }),
    [searchText, stageFilter, state, typeFilter, universeFilter]
  );
  const universeOptions = universeOptionsForItemUniverseIds(universes, allItems.map((item) => item.thought.universeId));
  const focusItem = visibleItems.find((item) => item.stage !== "ready") ?? visibleItems[0];
  const readyItems = allItems.filter((item) => item.stage === "ready");
  const needsContextItems = allItems.filter((item) => item.stage === "needs_context");
  const needsUniverseItems = allItems.filter((item) => item.stage === "needs_universe");
  const needsActionItems = allItems.filter((item) => item.stage === "needs_next_action");

  return (
    <div className="stack">
      <section className="panel hero">
        <div className="head">
          <div>
            <h2>{t("Thought Triage Center")}</h2>
            <p className="muted">{t("Clarify inbox thoughts before they become active work, projects, or archive material.")}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="metrics triage-metrics">
          <Metric label={t("Inbox thoughts")} value={allItems.length} />
          <Metric label={t("Needs universe")} value={needsUniverseItems.length} />
          <Metric label={t("Needs context")} value={needsContextItems.length} />
          <Metric label={t("Needs action")} value={needsActionItems.length} />
          <Metric label={t("Ready")} value={readyItems.length} />
        </div>
      </section>

      <section className="panel form">
        <div className="list-controls">
          <label>
            {t("Search triage")}
            <input
              aria-label={t("Search triage thoughts")}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("Search inbox thoughts")}
            />
          </label>
          <label>
            {t("Type filter")}
            <select
              aria-label={t("Triage type filter")}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ThoughtType | "all")}
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type === "all" ? t("All types") : t(type)}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Universe filter")}
            <select
              aria-label={t("Triage universe filter")}
              value={universeFilter}
              onChange={(event) => setUniverseFilter(event.target.value)}
            >
              <option value="all">{t("All universes")}</option>
              {universeOptions.map((universe) => (
                <option key={universe.id} value={universe.id}>{universe.name}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Stage filter")}
            <select
              aria-label={t("Triage stage filter")}
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as ThoughtTriageStage | "all")}
            >
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>{stage === "all" ? t("All stages") : t(stageLabel[stage])}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>{t("Triage Focus")}</h2>
            <p className="muted">{t("Work the first inbox thought that still needs structure.")}</p>
          </div>
        </div>
        {focusItem ? (
          <div className="focus-action">
            <div>
              <strong>{focusItem.thought.title}</strong>
              <p>{t("{stage} · {score}% complete", {
                stage: t(stageLabel[focusItem.stage]),
                score: focusItem.score
              })}</p>
              <div className="chips">
                <span>{t(focusItem.thought.type)}</span>
                <span>{universeLabel(universes, focusItem.thought.universeId) === "No universe"
                  ? t("No universe")
                  : universeLabel(universes, focusItem.thought.universeId)}</span>
              </div>
            </div>
            <button className="ghost" onClick={() => onViewThought(focusItem.thought.id)}>{t("View Detail")}</button>
          </div>
        ) : (
          <EmptyState>{t("No inbox thoughts need triage.")}</EmptyState>
        )}
      </section>

      <section className="panel stack">
        <div className="head">
          <div>
            <h2>{t("Inbox Triage")}</h2>
            <p className="muted">{t("{count} shown", { count: visibleItems.length })}</p>
          </div>
        </div>
        {visibleItems.length === 0 ? (
          <EmptyState>{t("No triage thoughts match the current filters.")}</EmptyState>
        ) : (
          <div className="cards">
            {visibleItems.map((item) => (
              <TriageCard
                key={item.thought.id}
                item={item}
                universes={universes}
                onUpdateTriage={onUpdateTriage}
                onMarkTriaged={onMarkTriaged}
                onPromote={onPromote}
                onArchive={onArchive}
                onViewThought={onViewThought}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
