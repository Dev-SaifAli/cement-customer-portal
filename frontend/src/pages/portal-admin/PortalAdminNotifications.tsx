import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import { Bell, Pencil, Plus, Send } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  AdminNotificationsApiError,
  createGlobalNotification,
  listGlobalNotifications,
  publishGlobalNotification,
  updateGlobalNotification,
  type GlobalNotification,
  type GlobalNotificationAudience,
  type GlobalNotificationInput,
  type GlobalNotificationRole,
  type GlobalNotificationStatus,
} from '../../services/adminNotificationsService';

const customerRoles: Array<{ value: GlobalNotificationRole; label: string }> = [
  { value: 'CUSTOMER_ADMIN', label: 'Customer Administrators' },
  { value: 'PURCHASER', label: 'Purchasers' },
  { value: 'FINANCE_USER', label: 'Finance Users' },
  { value: 'VIEWER', label: 'Viewers' },
];
const internalRoles: Array<{ value: GlobalNotificationRole; label: string }> = [
  { value: 'SALES_REP', label: 'Sales Representatives' },
  { value: 'PRICE_MANAGER', label: 'Price Managers' },
  { value: 'COMMERCIAL_DIRECTOR', label: 'Commercial Directors' },
  { value: 'PRICING_ADMIN', label: 'Pricing Administrators' },
  { value: 'HADER_MANAGER', label: 'Hader Managers' },
  { value: 'HADER_OPERATIONS', label: 'Hader Operations' },
  { value: 'DISPATCH_USER', label: 'Dispatch Users' },
  { value: 'LOADING_USER', label: 'Loading Users' },
  { value: 'DELIVERY_TEAM_USER', label: 'Delivery Team Users' },
  { value: 'PORTAL_ADMINISTRATOR', label: 'Portal Administrators' },
];

const emptyForm = (): GlobalNotificationInput => ({ title: '', message: '', audience: 'CUSTOMER', targetRoles: [], status: 'ACTIVE' });

