import TomSelect from 'tom-select';
import { useEffect, useRef } from 'react';
import type { AsyncSelectOption } from './AsyncCreatableTomSelect';

type TomLoadCallback = TomSelect['loadCallback'];

export function AsyncSearchableTomSelect({
  value,
  ariaLabel,
  placeholder = '',
  loadOptions,
  onChange,
  size = 'default',
  allowCreate = false,
  validateCreate,
  selectedLabel,
}: {
  value: string;
  ariaLabel: string;
  placeholder?: string;
  loadOptions: (query: string, signal: AbortSignal) => Promise<AsyncSelectOption[]>;
  onChange: (value: string) => void;
  size?: 'default' | 'compact';
  allowCreate?: boolean;
  validateCreate?: (input: string) => boolean;
  selectedLabel?: string;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const instanceRef = useRef<TomSelect | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const propsRef = useRef({ loadOptions, onChange });

  useEffect(() => {
    propsRef.current = { loadOptions, onChange };
  }, [loadOptions, onChange]);
  useEffect(() => {
    if (!selectRef.current) return;
    const instance = new TomSelect(selectRef.current, {
      valueField: 'value',
      labelField: 'label',
      searchField: ['label'],
      maxItems: 1,
      create: allowCreate
        ? (input, callback) => {
            const normalized = input.trim();
            if (!normalized || (validateCreate && !validateCreate(normalized))) {
              callback();
              return false;
            }
            callback({ value: normalized, label: normalized });
            return true;
          }
        : false,
      createFilter: (input) => !validateCreate || validateCreate(input.trim()),
      preload: 'focus',
      loadThrottle: 250,
      placeholder,
      plugins: { clear_button: { title: 'Clear selection' } },
      wrapperClass: 'ts-wrapper app-tom-select',
      dropdownClass: 'ts-dropdown customer-tom-select-dropdown',
      load(query: string, callback: TomLoadCallback) {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        void propsRef.current
          .loadOptions(query, controller.signal)
          .then((options) => callback(options, []))
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            callback([], []);
          });
      },
      onChange(nextValue: string | number) {
        propsRef.current.onChange(String(nextValue));
      },
      render: {
        no_results() {
          return '<div class="no-results">No matching values</div>';
        },
        loading() {
          return '<div class="ts-loading-row"><span class="ts-loading-spinner"></span><span>Loading values…</span></div>';
        },
      },
    });
    if (size === 'compact') instance.wrapper.dataset.size = 'compact';
    instanceRef.current = instance;
    return () => {
      abortRef.current?.abort();
      instance.destroy();
      instanceRef.current = null;
    };
  }, [allowCreate, placeholder, size, validateCreate]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    if (value && !instance.options[value])
      instance.addOption({ value, label: selectedLabel ?? value });
    instance.setValue(value, true);
  }, [selectedLabel, value]);

  return <select ref={selectRef} defaultValue={value} aria-label={ariaLabel} />;
}
