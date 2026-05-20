import type { Universe } from "../../domain/types";

export function SelectUniverse({ value, universes, onChange }: { value: string; universes: Universe[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}
