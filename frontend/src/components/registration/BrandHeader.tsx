import Logo from '../Logo/Logo';

type BrandHeaderProps = {
  subtitle?: string;
};

export function BrandHeader({ subtitle = 'Customer Portal Registration' }: BrandHeaderProps) {
  return (
    <header className="h-[68px] border-b border-[#e4dfe5] bg-white">
      <div className="mx-auto flex h-full max-w-[1280px] items-center px-6">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <div className="h-8 w-px bg-[#ddd6df]" />
          <span className="text-[15px] font-medium uppercase tracking-[0.08em] text-gray-500">
            {subtitle}
          </span>
        </div>
      </div>
    </header>
  );
}
