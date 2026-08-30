import TomSelect from 'tom-select';
import { useEffect, useRef, useState } from 'react';

export interface AsyncSelectOption {
  value: string;
  label: string;
}

export function AsyncCreatableTomSelect({
  value,
  placeholder,
  loadOptions,
  normalizeCreate,
  createOption,
  onChange,
}: {
  value: string;
  placeholder: string;
  loadOptions: (query: string, signal: AbortSignal) => Promise<AsyncSelectOption[]>;
  normalizeCreate: (input: string) => AsyncSelectOption | null;
  createOption: (option: AsyncSelectOption) => Promise<AsyncSelectOption>;
  onChange: (value: string) => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const instanceRef = useRef<TomSelect | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const propsRef = useRef({ loadOptions, normalizeCreate, createOption, onChange });
  const [creatingLabel, setCreatingLabel] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    propsRef.current = { loadOptions, normalizeCreate, createOption, onChange };
  }, [createOption, loadOptions, normalizeCreate, onChange]);

  useEffect(() => {
    if (!selectRef.current) return;
    const instance = new TomSelect(selectRef.current, {
      valueField: 'value',
      labelField: 'label',
      searchField: ['label'],
      maxItems: 1,
      preload: 'focus',
      loadThrottle: 300,
      persist: false,
      createOnBlur: false,
      placeholder,
      createFilter(input) {
        return propsRef.current.normalizeCreate(input) !== null;
      },
      render: {
        option_create(data, escape) {
          const normalized = propsRef.current.normalizeCreate(String(data.input ?? ''));
          return `<div class="create"><span class="ts-create-icon">+</span><span>Create <strong>${escape(normalized?.label ?? '')}</strong></span></div>`;
        },
        no_results() {
          return '<div class="no-results">No matching bag sizes</div>';
        },
        loading() {
          return '<div class="ts-loading-row"><span class="ts-loading-spinner"></span><span>Loading bag sizes…</span></div>';
        },
      },
      load(query, callback) {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        void propsRef.current
          .loadOptions(query, controller.signal)
          .then((options) => callback(options))
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setMessage('Unable to load bag sizes.');
            callback();
          });
      },
      create(input, callback) {
        const normalized = propsRef.current.normalizeCreate(input);
        if (!normalized) {
          setMessage('Enter a valid bag weight in KG.');
          callback();
          return false;
        }
        const control = instanceRef.current;
        setMessage('');
        setCreatingLabel(normalized.label);
        control?.lock();
        void propsRef.current
          .createOption(normalized)
          .then((created) => callback(created))
          .catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : 'Unable to create bag size.');
            callback();
          })
          .finally(() => {
            control?.unlock();
            setCreatingLabel('');
          });
        return true;
      },
      onType(input) {
        setMessage(
          input.trim() && !propsRef.current.normalizeCreate(input)
            ? 'Enter a numeric bag weight, for example 40 or 50 KG.'
            : '',
        );
      },
      onChange(nextValue) {
        propsRef.current.onChange(String(nextValue));
      },
    });
    instanceRef.current = instance;
    return () => {
      abortRef.current?.abort();
      instance.destroy();
      instanceRef.current = null;
    };
  }, [placeholder]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    if (value && !instance.options[value]) instance.addOption({ value, label: `${value} KG` });
    instance.setValue(value, true);
  }, [value]);

  return (
    <div>
      <select ref={selectRef} defaultValue={value} aria-label={placeholder} />
      {creatingLabel && (
        <p className="customer-primary mt-1.5 text-xs font-semibold">Creating {creatingLabel}…</p>
      )}
      {message && (
        <p className="mt-1.5 text-xs font-medium text-[var(--customer-danger)]">{message}</p>
      )}
    </div>
  );
}
