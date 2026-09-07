import TomSelect from 'tom-select';
import { useEffect, useRef, type SelectHTMLAttributes } from 'react';

interface NativeTomSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  allowEmptyOption?: boolean;
  dropdownClassName?: string;
  dropdownPlacement?: 'auto' | 'bottom';
  placeholder?: string;
  searchPlaceholder?: string;
}

/**
 * Tom Select enhancement with the same public contract as a native single select.
 * This keeps existing React change handlers, values, validation names and payloads intact.
 */
export function NativeTomSelect({
  children,
  allowEmptyOption,
  className = '',
  disabled,
  dropdownClassName = '',
  dropdownPlacement = 'auto',
  placeholder,
  value,
  defaultValue,
  searchPlaceholder,
  ...props
}: NativeTomSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const instanceRef = useRef<TomSelect | null>(null);
  const optionsSignatureRef = useRef('');

  useEffect(() => {
    const select = selectRef.current;
    if (!select) return;
    const emptyOption = Array.from(select.options).find((option) => option.value === '');
    const emptyOptionLabel = emptyOption?.textContent?.trim() ?? '';
    const emptyOptionIsPlaceholder = /^select\b/i.test(emptyOptionLabel);
    const restingPlaceholder =
      placeholder ?? (emptyOptionIsPlaceholder ? '' : emptyOptionLabel || props['aria-label'] || '');
    const activeSearchPlaceholder =
      searchPlaceholder ?? `Search ${(props['aria-label'] ?? 'options').toLowerCase()}...`;
    const instance = new TomSelect(select, {
      maxItems: 1,
      create: false,
      allowEmptyOption: allowEmptyOption ?? !emptyOptionIsPlaceholder,
      placeholder: restingPlaceholder,
      wrapperClass: 'ts-wrapper app-tom-select',
      dropdownClass: `ts-dropdown customer-tom-select-dropdown ${dropdownClassName}`.trim(),
      onFocus() {
        const activeInstance = instanceRef.current;
        if (activeInstance) activeInstance.control_input.placeholder = activeSearchPlaceholder;
      },
      onBlur() {
        const activeInstance = instanceRef.current;
        if (activeInstance) activeInstance.control_input.placeholder = restingPlaceholder;
      },
      onDropdownOpen() {
        const activeInstance = instanceRef.current;
        if (!activeInstance) return;
        const controlRect = activeInstance.control.getBoundingClientRect();
        const spaceBelow = window.innerHeight - controlRect.bottom - 12;
        const spaceAbove = controlRect.top - 12;
        const openAbove = dropdownPlacement === 'auto' && spaceBelow < 280 && spaceAbove > spaceBelow;
        const availableSpace = Math.max(120, Math.min(352, openAbove ? spaceAbove : spaceBelow));

        activeInstance.dropdown.classList.toggle('dropdown-above', openAbove);
        activeInstance.dropdown_content.style.maxHeight = `${availableSpace}px`;
      },
      render: {
        no_results() { return '<div class="no-results">No matching options</div>'; },
      },
    });
    instanceRef.current = instance;
    optionsSignatureRef.current = getOptionsSignature(select);
    instance.control_input.setAttribute('aria-label', props['aria-label'] ?? 'Select an option');
    if (className.includes('h-9')) instance.wrapper.dataset.size = 'compact';
    if (className.includes('h-12')) instance.wrapper.dataset.size = 'large';
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    const select = selectRef.current;
    if (!instance || !select) return;
    const optionsSignature = getOptionsSignature(select);
    if (optionsSignatureRef.current !== optionsSignature) {
      instance.sync();
      optionsSignatureRef.current = optionsSignature;
    }
    const nextValue = value == null ? '' : String(value);
    if (String(instance.getValue()) !== nextValue) instance.setValue(nextValue, true);
  }, [children, value]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    disabled ? instance.disable() : instance.enable();
  }, [disabled]);

  return (
    <select
      ref={selectRef}
      className={className}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      {children}
    </select>
  );
}

function getOptionsSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}\u0000${option.text}\u0000${option.disabled ? '1' : '0'}`)
    .join('\u0001');
}
