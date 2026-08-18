import { useRegistration } from '../../context/RegistrationContext';

export function SaveStatus() {
  const { retrySave, saveError, saveStatus } = useRegistration();

  if (saveStatus !== 'error') return null;

  return (
    <button
      type="button"
      onClick={retrySave}
      className="text-sm font-semibold text-red-600 hover:underline"
    >
      {saveError || 'Unable to save changes. Retry.'}
    </button>
  );
}
