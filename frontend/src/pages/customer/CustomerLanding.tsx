import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Building2, MapPin, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  getCustomerDashboard,
  type CustomerDashboardData,
} from '../../services/customerDashboardService';

export function CustomerLanding() {
  const { account, user } = useCustomerAuth();
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      const data = await getCustomerDashboard();
      setDashboard(data);
    } catch {
      setDashboardError('We could not load your customer dashboard details. Please try again.');
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Customer Dashboard</h1>
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <p className="text-sm font-semibold text-slate-700">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {account?.companyName ?? 'Customer Portal'}
        </h1>
        <p className="mt-1 text-sm font-medium text-[#4b2c71]">AlSafwa Cement Customer Portal</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
        <h2 className="text-base font-bold text-slate-950">Quick Actions</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <QuickActionLink
            to="/customer/profile"
            icon={<Building2 className="h-4 w-4" />}
            label="View Profile"
          />
          <QuickActionLink
            to="/customer/locations"
            icon={<MapPin className="h-4 w-4" />}
            label="View Delivery Locations"
          />
        </div>
      </section>

      <section
        id="account-overview"
        className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6"
      >
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Account Overview</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Portal-owned customer account information
            </p>
          </div>
        </div>

        {isLoadingDashboard ? (
          <FieldSkeletonGrid columns="lg:grid-cols-3" />
        ) : dashboardError ? (
          <DashboardErrorState message={dashboardError} onRetry={() => void loadDashboard()} />
        ) : (
          <dl className="grid gap-x-6 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <OverviewField
              label="Company Name"
              value={dashboard?.account.companyName ?? account?.companyName}
            />
            <OverviewField
              label="Account Status"
              value={formatAccountStatus(dashboard?.account.status)}
            />
            <OverviewField
              label="Registration Reference"
              value={dashboard?.registration.reference}
            />
            <OverviewField
              label="Activation Date"
              value={formatDate(dashboard?.account.activatedAt)}
            />
            <OverviewField
              label="Registered Email"
              value={dashboard?.administrator.email ?? user?.email}
            />
            <OverviewField label="Contact Phone" value={dashboard?.contact.phone} />
          </dl>
        )}
      </section>

      <section
        id="customer-administrator"
        className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6"
      >
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-base font-bold text-slate-950">Customer Administrator</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Primary administrator for this customer portal account
          </p>
        </div>

        {isLoadingDashboard ? (
          <FieldSkeletonGrid columns="lg:grid-cols-4" />
        ) : dashboardError ? (
          <DashboardErrorState message={dashboardError} onRetry={() => void loadDashboard()} />
        ) : (
          <dl className="grid gap-x-6 gap-y-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewField label="Name" value={dashboard?.administrator.name ?? user?.name} />
            <OverviewField label="Email" value={dashboard?.administrator.email ?? user?.email} />
            <OverviewField label="Phone" value={dashboard?.administrator.phone} />
            <OverviewField label="Role" value={formatCustomerRole(dashboard?.administrator.role)} />
          </dl>
        )}
      </section>

      <section
        id="delivery-locations"
        className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6"
      >
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Delivery Locations</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {dashboard?.deliveryLocations.count ?? 0} Saved Locations
            </p>
          </div>
        </div>

        {isLoadingDashboard ? (
          <LocationSkeletonGrid />
        ) : dashboardError ? (
          <DashboardErrorState message={dashboardError} onRetry={() => void loadDashboard()} />
        ) : !dashboard?.deliveryLocations.items.length ? (
          <p className="py-5 text-sm font-medium text-slate-500">
            No delivery locations available.
          </p>
        ) : (
          <div className="grid gap-3 pt-5 lg:grid-cols-3">
            {dashboard.deliveryLocations.items.slice(0, 3).map((location, index) => (
              <div
                key={location.id ?? `${location.name ?? 'location'}-${index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      {location.name || 'Not provided'}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {formatLocationArea(location.city, location.region)}
                    </p>
                  </div>
                  {location.isPrimary && (
                    <span className="rounded-full bg-[#f4eaf5] px-2 py-1 text-[11px] font-bold text-[#7f1d73]">
                      Primary
                    </span>
                  )}
                </div>

                {location.hasMapLocation && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Map location selected
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm font-semibold text-red-700">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}

function FieldSkeletonGrid({ columns }: { columns: string }) {
  return (
    <div className={`grid gap-x-6 gap-y-4 pt-5 sm:grid-cols-2 ${columns}`}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function LocationSkeletonGrid() {
  return (
    <div className="grid gap-3 pt-5 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-3 w-36 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function QuickActionLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-[#7f1d73] hover:text-[#7f1d73] focus:outline-none focus:ring-2 focus:ring-[#7f1d73]/20 sm:justify-start"
    >
      <span className="text-[#7f1d73]">{icon}</span>
      {label}
    </Link>
  );
}

function OverviewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value || 'Not provided'}</dd>
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

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatCustomerRole(role: string | null | undefined) {
  if (role === 'CUSTOMER_ADMIN') return 'Customer Administrator';

  return 'Not provided';
}

function formatLocationArea(city: string | null, region: string | null) {
  const parts = [city, region].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Not provided';
}
