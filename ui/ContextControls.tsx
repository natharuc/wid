import type { ContextSummary } from '../src/domain/context';
import { contextKey } from '../src/domain/context';
import { FormField } from './FormField';

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
      aria-label="Filtrar por contexto"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Todos os contextos</option>
      {contexts.map((context) => (
        <option value={contextKey(context.name)} key={contextKey(context.name)}>
          {context.name} ({context.taskCount})
        </option>
      ))}
    </select>
  );
}

export function ContextInput({
  contexts,
  defaultValue,
}: {
  contexts: ContextSummary[];
  defaultValue: string;
}) {
  return (
    <FormField label="Contexto">
      <input
        className="input w-full"
        name="context"
        list="wid-context-options"
        defaultValue={defaultValue}
        required
        maxLength={120}
        placeholder="Escolha um nome existente ou digite outro"
      />
      <datalist id="wid-context-options">
        {contexts.map((context) => (
          <option value={context.name} key={contextKey(context.name)} />
        ))}
      </datalist>
    </FormField>
  );
}
