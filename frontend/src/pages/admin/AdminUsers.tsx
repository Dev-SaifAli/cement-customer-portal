import { Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useSalesAuth } from '../../context/SalesAuthContext';
import {
  AdminUsersApiError,
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  type AdminUser,
  type AdminUserInput,
  type InternalUserRole,
  type InternalUserStatus,
} from '../../services/adminUsersService';

const roles: Array<{ value: InternalUserRole; label: string }> = [
  { value: 'SALES_REP', label: 'Sales Representative' },
  { value: 'PRICE_MANAGER', label: 'Price Manager' },
  { value: 'COMMERCIAL_DIRECTOR', label: 'Commercial Director' },
  { value: 'PRICING_ADMIN', label: 'Pricing Administrator' },
  { value: 'PORTAL_ADMINISTRATOR', label: 'Portal Administrator' },
  { value: 'HADER_MANAGER', label: 'Hader Manager' },
  { value: 'HADER_OPERATIONS', label: 'Hader Operations' },
  { value: 'DISPATCH_USER', label: 'Dispatch User' },
  { value: 'LOADING_USER', label: 'Loading User' },
  { value: 'DELIVERY_TEAM_USER', label: 'Delivery Team User' },
];

const emptyForm = (): AdminUserInput & { password: string; confirmPassword: string } => ({
  name: '', email: '', role: 'SALES_REP', status: 'ACTIVE', password: '', confirmPassword: '',
});

