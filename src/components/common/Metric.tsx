import { useI18n } from "../../i18n";

export function Metric({ label, value }: { label: string; value: number | string }) {
  const { t } = useI18n();

  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{t(label)}</span>
    </div>
  );
}
