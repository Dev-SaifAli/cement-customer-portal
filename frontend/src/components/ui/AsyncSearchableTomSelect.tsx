import TomSelect from 'tom-select';
import { useEffect, useRef } from 'react';
import type { AsyncSelectOption } from './AsyncCreatableTomSelect';

type TomLoadCallback = TomSelect['loadCallback'];

export function AsyncSearchableTomSelect({
  id,
  value,
  ariaLabel,
  placeholder = '',
  loadOptions,
  onChange,
  onType,
  searchText,
  size = 'default',
  allowCreate = false,
  validateCreate,
  selectedLabel,
  wrapperClassName,
}: {
  id?: string;
  value: string;
  ariaLabel: string;
  placeholder?: string;
  loadOptions: (query: string, signal: AbortSignal) => Promise<AsyncSelectOption[]>;
  onChange: (value: string) => void;
  onType?: (value: string) => void;
  searchText?: string;
  size?: 'default' | 'compact';
  allowCreate?: boolean;
  validateCreate?: (input: string) => boolean;
  selectedLabel?: string;
  wrapperClassName?: string;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const instanceRef = useRef<TomSelect | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const propsRef = useRef({ loadOptions, onChange, onType, searchText, validateCreate });

  useEffect(() => {
    propsRef.current = { loadOptions, onChange, onType, searchText, validateCreate };
  }, [loadOptions, onChange, onType, searchText, validateCreate]);

  useEffect(() => {
    if (!selectRef.current) return;
    let active = true;

    const restoreSearchText = () => {
      const instance = instanceRef.current;
      const text = propsRef.current.searchText;
      if (instance && !instance.getValue() && text !== undefined) {
        instance.setTextboxValue(text);
      }
    };

    const instance = new TomSelect(selectRef.current, {
      valueField: 'value',
      labelField: 'label',
      searchField: ['label'],
      maxItems: 1,
      create: allowCreate
        ? (input, callback) => {
            const normalized = input.trim();
            const isValid = propsRef.current.validateCreate;
            if (!normalized || (isValid && !isValid(normalized))) {
              callback();
              return false;
            }
            callback({ value: normalized, label: normalized });
            return true;
          }
        : false,
      createFilter: (input) => {
        const isValid = propsRef.current.validateCreate;
        return !isValid || isValid(input.trim());
      },
      preload: 'focus',
      loadThrottle: 250,
      refreshThrottle: 0,
      placeholder,
      plugins: { clear_button: { title: 'Clear selection' } },
      wrapperClass: ['ts-wrapper app-tom-select', wrapperClassName].filter(Boolean).join(' '),
      dropdownClass: 'ts-dropdown customer-tom-select-dropdown',
      load(query: string, callback: TomLoadCallback) {
        if (!active) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        void propsRef.current
          .loadOptions(query, controller.signal)
          .then((options) => {
            if (active) callback(controller.signal.aborted ? [] : options, []);
          })
          .catch(() => {
            // Completing aborted loads also balances Tom Select's loading counter.
            if (active) callback([], []);
          });
      },
      onChange(nextValue: string | number) {
        propsRef.current.onChange(String(nextValue));
      },
      onType(text: string) {
        propsRef.current.onType?.(text);
      },
      onBlur: restoreSearchText,
      onDropdownClose: restoreSearchText,
      render: {
        no_results() {
          return '<div class="no-results">No matching values</div>';
        },
        loading() {
          return '<div class="ts-loading-row"><span class="ts-loading-spinner"></span><span>Loading values...</span></div>';
        },
      },
    });

    if (size === 'compact') instance.wrapper.dataset.size = 'compact';
    instance.control_input.setAttribute('aria-label', ariaLabel);
    instanceRef.current = instance;

    return () => {
      active = false;
      abortRef.current?.abort();
      instance.destroy();
      instanceRef.current = null;
    };
  }, [allowCreate, ariaLabel, placeholder, size, wrapperClassName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    if (instance.getValue() === value) return;
    if (value && !instance.options[value]) {
      instance.addOption({ value, label: selectedLabel ?? value });
    }
    instance.setValue(value, true);
  }, [selectedLabel, value]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || searchText === undefined || instance.getValue()) return;
    if (instance.control_input.value !== searchText) instance.setTextboxValue(searchText);
  }, [searchText, value]);

  return <select id={id} ref={selectRef} defaultValue={value} aria-label={ariaLabel} />;
}