export function PortalAdminNotifications() {
  const [records, setRecords] = useState<GlobalNotification[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [page, setPage] = useState(1);
  const [audience, setAudience] = useState<GlobalNotificationAudience | ''>('');
  const [status, setStatus] = useState<GlobalNotificationStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GlobalNotification | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<GlobalNotification | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await listGlobalNotifications({ page, ...(audience ? { audience } : {}), ...(status ? { status } : {}) });
      setRecords(result.notifications); setPagination(result.pagination);
    } catch { setError('Unable to load global notifications.'); }
    finally { setLoading(false); }
  }, [audience, page, status]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormError(null); setFormOpen(true); };
  const openEdit = (record: GlobalNotification) => {
    setEditing(record);
    setForm({ title: record.title, message: record.message, audience: record.audience, targetRoles: record.targetRoles, status: record.status });
    setFormError(null); setFormOpen(true);
  };
  const save = async () => {
    setFormError(null);
    if (!form.title.trim()) return setFormError('Title is required.');
    if (!form.message.trim()) return setFormError('Message is required.');
    setSaving(true);
    try {
      if (editing) await updateGlobalNotification(editing.id, form);
      else await createGlobalNotification(form);
      setFormOpen(false); await load();
    } catch (requestError) {
      setFormError(requestError instanceof AdminNotificationsApiError ? requestError.message : 'Unable to save the notification.');
    } finally { setSaving(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void save(); };
  const publish = async () => {
    if (!publishing) return;
    setError(null); setSaving(true);
    try { await publishGlobalNotification(publishing.id); setPublishing(null); await load(); }
    catch (requestError) { setError(requestError instanceof AdminNotificationsApiError ? requestError.message : 'Unable to publish the notification.'); setPublishing(null); }
    finally { setSaving(false); }
  };

  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const availableRoles = form.audience === 'CUSTOMER' ? customerRoles : internalRoles;
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 lg:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="customer-text text-2xl font-bold">Global Notifications</h1><p className="customer-secondary mt-1 text-sm">Create targeted in-app announcements and publish them to portal users.</p></div>
        <Button onClick={openCreate}><Plus size={17}/> New Notification</Button>
      </header>
      <section className="customer-card overflow-hidden rounded-xl border shadow-sm">
        <div className="customer-border-soft flex flex-wrap items-center gap-3 border-b p-4">
          <NativeTomSelect className="customer-input h-10 rounded-lg border px-3 text-sm" value={audience} onChange={(event)=>{setAudience(event.target.value as GlobalNotificationAudience|'');setPage(1)}}><option value="">All audiences</option><option value="CUSTOMER">Customers</option><option value="SALES">Internal users</option></NativeTomSelect>
          <NativeTomSelect className="customer-input h-10 rounded-lg border px-3 text-sm" value={status} onChange={(event)=>{setStatus(event.target.value as GlobalNotificationStatus|'');setPage(1)}}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></NativeTomSelect>
          <span className="customer-secondary ml-auto text-sm">{pagination.total} notifications</span>
        </div>
        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#b42318]">{error} <button className="ml-2 font-semibold underline" onClick={()=>void load()}>Retry</button></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm"><thead className="customer-surface-secondary customer-secondary"><tr>{['Title','Message','Audience','Target','Status','Created','Published','Actions'].map((label)=><th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="customer-divide divide-y">{loading ? Array.from({length:5},(_,index)=><tr key={index}>{Array.from({length:8},(_,cell)=><td key={cell} className="px-4 py-4"><div className="customer-surface-secondary h-4 animate-pulse rounded"/></td>)}</tr>) : records.map((record)=><tr key={record.id} className="transition hover:bg-[var(--customer-surface-secondary)]"><td className="customer-text max-w-52 px-4 py-3 font-semibold">{record.title}</td><td className="customer-secondary max-w-72 px-4 py-3"><span className="line-clamp-2">{record.message}</span></td><td className="customer-secondary px-4 py-3">{record.audience==='CUSTOMER'?'Customers':'Internal users'}</td><td className="customer-secondary px-4 py-3">{record.targetRoles.length ? `${record.targetRoles.length} roles` : 'All eligible roles'}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${record.status==='ACTIVE'?'bg-emerald-500':'bg-slate-400'}`}/>{record.status==='ACTIVE'?'Active':'Inactive'}</span></td><td className="customer-secondary whitespace-nowrap px-4 py-3">{formatDate(record.createdAt)}</td><td className="customer-secondary whitespace-nowrap px-4 py-3">{record.publishedAt ? `${formatDate(record.publishedAt)} · ${record.deliveredCount} recipients` : 'Not published'}</td><td className="px-4 py-3"><div className="flex gap-2">{!record.publishedAt && <><button className="customer-secondary inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 font-semibold hover:text-[var(--customer-primary)]" onClick={()=>openEdit(record)}><Pencil size={15}/> Edit</button><button disabled={record.status!=='ACTIVE'} className="customer-secondary inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 font-semibold hover:text-[var(--customer-primary)] disabled:cursor-not-allowed disabled:opacity-45" onClick={()=>setPublishing(record)}><Send size={15}/> Publish</button></>}</div></td></tr>)}
          {!loading && records.length===0 && <tr><td colSpan={8} className="customer-secondary px-4 py-14 text-center"><Bell className="mx-auto mb-3" size={24}/><p className="customer-text font-semibold">No global notifications yet</p><p className="mt-1">Create an announcement when portal users need a shared update.</p></td></tr>}</tbody></table>
        </div>
        <footer className="customer-border-soft flex items-center justify-between border-t p-4 text-sm"><span className="customer-secondary">Page {pagination.page} of {lastPage}</span><div className="flex gap-2"><Button variant="secondary" disabled={page<=1} onClick={()=>setPage((value)=>value-1)}>Previous</Button><Button variant="secondary" disabled={page>=lastPage} onClick={()=>setPage((value)=>value+1)}>Next</Button></div></footer>
      </section>

      <Modal open={formOpen} title={editing ? 'Edit Global Notification' : 'New Global Notification'} onClose={()=>setFormOpen(false)} footer={<><Button variant="secondary" onClick={()=>setFormOpen(false)}>Cancel</Button><Button loading={saving} onClick={()=>void save()}>{editing?'Save Changes':'Create Notification'}</Button></>}>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1.5"><span className="customer-text text-sm font-semibold">Title *</span><input className="customer-input h-11 w-full rounded-lg border px-3" maxLength={180} value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})}/></label>
          <label className="block space-y-1.5"><span className="customer-text text-sm font-semibold">Message *</span><textarea className="customer-input min-h-28 w-full rounded-lg border p-3" maxLength={2000} value={form.message} onChange={(event)=>setForm({...form,message:event.target.value})}/></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5"><span className="customer-text text-sm font-semibold">Audience *</span><NativeTomSelect className="customer-input h-11 w-full rounded-lg border px-3" value={form.audience} onChange={(event)=>setForm({...form,audience:event.target.value as GlobalNotificationAudience,targetRoles:[]})}><option value="CUSTOMER">Customers</option><option value="SALES">Internal users</option></NativeTomSelect></label><label className="space-y-1.5"><span className="customer-text text-sm font-semibold">Status</span><NativeTomSelect className="customer-input h-11 w-full rounded-lg border px-3" value={form.status} onChange={(event)=>setForm({...form,status:event.target.value as GlobalNotificationStatus})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></NativeTomSelect></label></div>
          <fieldset className="customer-border-soft rounded-xl border p-3"><legend className="customer-text px-1 text-sm font-semibold">Target roles <span className="customer-muted font-normal">(none selected = all)</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{availableRoles.map((role)=><label key={role.value} className="customer-secondary flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"><input type="checkbox" checked={form.targetRoles.includes(role.value)} onChange={(event)=>setForm({...form,targetRoles:event.target.checked?[...form.targetRoles,role.value]:form.targetRoles.filter((value)=>value!==role.value)})}/>{role.label}</label>)}</div></fieldset>
          {formError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#b42318]">{formError}</p>}
        </form>
      </Modal>
      <Modal open={Boolean(publishing)} title="Publish Global Notification" onClose={()=>setPublishing(null)} footer={<><Button variant="secondary" onClick={()=>setPublishing(null)}>Cancel</Button><Button loading={saving} onClick={()=>void publish()}><Send size={16}/> Publish</Button></>}><p className="customer-secondary text-sm">This will deliver <strong className="customer-text">{publishing?.title}</strong> to all active users matching the selected audience and roles. Publishing cannot be repeated.</p></Modal>
    </main>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
