import { useRef, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useRegistration } from '../../context/RegistrationContext';

type SaveDraftButtonProps = {
  children?: ReactNode;
  className: string;
  onBeforeSave?: () => boolean;
};

const SAVE_CLICK_THROTTLE_MS = 1200;

export function SaveDraftButton({
  children = 'Save Draft',
  className,
  onBeforeSave,
}: SaveDraftButtonProps) {
  const { hasUnsavedChanges, isLoadingDraft, saveDraft, saveStatus } = useRegistration();
  const lastClickAtRef = useRef(0);
  const isSaving = saveStatus === 'saving';
  const isSaved = saveStatus === 'saved';
  const label = isSaving ? 'Saving...' : isSaved ? 'Saved' : children;
  const isDisabled = isLoadingDraft || isSaving || !hasUnsavedChanges;

  const handleClick = () => {
    const now = Date.now();

    if (isDisabled || now - lastClickAtRef.current < SAVE_CLICK_THROTTLE_MS) return;
    if (onBeforeSave && !onBeforeSave()) return;

    lastClickAtRef.current = now;
    void saveDraft({ createIfMissing: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`${className} ${isSaved ? 'border-[#008c68] text-[#008c68]' : ''}`}
      aria-live="polite"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {label}
        {isSaved && <CheckCircle2 size={17} strokeWidth={2.5} aria-hidden="true" />}
      </span>
    </button>
  );
}