export function AdminUsers() {
  const { user: currentUser } = useSalesAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<InternalUserRole | ''>('');
  const [status, setStatus] = useState<InternalUserStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await listAdminUsers({
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      });
      setUsers(result.users); setPagination(result.pagination);
    } catch {
      setError('Unable to load internal users.');
    } finally { setLoading(false); }
  }, [page, role, search, status]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormError(null); setFormOpen(true); };
  const openEdit = (user: AdminUser) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, role: user.role, status: user.status, password: '', confirmPassword: '' });
    setFormError(null); setFormOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.name.trim()) return setFormError('Name is required.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setFormError('A valid email address is required.');
    if (!editing && form.password.length < 8) return setFormError('Password must be at least 8 characters.');
    if (!editing && form.password !== form.confirmPassword) return setFormError('Passwords do not match.');
    setSaving(true);
    try {
      if (editing) {
        await updateAdminUser(editing.id, { name: form.name, email: form.email, role: form.role, status: form.status });
      } else {
        await createAdminUser(form);
      }
      setFormOpen(false); await load();
    } catch (requestError) {
      setFormError(requestError instanceof AdminUsersApiError ? requestError.message : 'Unable to save user.');
    } finally { setSaving(false); }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void save(); };

  const toggleStatus = async (user: AdminUser) => {
    setError(null);
    if (user.id === currentUser?.id && user.status === 'ACTIVE') {
      setError('You cannot deactivate your own account.');
      return;
    }
    try {
      await updateAdminUser(user.id, { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof AdminUsersApiError
          ? requestError.message
          : 'Unable to update the user status.',
      );
    }
  };

  const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 lg:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="customer-text text-2xl font-bold">User Management</h1><p className="customer-secondary mt-1 text-sm">Create and manage internal portal users and role access.</p></div>
        <Button onClick={openCreate}><Plus size={17} /> Add User</Button>
      </header>

      <section className="customer-card overflow-hidden rounded-xl border shadow-sm">
        <div className="customer-border-soft flex flex-wrap items-center gap-3 border-b p-4">
          <label className="relative min-w-64 flex-1"><Search size={17} className="customer-muted absolute left-3 top-2.5"/><input className="customer-input h-10 w-full rounded-lg border pl-9 pr-3 text-sm" value={search} onChange={(event)=>{setSearch(event.target.value);setPage(1)}} placeholder="Search name or email"/></label>
          <select className="customer-input h-10 rounded-lg border px-3 text-sm" value={role} onChange={(event)=>{setRole(event.target.value as InternalUserRole|'');setPage(1)}}><option value="">All roles</option>{roles.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select className="customer-input h-10 rounded-lg border px-3 text-sm" value={status} onChange={(event)=>{setStatus(event.target.value as InternalUserStatus|'');setPage(1)}}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
          <span className="customer-secondary text-sm">{pagination.total} users</span>
        </div>
        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#b42318]">{error} <button className="ml-2 font-semibold underline" onClick={()=>void load()}>Retry</button></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="customer-surface-secondary customer-secondary"><tr>{['Name','Email','Role','Status','Created','Last Updated','Actions'].map((label)=><th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="customer-divide divide-y">
              {loading ? Array.from({length:5},(_,index)=><tr key={index}>{Array.from({length:7},(_,cell)=><td key={cell} className="px-4 py-4"><div className="customer-surface-secondary h-4 animate-pulse rounded"/></td>)}</tr>) : users.map((user)=><tr key={user.id} className="transition hover:bg-[var(--customer-surface-secondary)]"><td className="customer-text px-4 py-3 font-semibold">{user.name}</td><td className="customer-secondary px-4 py-3">{user.email}</td><td className="customer-secondary px-4 py-3">{roleLabel(user.role)}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${user.status==='ACTIVE'?'bg-emerald-500':'bg-slate-400'}`}/>{user.status==='ACTIVE'?'Active':'Inactive'}</span></td><td className="customer-secondary px-4 py-3">{formatDate(user.createdAt)}</td><td className="customer-secondary px-4 py-3">{formatDate(user.updatedAt)}</td><td className="px-4 py-3"><div className="flex gap-2"><button className="customer-secondary inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 font-semibold hover:text-[var(--customer-primary)]" onClick={()=>openEdit(user)}><Pencil size={15}/> Edit</button><button className="customer-secondary inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 font-semibold hover:text-[var(--customer-primary)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-inherit" disabled={user.id===currentUser?.id && user.status==='ACTIVE'} title={user.id===currentUser?.id && user.status==='ACTIVE'?'You cannot deactivate your own account.':undefined} onClick={()=>void toggleStatus(user)}>{user.status==='ACTIVE'?<UserX size={15}/>:<UserCheck size={15}/>} {user.status==='ACTIVE'?'Deactivate':'Activate'}</button></div></td></tr>) }
              {!loading && users.length===0 && <tr><td colSpan={7} className="customer-secondary px-4 py-12 text-center">No internal users match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="customer-border-soft flex items-center justify-between border-t p-4 text-sm"><span className="customer-secondary">Page {pagination.page} of {lastPage}</span><div className="flex gap-2"><Button variant="secondary" disabled={page<=1} onClick={()=>setPage((value)=>value-1)}>Previous</Button><Button variant="secondary" disabled={page>=lastPage} onClick={()=>setPage((value)=>value+1)}>Next</Button></div></footer>
      </section>

      <Modal open={formOpen} title={editing ? 'Edit User' : 'Add User'} onClose={()=>setFormOpen(false)} footer={<><Button variant="secondary" onClick={()=>setFormOpen(false)}>Cancel</Button><Button loading={saving} onClick={()=>void save()}>{editing?'Save Changes':'Create User'}</Button></>}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <FormField label="Name *"><input className="customer-input h-11 w-full rounded-lg border px-3" value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/></FormField>
          <FormField label="Email *"><input type="email" className="customer-input h-11 w-full rounded-lg border px-3" value={form.email} onChange={(event)=>setForm({...form,email:event.target.value.toLowerCase()})}/></FormField>
          {!editing && <><FormField label="Password *"><input type="password" className="customer-input h-11 w-full rounded-lg border px-3" value={form.password} onChange={(event)=>setForm({...form,password:event.target.value})}/></FormField><FormField label="Confirm Password *"><input type="password" className="customer-input h-11 w-full rounded-lg border px-3" value={form.confirmPassword} onChange={(event)=>setForm({...form,confirmPassword:event.target.value})}/></FormField></>}
          <FormField label="Role *"><select className="customer-input h-11 w-full rounded-lg border px-3" value={form.role} onChange={(event)=>setForm({...form,role:event.target.value as InternalUserRole})}>{roles.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
          <FormField label="Status"><select className="customer-input h-11 w-full rounded-lg border px-3 disabled:cursor-not-allowed disabled:opacity-60" disabled={editing?.id===currentUser?.id} title={editing?.id===currentUser?.id?'You cannot deactivate your own account.':undefined} value={form.status} onChange={(event)=>setForm({...form,status:event.target.value as InternalUserStatus})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>{editing?.id===currentUser?.id && <span className="customer-muted block text-xs">Your own account must remain active.</span>}</FormField>
          {formError && <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#b42318]">{formError}</p>}
        </form>
      </Modal>
    </main>
  );
}

function FormField({label,children}:{label:string;children:ReactNode}) { return <label className="space-y-1.5"><span className="customer-text text-sm font-semibold">{label}</span>{children}</label>; }
function roleLabel(value: InternalUserRole) { return roles.find((role)=>role.value===value)?.label ?? value; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
