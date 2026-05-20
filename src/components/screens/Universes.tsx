import type { Universe } from "../../domain/types";

export function Universes({
  universes,
  onAdd,
  onUpdate
}: {
  universes: Universe[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Universe>) => void;
}) {
  return (
    <section className="panel">
      <div className="head">
        <h2>Universe Management</h2>
        <button onClick={onAdd}>新增 Universe</button>
      </div>
      <div className="stack">
        {universes.map((u) => (
          <div className="card form" key={u.id}>
            <label>名稱<input value={u.name} onChange={(e) => onUpdate(u.id, { name: e.target.value })} /></label>
            <label>描述<textarea value={u.description} onChange={(e) => onUpdate(u.id, { description: e.target.value })} /></label>
            <label>Purpose<textarea value={u.purpose} onChange={(e) => onUpdate(u.id, { purpose: e.target.value })} /></label>
            <label>Focus
              <select value={u.focus} onChange={(e) => onUpdate(u.id, { focus: e.target.value as Universe["focus"] })}>
                <option value="main">main</option>
                <option value="secondary">secondary</option>
                <option value="someday">someday</option>
              </select>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
