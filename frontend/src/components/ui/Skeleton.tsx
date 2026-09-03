export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`ui-skeleton ${className}`} aria-hidden="true" />;
}
