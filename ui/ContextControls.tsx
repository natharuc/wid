import type { ContextSummary } from '../src/domain/context';
import { contextKey } from '../src/domain/context';

export function ContextFilter({
  contexts,
  value,
  onChange,
}: {
  contexts: ContextSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="select w-full sm:w-auto sm:max-w-64"
      aria-label="Contexto de trabalho"
      value={contexts.find((item) => contextKey(item.name) === contextKey(value))?.name ?? value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Todos os contextos</option>
      {value && !contexts.some((item) => contextKey(item.name) === contextKey(value)) && (
        <option value={value}>{value} (0)</option>
      )}
      {contexts.map((context) => (
        <option value={context.name} key={contextKey(context.name)}>
          {context.name} ({context.taskCount})
        </option>
      ))}
    </select>
  );
}
