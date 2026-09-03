import { Filter, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchableTomSelect } from '../ui/SearchableTomSelect';
import { Button, Card, CardContent, Input, Separator } from '../ui/shadcn';
import type { CustomerTicket } from '../../services/customerTicketsService';
import {
  getTicketFilterDefinition,
  getTicketFilterValueOptions,
  ticketFilterConditionLabels,
  ticketFilterDefinitions,
  type TicketFilterDefinition,
  type TicketFilterCondition,
  type TicketFilterField,
  type TicketFilterRule,
} from './ticketFilterConfig';

const emptyRule = (): TicketFilterRule => ({
  id: crypto.randomUUID(),
  field: '',
  condition: '',
  value: '',
});

export function TicketFilterBuilder({
  tickets,
  appliedRules,
  definitions = ticketFilterDefinitions,
  getValueOptions = getTicketFilterValueOptions,
  onApply,
  onClear,
}: {
  tickets: CustomerTicket[];
  appliedRules: TicketFilterRule[];
  definitions?: TicketFilterDefinition[];
  getValueOptions?: (
    field: TicketFilterField | '',
    tickets: CustomerTicket[],
  ) => Array<{ value: string; label: string }>;
  onApply: (rules: TicketFilterRule[]) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<TicketFilterRule[]>([emptyRule()]);
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const appliedCount = appliedRules.filter(isCompleteRule).length;

  useEffect(() => {
    if (!open) return;
    setDraftRules(appliedRules.length ? appliedRules.map(cloneRule) : [emptyRule()]);
    setRuleErrors({});

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [appliedRules, open]);

  const fieldOptions = useMemo(
    () => definitions.map((definition) => ({ value: definition.id, label: definition.label })),
    [definitions],
  );

  const addRule = () => setDraftRules((current) => [...current, emptyRule()]);

  const clearRules = () => {
    const nextRules = [emptyRule()];
    setDraftRules(nextRules);
    setRuleErrors({});
    onClear();
  };

  const applyRules = () => {
    const nextErrors = validateRules(draftRules);
    setRuleErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onApply(draftRules.map(cloneRule));
    setOpen(false);
  };

  const updateRule = (id: string, patch: Partial<TicketFilterRule>) => {
    setDraftRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule;
        const nextRule = { ...rule, ...patch };
        setRuleErrors((errors) => {
          if (!errors[id]) return errors;
          const nextErrors = { ...errors };
          delete nextErrors[id];
          return nextErrors;
        });
        if (patch.field !== undefined) {
          nextRule.condition = '';
          nextRule.value = '';
          delete nextRule.valueTo;
        }
        if (patch.condition !== undefined) {
          nextRule.value = '';
          delete nextRule.valueTo;
        }
        return nextRule;
      }),
    );
  };

  const removeRule = (id: string) => {
    setRuleErrors((errors) => {
      if (!errors[id]) return errors;
      const nextErrors = { ...errors };
      delete nextErrors[id];
      return nextErrors;
    });
    setDraftRules((current) =>
      current.length === 1 ? [emptyRule()] : current.filter((rule) => rule.id !== id),
    );
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant={appliedCount ? 'default' : 'secondary'}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Filter size={15} />
        {appliedCount ? `Filters ${appliedCount}` : 'Filters'}
      </Button>

      {open && (
        <Card
          ref={panelRef}
          role="dialog"
          aria-label="Service request filters"
          className="absolute right-0 top-12 z-[80] w-[min(760px,calc(100vw-2rem))] border-[var(--customer-border)] bg-[var(--customer-surface)] shadow-xl"
        >
          <CardContent className="space-y-4 p-4">
            <div className="space-y-3">
              {draftRules.map((rule) => (
                <FilterRuleRow
                  key={rule.id}
                  rule={rule}
                  tickets={tickets}
                  definitions={definitions}
                  getValueOptions={getValueOptions}
                  fieldOptions={fieldOptions}
                  {...(ruleErrors[rule.id] ? { error: ruleErrors[rule.id] } : {})}
                  onChange={(patch) => updateRule(rule.id, patch)}
                  onRemove={() => removeRule(rule.id)}
                />
              ))}
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="secondary" onClick={addRule}>
                <Plus size={15} />
                Add Filter
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={clearRules}>
                  Clear
                </Button>
                <Button type="button" onClick={applyRules}>
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterRuleRow({
  rule,
  tickets,
  definitions,
  getValueOptions,
  fieldOptions,
  error,
  onChange,
  onRemove,
}: {
  rule: TicketFilterRule;
  tickets: CustomerTicket[];
  definitions: TicketFilterDefinition[];
  getValueOptions: (
    field: TicketFilterField | '',
    tickets: CustomerTicket[],
  ) => Array<{ value: string; label: string }>;
  fieldOptions: Array<{ value: string; label: string }>;
  error?: string;
  onChange: (patch: Partial<TicketFilterRule>) => void;
  onRemove: () => void;
}) {
  const definition = getTicketFilterDefinition(rule.field, definitions);
  const conditionOptions =
    definition?.conditions.map((condition) => ({
      value: condition,
      label: ticketFilterConditionLabels[condition],
    })) ?? [];
  const valueOptions = getValueOptions(rule.field, tickets);
  const isBetween = rule.condition === 'between';

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <SearchableTomSelect
          value={rule.field}
          options={fieldOptions}
          placeholder="Select Field"
          ariaLabel="Select filter field"
          wrapperClassName="ticket-filter-select"
          onChange={(value) => onChange({ field: value as TicketFilterField | '' })}
        />
        <SearchableTomSelect
          value={rule.condition}
          options={conditionOptions}
          placeholder="Select Condition"
          ariaLabel="Select filter condition"
          disabled={!definition}
          wrapperClassName="ticket-filter-select"
          onChange={(value) => onChange({ condition: value as TicketFilterCondition | '' })}
        />
        <FilterValueControl
          rule={rule}
          valueOptions={valueOptions}
          valueKind={definition?.valueKind ?? 'select'}
          onChange={onChange}
          isBetween={isBetween}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove filter"
          className="justify-self-start sm:justify-self-end"
        >
          <X size={15} />
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-[var(--customer-danger)]">{error}</p>}
    </div>
  );
}

function FilterValueControl({
  rule,
  valueOptions,
  valueKind,
  isBetween,
  onChange,
}: {
  rule: TicketFilterRule;
  valueOptions: Array<{ value: string; label: string }>;
  valueKind: 'select' | 'text' | 'date' | 'dateRange';
  isBetween: boolean;
  onChange: (patch: Partial<TicketFilterRule>) => void;
}) {
  if (isBetween || valueKind === 'dateRange') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          value={rule.value}
          aria-label="Filter start value"
          className="h-9"
          onChange={(event) => onChange({ value: event.target.value })}
        />
        <Input
          type="date"
          value={rule.valueTo ?? ''}
          aria-label="Filter end value"
          className="h-9"
          onChange={(event) => onChange({ valueTo: event.target.value })}
        />
      </div>
    );
  }

  if (valueKind === 'text') {
    return (
      <Input
        value={rule.value}
        aria-label="Filter value"
        className="h-9"
        onChange={(event) => onChange({ value: event.target.value })}
      />
    );
  }

  if (valueKind === 'date') {
    return (
      <Input
        type="date"
        value={rule.value}
        aria-label="Filter date"
        className="h-9"
        onChange={(event) => onChange({ value: event.target.value })}
      />
    );
  }

  return (
    <SearchableTomSelect
      value={rule.value}
      options={valueOptions}
      placeholder="Select Value"
      ariaLabel="Select filter value"
      disabled={!rule.field || !rule.condition}
      wrapperClassName="ticket-filter-select"
      onChange={(value) => onChange({ value })}
    />
  );
}

function validateRules(rules: TicketFilterRule[]) {
  return rules.reduce<Record<string, string>>((errors, rule) => {
    const error = validateRule(rule);
    if (error) errors[rule.id] = error;
    return errors;
  }, {});
}

function validateRule(rule: TicketFilterRule) {
  if (!rule.field) return 'Select a filter field.';
  if (!rule.condition) return 'Select a filter condition.';
  if (!rule.value.trim()) return 'Enter or select a filter value.';
  if (rule.condition === 'between' && !rule.valueTo?.trim()) {
    return 'Enter both filter values.';
  }
  return null;
}

function isCompleteRule(rule: TicketFilterRule) {
  return validateRule(rule) === null;
}

function cloneRule(rule: TicketFilterRule): TicketFilterRule {
  const clone: TicketFilterRule = {
    id: rule.id,
    field: rule.field,
    condition: rule.condition,
    value: rule.value,
  };
  if (rule.valueTo !== undefined) clone.valueTo = rule.valueTo;
  return clone;
}
