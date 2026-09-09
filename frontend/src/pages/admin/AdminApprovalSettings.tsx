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
  Switch,
} from '../../components/ui/shadcn';
import { useToast } from '../../components/ui/ToastProvider';
import {
  getApprovalSettings,
  saveListPriceDirectOrderApproval,
  saveContractOrderCreation,
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
  const [haderEnabled, setHaderEnabled] = useState(false);
  const [savedHaderEnabled, setSavedHaderEnabled] = useState(false);
  const [dispatchEnabled, setDispatchEnabled] = useState(false);
  const [savedDispatchEnabled, setSavedDispatchEnabled] = useState(false);
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
        setHaderEnabled(settings.haderContractOrderCreation.value);
        setSavedHaderEnabled(settings.haderContractOrderCreation.value);
        setDispatchEnabled(settings.dispatchContractOrderCreation.value);
        setSavedDispatchEnabled(settings.dispatchContractOrderCreation.value);
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
      const [setting, haderSetting, dispatchSetting] = await Promise.all([
        value !== savedValue ? saveListPriceDirectOrderApproval(value) : Promise.resolve({ value }),
        haderEnabled !== savedHaderEnabled ? saveContractOrderCreation('hader', haderEnabled) : Promise.resolve({ value: haderEnabled }),
        dispatchEnabled !== savedDispatchEnabled ? saveContractOrderCreation('dispatch', dispatchEnabled) : Promise.resolve({ value: dispatchEnabled }),
      ]);
      setValue(setting.value);
      setSavedValue(setting.value);
      setHaderEnabled(haderSetting.value);
      setSavedHaderEnabled(haderSetting.value);
      setDispatchEnabled(dispatchSetting.value);
      setSavedDispatchEnabled(dispatchSetting.value);
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
              disabled={loading || !loaded || saving || (value === savedValue && haderEnabled === savedHaderEnabled && dispatchEnabled === savedDispatchEnabled)}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract Order Creation</CardTitle>
          <CardDescription>Control operational access to create customer Orders from eligible active Contracts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingSwitch
            id="hader-contract-orders"
            label="Allow Hader to Create Orders from Contracts"
            description="Allows Hader managers and operations users to use active DELIVERY Contracts."
            checked={haderEnabled}
            disabled={loading || !loaded || saving}
            onCheckedChange={setHaderEnabled}
          />
          <Separator />
          <SettingSwitch
            id="dispatch-contract-orders"
            label="Allow Dispatch to Create Orders from Contracts"
            description="Allows Dispatch users to use active PICKUP Contracts."
            checked={dispatchEnabled}
            disabled={loading || !loaded || saving}
            onCheckedChange={setDispatchEnabled}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={save}
              disabled={loading || !loaded || saving || (value === savedValue && haderEnabled === savedHaderEnabled && dispatchEnabled === savedDispatchEnabled)}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingSwitch({ id, label, description, checked, disabled, onCheckedChange }: {
  id: string; label: string; description: string; checked: boolean; disabled: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Label htmlFor={id} className="space-y-1">
        <span className="customer-text block text-sm font-bold">{label}</span>
        <span className="customer-secondary block text-sm font-medium">{description}</span>
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
