import type { ThoughtType } from "../../domain/types";
import { useI18n } from "../../i18n";

export function SelectThoughtType({ value, onChange }: { value: ThoughtType; onChange: (value: ThoughtType) => void }) {
  const { t } = useI18n();

  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ThoughtType)}>
      <option value="inspiration">{t("inspiration")}</option>
      <option value="task">{t("task")}</option>
      <option value="project">{t("project")}</option>
      <option value="goal">{t("goal")}</option>
      <option value="question">{t("question")}</option>
      <option value="note">{t("note")}</option>
    </select>
  );
}
