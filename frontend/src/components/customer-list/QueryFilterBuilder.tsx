import { Filter, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { SearchableTomSelect, type SearchableSelectOption } from '../ui/SearchableTomSelect';
import { Badge, Button, Card, CardContent, Input, Separator } from '../ui/shadcn';

export interface QueryFilterRule<Field extends string, Operator extends string> {
  id: string;
  field: Field | '';
  operator: Operator | '';
  value: string;
}

export interface QueryFilterDefinition<Field extends string, Operator extends string> {
  id: Field;
  label: string;
  operators: Array<{ value: Operator; label: string }>;
  valueKind: 'text' | 'number' | 'date' | 'select' | 'custom';
  valueOptions?: SearchableSelectOption[];
}

export interface QueryFilterValueEditorProps<Field extends string, Operator extends string> {
  rule: QueryFilterRule<Field, Operator>;
  definition: QueryFilterDefinition<Field, Operator>;
  onChange: (value: string) => void;
}

export function QueryFilterBuilder<Field extends string, Operator extends string>({
  appliedRules,
  definitions,
  ariaLabel,
  onApply,
  onClear,
  renderValueEditor,
}: {
  appliedRules: QueryFilterRule<Field, Operator>[];
  definitions: QueryFilterDefinition<Field, Operator>[];
  ariaLabel: string;
  onApply: (rules: QueryFilterRule<Field, Operator>[]) => void;
  onClear: () => void;
  renderValueEditor?: (props: QueryFilterValueEditorProps<Field, Operator>) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<QueryFilterRule<Field, Operator>[]>([
    emptyQueryFilterRule<Field, Operator>(),
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldOptions = useMemo(
    () => definitions.map(({ id, label }) => ({ value: id, label })),
    [definitions],
  );

  const close = () => setOpen(false);
  const openPanel = () => {
    setDraftRules(
      appliedRules.length
        ? appliedRules.map(cloneQueryFilterRule)
        : [emptyQueryFilterRule<Field, Operator>()],
    );
    setErrors({});
    setOpen(true);
  };

  const updateRule = (id: string, patch: Partial<QueryFilterRule<Field, Operator>>) => {
    setDraftRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule;
        const next = { ...rule, ...patch };
        if (patch.field !== undefined && patch.field !== rule.field) {
          next.operator = '';
          next.value = '';
        }
        if (patch.operator !== undefined && patch.operator !== rule.operator) next.value = '';
        return next;
      }),
    );
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const apply = () => {
    const nextErrors = validateQueryFilterRules(draftRules, definitions);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onApply(draftRules.filter((rule) => rule.field && rule.operator && rule.value.trim()).map(cloneQueryFilterRule));
    close();
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        className="w-full whitespace-nowrap sm:w-auto"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : openPanel())}
      >
        <Filter size={16} />
        Filter
        {appliedRules.length > 0 && (
          <span className="text-[var(--customer-text-muted)]" aria-hidden="true">
            &bull; {appliedRules.length}
          </span>
        )}
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[79] cursor-default"
            aria-label="Close filters"
            onClick={close}
          />
          <Card
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel}
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
            }}
            className="absolute right-0 top-12 z-[80] w-[min(760px,calc(100vw-2rem))] border-[var(--customer-border)] bg-[var(--customer-surface)] shadow-xl"
          >
            <CardContent className="space-y-4 p-4">
              <div className="space-y-3">
                {draftRules.map((rule) => {
                  const definition = definitions.find((item) => item.id === rule.field);
                  const operatorOptions = definition?.operators ?? [];
                  return (
                    <div key={rule.id} className="space-y-1.5">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
                        <SearchableTomSelect
                          value={rule.field}
                          options={fieldOptions}
                          placeholder="Select Field"
                          ariaLabel="Filter field"
                          onChange={(value) => updateRule(rule.id, { field: value as Field | '' })}
                        />
                        <SearchableTomSelect
                          value={rule.operator}
                          options={operatorOptions}
                          placeholder="Select Operator"
                          ariaLabel="Filter operator"
                          disabled={!definition}
                          onChange={(value) => updateRule(rule.id, { operator: value as Operator | '' })}
                        />
                        {definition ? (
                          renderValueEditor && definition.valueKind === 'custom' ? (
                            renderValueEditor({
                              rule,
                              definition,
                              onChange: (value) => updateRule(rule.id, { value }),
                            })
                          ) : (
                            <QueryFilterValueEditor
                              rule={rule}
                              definition={definition}
                              onChange={(value) => updateRule(rule.id, { value })}
                            />
                          )
                        ) : (
                          <Input disabled aria-label="Filter value" placeholder="Select Value" />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove filter"
                          onClick={() =>
                            setDraftRules((current) =>
                              current.length === 1
                                ? [emptyQueryFilterRule<Field, Operator>()]
                                : current.filter((item) => item.id !== rule.id),
                            )
                          }
                        >
                          <X size={15} />
                        </Button>
                      </div>
                      {errors[rule.id] && (
                        <p className="text-xs font-medium text-[var(--customer-danger)]">
                          {errors[rule.id]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Separator />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setDraftRules((current) => [
                      ...current,
                      emptyQueryFilterRule<Field, Operator>(),
                    ])
                  }
                >
                  <Plus size={15} /> Add Filter
                </Button>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onClear();
                      close();
                    }}
                  >
                    Clear
                  </Button>
                  <Button type="button" onClick={apply}>Apply</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function QueryFilterChips<Field extends string, Operator extends string>({
  rules,
  formatRule,
  onRemove,
  onClear,
}: {
  rules: QueryFilterRule<Field, Operator>[];
  formatRule: (rule: QueryFilterRule<Field, Operator>) => string;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!rules.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--customer-border)] px-4 py-2.5 sm:px-5">
      {rules.map((rule) => {
        const label = formatRule(rule);
        return (
          <Badge
            key={rule.id}
            variant="outline"
            className="gap-2 border-[var(--customer-border)] bg-[var(--customer-primary-soft)] px-3 py-1 text-sm text-[var(--customer-primary)]"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove filter ${label}`}
              className="rounded-full hover:text-[var(--customer-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary)]"
              onClick={() => onRemove(rule.id)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </Badge>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}

function QueryFilterValueEditor<Field extends string, Operator extends string>({
  rule,
  definition,
  onChange,
}: QueryFilterValueEditorProps<Field, Operator>) {
  if (definition.valueKind === 'select') {
    return (
      <SearchableTomSelect
        value={rule.value}
        options={definition.valueOptions ?? []}
        placeholder="Select Value"
        ariaLabel="Filter value"
        disabled={!rule.operator}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      type={definition.valueKind === 'custom' ? 'text' : definition.valueKind}
      value={rule.value}
      disabled={!rule.operator}
      placeholder={definition.valueKind === 'date' ? undefined : 'Enter Value'}
      aria-label="Filter value"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function validateQueryFilterRules<Field extends string, Operator extends string>(
  rules: QueryFilterRule<Field, Operator>[],
  definitions: QueryFilterDefinition<Field, Operator>[],
) {
  const errors: Record<string, string> = {};
  const usedFields = new Set<Field>();
  rules.forEach((rule) => {
    if (!rule.field && !rule.operator && !rule.value.trim()) return;
    const definition = definitions.find((item) => item.id === rule.field);
    if (!definition) {
      errors[rule.id] = 'Select a filter field.';
      return;
    }
    if (usedFields.has(definition.id)) {
      errors[rule.id] = 'This filter field is already in use.';
      return;
    }
    usedFields.add(definition.id);
    if (!rule.operator || !definition.operators.some((item) => item.value === rule.operator)) {
      errors[rule.id] = 'Select a supported operator.';
      return;
    }
    if (!rule.value.trim()) errors[rule.id] = 'Enter or select a filter value.';
  });
  return errors;
}

export function emptyQueryFilterRule<Field extends string, Operator extends string>(): QueryFilterRule<Field, Operator> {
  return { id: crypto.randomUUID(), field: '', operator: '', value: '' };
}

export function cloneQueryFilterRule<Field extends string, Operator extends string>(
  rule: QueryFilterRule<Field, Operator>,
): QueryFilterRule<Field, Operator> {
  return { id: rule.id, field: rule.field, operator: rule.operator, value: rule.value };
}
