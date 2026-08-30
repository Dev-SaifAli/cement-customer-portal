import { Check, Globe2, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  createTaxConfiguration,
  listTaxConfigurations,
  TaxConfigurationRequestError,
  updateTaxConfiguration,
  type VatMode,
} from '../../services/taxConfigurationsService';

export function AdminTaxConfiguration() {
  const [configurationId, setConfigurationId] = useState<string | null>(null);
  const [vatMode, setVatMode] = useState<VatMode>('LOCAL');
  const [rate, setRate] = useState('15');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rateError, setRateError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const configurations = await listTaxConfigurations();
      const current = configurations.find((item) => item.status === 'ACTIVE') ?? configurations[0];
      if (current) {
        setConfigurationId(current.id);
        setVatMode(current.vatMode);
        setRate(String(current.ratePercent));
        setUpdatedAt(current.updatedAt);
        setUpdatedBy(current.updatedBy);
      }
    } catch {
      setError('Unable to load tax configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const validateRate = (value = rate) => {
    const parsed = Number(value);
    const message = value.trim() === '' || !Number.isFinite(parsed)
      ? 'Local VAT rate is required.'
      : parsed < 0 || parsed > 100
        ? 'Local VAT rate must be between 0 and 100.'
        : '';
    setRateError(message);
    return message;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError('');
    if (validateRate()) return;
    setSaving(true);
    try {
      const input = { vatMode, ratePercent: Number(rate) };
      const result = configurationId
        ? await updateTaxConfiguration(configurationId, input)
        : await createTaxConfiguration(input);
      setConfigurationId(result.id);
      setVatMode(result.vatMode);
      setRate(String(result.ratePercent));
      setUpdatedAt(result.updatedAt);
      setUpdatedBy(result.updatedBy);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof TaxConfigurationRequestError ? cause.message : 'Unable to save tax configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-[900px] space-y-4">
      <header className="customer-border-soft border-b pb-4">
        <h1 className="customer-text text-2xl font-bold">Tax Configuration</h1>
        <p className="customer-secondary mt-1 text-sm">Configure VAT treatment for local and export commercial transactions.</p>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#b42318]">{error}</div>}

      <section className="customer-card rounded-xl border p-5">
        {loading ? (
          <div className="space-y-4"><div className="customer-surface-secondary h-11 animate-pulse rounded-lg" /><div className="customer-surface-secondary h-11 animate-pulse rounded-lg" /></div>
        ) : (
          <div className="space-y-6">
            <div>
              <span className="customer-text mb-2 block text-sm font-semibold">VAT Mode</span>
              <div className="customer-surface-secondary grid max-w-[430px] grid-cols-2 gap-1 rounded-lg border p-1">
                <ModeButton active={vatMode === 'LOCAL'} onClick={() => setVatMode('LOCAL')} icon={<MapPin size={16} />} label="Local (VAT)" />
                <ModeButton active={vatMode === 'EXPORT'} onClick={() => setVatMode('EXPORT')} icon={<Globe2 size={16} />} label="Export (0%)" />
              </div>
            </div>

            {vatMode === 'LOCAL' ? (
              <div className="max-w-[260px]">
                <label htmlFor="local-vat-rate" className="customer-text mb-2 block text-sm font-semibold">Local VAT Rate</label>
                <div className="relative">
                  <input id="local-vat-rate" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={rate} onChange={(event) => { setRate(event.target.value); if (rateError) validateRate(event.target.value); }} onBlur={() => validateRate()} aria-invalid={Boolean(rateError)} className={`customer-input h-11 w-full rounded-lg border px-3 pr-10 ${rateError ? 'border-red-500' : ''}`} />
                  <span className="customer-secondary pointer-events-none absolute right-3 top-2.5">%</span>
                </div>
                {rateError && <p className="mt-1 text-xs text-[#b42318]">{rateError}</p>}
              </div>
            ) : (
              <div>
                <p className="customer-text text-sm font-semibold">Export</p>
                <p className="customer-primary mt-1 text-sm font-semibold">0% VAT</p>
              </div>
            )}

            <div>
              <span className="customer-text mb-3 block text-sm font-semibold">Applies To</span>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {['Product', 'Delivery', 'Pallet'].map((label) => <span key={label} className="customer-text inline-flex items-center gap-2 text-sm"><span className="flex h-5 w-5 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-white"><Check size={14} strokeWidth={3} /></span>{label}</span>)}
              </div>
            </div>

            <div className="customer-border-soft flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="customer-secondary text-xs">{updatedAt ? <>Last updated {new Date(updatedAt).toLocaleString()}{updatedBy ? ` by ${updatedBy}` : ''}</> : 'Not configured yet'}</div>
              <div className="flex items-center gap-3">{saved && <span className="text-sm font-medium text-emerald-600">Saved</span>}<button type="submit" disabled={saving} className="customer-primary-bg h-10 rounded-lg px-6 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button></div>
            </div>
          </div>
        )}
      </section>
    </form>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${active ? 'customer-primary-bg text-white shadow-sm' : 'customer-secondary hover:bg-[var(--customer-surface)] hover:text-[var(--customer-text)]'}`}>{icon}{label}</button>;
}
