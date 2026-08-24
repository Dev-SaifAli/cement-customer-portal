import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  Mail,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  getCustomerDashboard,
  type CustomerDashboardData,
} from '../../services/customerDashboardService';
import {
  getCustomerProducts,
  type CustomerProduct,
} from '../../services/customerProductsService';

export function CustomerLanding() {
  const { account, user } = useCustomerAuth();
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      setDashboard(await getCustomerDashboard());
    } catch {
      setDashboardError('We could not load your customer dashboard details. Please try again.');
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    void getCustomerProducts({ page: 1 })
      .then((result) => setProducts(result.items.slice(0, 4)))
      .catch(() => setProducts([]));
  }, []);

  const quickActions = useMemo(() => {
    const actions: QuickAction[] = [];
    if (user?.role === 'CUSTOMER_ADMIN' || user?.role === 'PURCHASER') {
      actions.push(
        {
          to: '/customer/quotations/new',
          title: 'New Quotation',
          description: 'Create a new quotation request',
          icon: <FilePlus2 size={20} />,
        },
        {
          to: '/customer/quotations',
          title: 'View Quotations',
          description: 'Track and manage your quotations',
          icon: <FileText size={20} />,
        },
      );
    }
    actions.push(
      {
        to: '/customer/contracts',
        title: 'View Contracts',
        description: 'View your active contracts',
        icon: <BriefcaseBusiness size={20} />,
      },
      {
        to: '/customer/profile',
        title: 'View Profile',
        description: 'Manage your account information',
        icon: <UserCircle size={20} />,
      },
    );
    if (user?.role === 'CUSTOMER_ADMIN' || user?.role === 'PURCHASER') {
      actions.push({
        to: '/customer/locations',
        title: 'Delivery Locations',
        description: 'Manage your delivery locations',
        icon: <MapPin size={20} />,
      });
    }
    return actions;
  }, [user?.role]);

  const activeProduct = products[activeProductIndex];
  const changeProduct = (direction: -1 | 1) => {
    if (products.length < 2) return;
    setActiveProductIndex((current) => (current + direction + products.length) % products.length);
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Customer Dashboard</h1>

      <section className="customer-card overflow-hidden rounded-2xl border">
        <div className="grid min-h-[260px] lg:grid-cols-[0.9fr_1.8fr]">
          <div className="relative overflow-hidden px-6 py-7 sm:px-8">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_bottom,rgba(84,36,122,0.11),transparent_70%)]" />
            <div className="relative">
              <p className="customer-secondary text-sm font-medium">
                Welcome back,{' '}
                <span className="customer-primary font-bold">{user?.name ?? 'Customer'}</span>
              </p>
              <h2 className="customer-text mt-3 text-3xl font-bold tracking-tight">
                {account?.companyName ?? 'Customer Portal'}
              </h2>
              <p className="customer-primary mt-2 text-sm font-medium">
                AlSafwa Cement Customer Portal
              </p>
              <div className="customer-border-soft mt-6 flex max-w-xs items-start gap-3 border-t pt-5">
                <ShieldCheck className="customer-primary mt-0.5 h-5 w-5 shrink-0" />
                <p className="customer-secondary text-sm leading-6">
                  Your trusted partner for high-quality cement solutions
                </p>
              </div>
            </div>
          </div>

          <div className="relative m-3 min-h-[235px] overflow-hidden rounded-xl bg-[linear-gradient(120deg,#25103d_0%,#54247a_58%,#7d3aa3_100%)] px-8 py-7 text-white sm:px-10">
            <div className="relative z-10 max-w-[58%]">
              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">
                {activeProduct ? 'Featured Product' : 'AlSafwa Cement'}
              </span>
              <h3 className="mt-4 text-2xl font-bold leading-tight">
                {activeProduct?.productName ?? 'Building Saudi Arabia Together'}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/80">
                {activeProduct?.shortDescription ??
                  activeProduct?.description ??
                  'Explore reliable cement solutions for your next project.'}
              </p>
              <Link
                to="/customer/products"
                className="customer-always-light mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
              >
                View Products <ArrowRight size={16} />
              </Link>
            </div>

            <div className="absolute inset-y-3 right-5 flex w-[35%] items-center justify-center sm:right-10">
              {activeProduct?.image ? (
                <DashboardProductImage product={activeProduct} />
              ) : (
                <Package className="h-28 w-28 text-white/20" strokeWidth={1.2} />
              )}
            </div>

            {products.length > 1 && (
              <>
                <button type="button" onClick={() => changeProduct(-1)} className="customer-always-light absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-lg" aria-label="Previous product">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => changeProduct(1)} className="customer-always-light absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-lg" aria-label="Next product">
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                  {products.map((product, index) => (
                    <button key={product.id} type="button" onClick={() => setActiveProductIndex(index)} className={`h-1.5 rounded-full transition-all ${index === activeProductIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`} aria-label={`Show ${product.productName}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <DashboardSection title="Quick Actions">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quickActions.map((action) => (
            <QuickActionLink key={action.to} {...action} />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection title="Account Overview" subtitle="Portal-owned customer account information">
        {isLoadingDashboard ? (
          <FieldSkeletonGrid count={6} columns="lg:grid-cols-3" />
        ) : dashboardError ? (
          <DashboardErrorState message={dashboardError} onRetry={() => void loadDashboard()} />
        ) : (
          <dl className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
            <OverviewField icon={<Building2 />} label="Company Name" value={dashboard?.account.companyName ?? account?.companyName} />
            <OverviewField icon={<BadgeCheck />} label="Account Status" value={formatAccountStatus(dashboard?.account.status)} success={dashboard?.account.status === 'ACTIVE'} />
            <OverviewField icon={<FileText />} label="Registration Reference" value={dashboard?.registration.reference} />
            <OverviewField icon={<CalendarDays />} label="Activation Date" value={formatDate(dashboard?.account.activatedAt)} />
            <OverviewField icon={<Mail />} label="Registered Email" value={dashboard?.administrator.email ?? user?.email} />
            <OverviewField icon={<Phone />} label="Contact Phone" value={dashboard?.contact.phone} />
          </dl>
        )}
      </DashboardSection>

      <DashboardSection title="Customer Administrator" subtitle="Primary administrator for this customer portal account">
        {isLoadingDashboard ? (
          <FieldSkeletonGrid count={4} columns="lg:grid-cols-4" />
        ) : dashboardError ? (
          <DashboardErrorState message={dashboardError} onRetry={() => void loadDashboard()} />
        ) : (
          <dl className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewField icon={<UserCircle />} label="Name" value={dashboard?.administrator.name} />
            <OverviewField icon={<Mail />} label="Email" value={dashboard?.administrator.email} />
            <OverviewField icon={<Phone />} label="Phone" value={dashboard?.administrator.phone} />
            <OverviewField icon={<ShieldCheck />} label="Role" value={formatCustomerRole(dashboard?.administrator.role)} />
          </dl>
        )}
      </DashboardSection>
    </div>
  );
}

interface QuickAction {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}

function DashboardProductImage({ product }: { product: CustomerProduct }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [product.image]);

  if (!product.image || failed) {
    return <Package className="h-28 w-28 text-white/20" strokeWidth={1.2} />;
  }

  return (
    <img
      src={product.image}
      alt={product.productName}
      onError={() => setFailed(true)}
      className="h-full max-h-[215px] w-full object-contain drop-shadow-2xl"
    />
  );
}

function DashboardSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="customer-card rounded-2xl border px-5 py-5 sm:px-6">
      <div className="customer-border-soft mb-4 border-b pb-4">
        <h2 className="customer-text text-base font-bold">{title}</h2>
        {subtitle && <p className="customer-muted mt-1 text-xs font-medium">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function QuickActionLink({ to, title, description, icon }: QuickAction) {
  return (
    <Link to={to} className="customer-border group flex min-h-24 items-center gap-3 rounded-xl border p-3.5 transition hover:border-[var(--customer-primary)] hover:bg-[var(--customer-primary-soft)]">
      <span className="customer-primary-soft customer-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="customer-text block text-sm font-bold">{title}</span>
        <span className="customer-muted mt-1 block text-xs leading-5">{description}</span>
      </span>
      <ChevronRight className="customer-muted h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-[var(--customer-primary)]" />
    </Link>
  );
}

function OverviewField({ icon, label, value, success = false }: { icon: ReactNode; label: string; value: string | null | undefined; success?: boolean }) {
  return (
    <div className="customer-border-soft flex min-w-0 items-center gap-3 border-b px-2 py-4 last:border-b-0 sm:px-4 lg:border-b-0 lg:border-r lg:[&:nth-child(3n)]:border-r-0">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${success ? 'bg-emerald-500/10 text-[var(--customer-success)]' : 'customer-primary-soft customer-primary'} [&>svg]:h-5 [&>svg]:w-5`}>{icon}</span>
      <div className="min-w-0">
        <dt className="customer-muted text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</dt>
        <dd className={`mt-1 truncate text-sm font-semibold ${success ? 'text-[var(--customer-success)]' : 'customer-text'}`}>{value || 'Not provided'}</dd>
      </div>
    </div>
  );
}

function DashboardErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--customer-danger)]" /><p className="text-sm font-semibold text-[var(--customer-danger)]">{message}</p></div>
        <button type="button" onClick={onRetry} className="customer-surface inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-sm font-bold text-[var(--customer-danger)]"><RotateCcw className="h-4 w-4" />Retry</button>
      </div>
    </div>
  );
}

function FieldSkeletonGrid({ count, columns }: { count: number; columns: string }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${columns}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="customer-primary-soft h-16 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

function formatAccountStatus(status: string | null | undefined) {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'INACTIVE') return 'Inactive';
  return 'Not provided';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCustomerRole(role: string | null | undefined) {
  return role === 'CUSTOMER_ADMIN' ? 'Customer Administrator' : 'Not provided';
}
