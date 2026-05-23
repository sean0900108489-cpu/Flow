import type { Universe } from "../../domain/types";
import { useI18n } from "../../i18n";

export function SelectUniverse({ value, universes, onChange }: { value: string; universes: Universe[]; onChange: (value: string) => void }) {
  const { t } = useI18n();

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("None")}</option>
      {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}
