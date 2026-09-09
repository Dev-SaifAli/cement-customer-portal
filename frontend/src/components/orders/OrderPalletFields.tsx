import { NativeTomSelect } from '../ui/NativeTomSelect';
import { Input, Switch } from '../ui/shadcn';

export interface OrderPalletState {
  palletRequired: boolean;
  palletType: string;
  palletQuantity: string;
}

const palletTypes = ['Standard Wooden Pallet', 'Euro Pallet', 'Plastic Pallet'];

export function createOrderPalletState(contract: {
  palletRequired: boolean;
  palletType: string | null;
}): OrderPalletState {
  return {
    palletRequired: contract.palletRequired,
    palletType: contract.palletType ?? '',
    palletQuantity: '',
  };
}

export function validateOrderPallet(state: OrderPalletState) {
  if (!state.palletRequired) return '';
  if (!state.palletType.trim()) return 'Select a pallet type.';
  if (!/^\d+$/.test(state.palletQuantity) || Number(state.palletQuantity) < 1) {
    return 'Pallet quantity must be a positive whole number.';
  }
  return '';
}

export function OrderPalletFields({
  contractPalletRequired,
  divided = true,
  value,
  onChange,
}: {
  contractPalletRequired: boolean;
  divided?: boolean;
  value: OrderPalletState;
  onChange: (value: OrderPalletState) => void;
}) {
  const availablePalletTypes = value.palletType && !palletTypes.includes(value.palletType)
    ? [value.palletType, ...palletTypes]
    : palletTypes;
  const setRequired = (palletRequired: boolean) => {
    onChange(
      palletRequired
        ? { ...value, palletRequired: true }
        : { palletRequired: false, palletType: '', palletQuantity: '' },
    );
  };

  return (
    <section
      className={divided ? 'border-t border-[var(--customer-border)] pt-4' : ''}
      aria-labelledby="order-pallet-title"
    >
      <div className="flex items-center gap-3">
        <h3 id="order-pallet-title" className="text-sm font-semibold text-[var(--customer-text)]">
          Pallet Details
        </h3>
        <Switch
          checked={value.palletRequired}
          disabled={contractPalletRequired}
          onCheckedChange={setRequired}
          aria-label="Pallet required"
        />
      </div>

      {value.palletRequired && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--customer-text)]">
            Pallet Type <span className="text-[var(--customer-danger)]">*</span>
            <NativeTomSelect
              value={value.palletType}
              disabled={contractPalletRequired}
              onChange={(event) => onChange({ ...value, palletType: event.target.value })}
              className="mt-2 h-10 w-full"
              aria-label="Pallet Type"
              placeholder="Select pallet type"
              searchPlaceholder="Search pallet types..."
            >
              <option value="">Select pallet type</option>
              {availablePalletTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </NativeTomSelect>
          </label>
          <label className="text-sm font-semibold text-[var(--customer-text)]">
            Pallet Quantity <span className="text-[var(--customer-danger)]">*</span>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={value.palletQuantity}
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value)) {
                  onChange({ ...value, palletQuantity: event.target.value });
                }
              }}
              className="mt-2"
              aria-label="Pallet Quantity"
            />
          </label>
        </div>
      )}

      {!contractPalletRequired && value.palletRequired && (
        <p className="mt-2 text-xs text-[var(--customer-text-muted)]">
          This applies to this order only.
        </p>
      )}
    </section>
  );
}
