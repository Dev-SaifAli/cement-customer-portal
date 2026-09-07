import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
} from '../../components/ui/shadcn';
import { useToast } from '../../components/ui/ToastProvider';
import {
  getApprovalSettings,
  saveListPriceDirectOrderApproval,
  type ListPriceDirectOrderApprovalMode,
} from '../../services/adminPricingService';

const options: Array<{
  value: ListPriceDirectOrderApprovalMode;
  label: string;
  description: string;
}> = [
  {
    value: 'AUTO_APPROVE',
    label: 'Auto Approve',
    description:
      'List-price Direct Orders are automatically approved and converted into a Contract.',
  },
  {
    value: 'MUST_APPROVE',
    label: 'Must Approve',
    description:
      'List-price Direct Orders remain pending approval until an authorized approver approves them.',
  },
];

export function AdminApprovalSettings() {
  const toast = useToast();
  const [value, setValue] = useState<ListPriceDirectOrderApprovalMode>('AUTO_APPROVE');
  const [savedValue, setSavedValue] = useState<ListPriceDirectOrderApprovalMode>('AUTO_APPROVE');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getApprovalSettings()
      .then((settings) => {
        if (cancelled) return;
        const mode = settings.listPriceDirectOrderApproval.value;
        setValue(mode);
        setSavedValue(mode);
        setLoaded(true);
      })
      .catch((settingsError) => {
        if (!cancelled) {
          setError(
            settingsError instanceof Error
              ? settingsError.message
              : 'Unable to load approval settings.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const setting = await saveListPriceDirectOrderApproval(value);
      setValue(setting.value);
      setSavedValue(setting.value);
      toast.success('Approval setting saved successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save approval setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="customer-text text-2xl font-bold">Approval Settings</h1>
          <Badge variant="secondary">Pricing Admin</Badge>
        </div>
        <p className="customer-secondary mt-2 text-sm">
          Configure how eligible list-price Direct Orders are handled when customers submit them.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>List Price Direct Order Approval</CardTitle>
          <CardDescription>
            This setting affects only new eligible list-price Direct Orders. Existing Orders and
            Contracts are not reprocessed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="customer-secondary rounded-lg border border-dashed border-[var(--customer-border)] p-5 text-sm">
              Loading approval setting...
            </div>
          ) : !loaded ? (
            <div className="rounded-lg border border-dashed border-[var(--customer-border)] p-5 text-sm font-semibold text-[var(--customer-text-muted)]">
              Approval setting could not be loaded. Please retry after the configuration service is
              available.
            </div>
          ) : (
            <RadioGroup
              value={value}
              onValueChange={(nextValue) =>
                setValue(nextValue as ListPriceDirectOrderApprovalMode)
              }
              className="gap-3"
            >
              {options.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className="customer-border customer-surface flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition hover:border-[var(--customer-primary)]"
                >
                  <RadioGroupItem id={option.value} value={option.value} className="mt-1" />
                  <span className="space-y-1">
                    <span className="customer-text block text-sm font-bold">{option.label}</span>
                    <span className="customer-secondary block text-sm font-medium leading-6">
                      {option.description}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="customer-secondary text-sm">
              Current mode:{' '}
              <span className="customer-text font-bold">
                {savedValue === 'AUTO_APPROVE' ? 'Auto Approve' : 'Must Approve'}
              </span>
            </p>
            <Button
              type="button"
              onClick={save}
              disabled={loading || !loaded || saving || value === savedValue}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
