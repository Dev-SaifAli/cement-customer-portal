import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import { isPermittedWholeTonInput, wholeTonQuantityMessage } from '../../utils/commercialQuantity';

type CommercialTonInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'inputMode' | 'min' | 'onChange' | 'step' | 'type' | 'value'
> & {
  value: string;
  onValueChange: (value: string) => void;
  onInvalidValue?: (message: string) => void;
};

export function CommercialTonInput({
  value,
  onValueChange,
  onInvalidValue,
  onKeyDown,
  onPaste,
  ...props
}: CommercialTonInputProps) {
  const rejectInvalidValue = () => onInvalidValue?.(wholeTonQuantityMessage);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault();
      rejectInvalidValue();
    }
  };

  return (
    <input
      {...props}
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      value={value}
      onKeyDown={handleKeyDown}
      onPaste={(event) => {
        onPaste?.(event);
        if (event.defaultPrevented) return;
        if (!isPermittedWholeTonInput(event.clipboardData.getData('text'))) {
          event.preventDefault();
          rejectInvalidValue();
        }
      }}
      onChange={(event) => {
        if (isPermittedWholeTonInput(event.target.value)) {
          onValueChange(event.target.value);
        } else {
          rejectInvalidValue();
        }
      }}
    />
  );
}
