import TomSelect from 'tom-select';
import { useEffect, useRef } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export function SearchableTomSelect({
  value,
  options,
  placeholder,
  ariaLabel,
  disabled = false,
  dropdownParent,
  wrapperClassName,
  autoComplete,
  onChange,
  onBlur,
}: {
  value: string;
  options: SearchableSelectOption[];
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  dropdownParent?: string | undefined;
  wrapperClassName?: string | undefined;
  autoComplete?: string | undefined;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const instanceRef = useRef<TomSelect | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const optionsRef = useRef(options);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!selectRef.current) return;

    const instance = new TomSelect(selectRef.current, {
      valueField: 'value',
      labelField: 'label',
      searchField: ['label'],
      maxItems: 1,
      create: false,
      options: optionsRef.current,
      placeholder,
      wrapperClass: ['ts-wrapper app-tom-select', wrapperClassName].filter(Boolean).join(' '),
      ...(dropdownParent ? { dropdownParent } : {}),
      dropdownClass: 'ts-dropdown customer-tom-select-dropdown',
      render: {
        no_results() {
          return '<div class="no-results">No matching fields</div>';
        },
      },
      onChange(nextValue: string | number) {
        onChangeRef.current(String(nextValue));
      },
      onBlur() {
        onBlurRef.current?.();
      },
      onDropdownOpen(dropdown: HTMLDivElement) {
        const control = instanceRef.current?.control;
        if (!control || dropdownParent !== 'body') return;

        copyCustomerThemeVariables(control, dropdown);
        const controlRect = control.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        const viewportPadding = 8;
        const availableBelow = window.innerHeight - controlRect.bottom - viewportPadding;
        const availableAbove = controlRect.top - viewportPadding;

        if (dropdownRect.height > availableBelow && availableAbove > availableBelow) {
          dropdown.style.top = `${Math.max(
            window.scrollY + viewportPadding,
            window.scrollY + controlRect.top - dropdownRect.height,
          )}px`;
        }

        const maximumLeft = window.scrollX + window.innerWidth - dropdownRect.width - viewportPadding;
        dropdown.style.left = `${Math.max(
          window.scrollX + viewportPadding,
          Math.min(window.scrollX + controlRect.left, maximumLeft),
        )}px`;
      },
    });

    instanceRef.current = instance;
    copyCustomerThemeVariables(instance.wrapper, instance.dropdown);
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [dropdownParent, placeholder, wrapperClassName]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const selectedValue = value.trim();
    const nextOptions =
      selectedValue && !options.some((option) => option.value === selectedValue)
        ? [{ value: selectedValue, label: selectedValue }, ...options]
        : options;

    instance.clearOptions(() => true);
    instance.addOptions(nextOptions);
    if (selectedValue) {
      instance.setValue(selectedValue, true);
    } else {
      instance.clear(true);
    }
    instance.refreshOptions(false);
  }, [options, value]);

  useEffect(() => {
    instanceRef.current?.setValue(value, true);
  }, [value]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    disabled ? instance.disable() : instance.enable();
  }, [disabled]);

  return (
    <select
      ref={selectRef}
      aria-label={ariaLabel}
      autoComplete={autoComplete}
      defaultValue={value}
      disabled={disabled}
    />
  );
}

const customerThemeVariables = [
  '--customer-card',
  '--customer-border',
  '--customer-primary',
  '--customer-primary-soft',
  '--customer-shadow',
  '--customer-text',
  '--customer-text-muted',
] as const;

function copyCustomerThemeVariables(source: HTMLElement, target: HTMLElement) {
  const styles = window.getComputedStyle(source);
  customerThemeVariables.forEach((variable) => {
    target.style.setProperty(variable, styles.getPropertyValue(variable));
  });
}
