import type { ThoughtType } from "../../domain/types";

export function SelectThoughtType({ value, onChange }: { value: ThoughtType; onChange: (value: ThoughtType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ThoughtType)}>
      <option value="inspiration">靈感</option>
      <option value="task">任務</option>
      <option value="project">專案</option>
      <option value="goal">目標</option>
      <option value="question">問題</option>
      <option value="note">筆記</option>
    </select>
  );
}
