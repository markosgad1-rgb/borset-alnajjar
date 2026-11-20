// Central permission catalogue.
// Every page and every sensitive action has its own key. A user's explicit choice is stored in
// user.permissions.perms[key]. If a key was never set (accounts created before this feature) the OLD
// flags decide, so nobody gains or loses access by upgrading. The admin account is never restricted.
import type { User, UserPermissions } from '../types';

type Legacy = Partial<UserPermissions>;
type Def = { key: string; label: string; legacy: (p: Legacy) => boolean };

const pg = (key: string, label: string, legacy: (p: Legacy) => boolean): Def => ({ key: `view.${key}`, label, legacy });

export const PAGE_DEFS: Def[] = [
  pg('dashboard', 'الرئيسية', () => true),
  pg('sales', 'فواتير البيع', p => !!p.canViewSales),
  pg('sales-history', 'سجل الفواتير', p => !!p.canViewInvoicesLog),
  pg('purchases', 'المشتريات', p => !!p.canViewPurchases),
  pg('warehouse', 'المخزن', p => !!p.canViewInventory),
  pg('customers', 'العملاء', p => !!p.canViewCustomers),
  pg('suppliers', 'الموردين', p => !!p.canViewSuppliers),
  pg('employees', 'الموظفين', p => !!p.canViewTreasury),
  pg('collections', 'التحصيل', p => !!p.canViewTreasury),
  pg('transfers', 'التحويلات', p => !!p.canViewTreasury),
  pg('expenses', 'المصروفات', p => !!p.canViewTreasury),
  pg('treasury', 'الخزنة', p => !!p.canViewTreasury),
  pg('reports', 'التقارير', p => !!p.canViewReports),
  pg('trash', 'سلة المهملات', p => !!(p.canDeleteInvoices || p.canDeleteCustomers || p.canDeleteSuppliers)),
  pg('activity', 'سجل النشاط', () => false),
];

export interface ActionGroup { title: string; items: Def[] }

const ac = (key: string, label: string, legacy: (p: Legacy) => boolean): Def => ({ key, label, legacy });
const open = () => true;

export const ACTION_GROUPS: ActionGroup[] = [
  { title: 'فواتير البيع', items: [
    ac('invoice.edit', 'تعديل الفواتير السابقة', p => !!p.canEditInvoices),
    ac('invoice.delete', 'حذف فاتورة بيع', p => !!p.canDeleteInvoices),
    ac('invoice.review', 'مراجعة واعتماد الفواتير الجديدة (والتنبيه بها)', () => false),
    ac('invoice.clearAll', 'مسح كل الفواتير', p => !!p.canDeleteLedgers),
    ac('price.edit', 'تعديل السعر داخل الفاتورة', p => !!p.canEditPrices),
  ]},
  { title: 'المشتريات', items: [
    ac('purchase.edit', 'تعديل فاتورة مشتريات (وتسعير المعلّق)', p => !!p.canEditPurchases),
    ac('purchase.review', 'مراجعة واعتماد فواتير المشتريات الجديدة (والتنبيه بها)', () => false),
    ac('purchase.delete', 'حذف فاتورة مشتريات', p => !!(p.canDeletePurchases || p.canEditPurchases)),
  ]},
  { title: 'العملاء', items: [
    ac('customer.add', 'إضافة عميل', open),
    ac('customer.edit', 'تعديل بيانات عميل', open),
    ac('customer.delete', 'حذف عميل', p => !!p.canDeleteCustomers),
  ]},
  { title: 'الموردين', items: [
    ac('supplier.add', 'إضافة مورد', open),
    ac('supplier.edit', 'تعديل بيانات مورد', open),
    ac('supplier.delete', 'حذف مورد', p => !!p.canDeleteSuppliers),
  ]},
  { title: 'المخزن والأصناف', items: [
    ac('product.add', 'إضافة صنف', p => !!p.canEditWarehouse),
    ac('product.edit', 'تعديل صنف', p => !!p.canEditWarehouse),
    ac('product.delete', 'حذف صنف', p => !!p.canEditWarehouse),
    ac('product.clearAll', 'مسح كل الأصناف / دمج التكرار', p => !!p.canEditWarehouse),
    ac('stock.transfer', 'تحويل بضاعة بين المخازن', p => !!p.canEditWarehouse),
  ]},
  { title: 'الموظفين', items: [
    ac('employee.add', 'إضافة موظف', open),
    ac('employee.edit', 'تعديل بيانات موظف', open),
    ac('employee.delete', 'حذف موظف', open),
  ]},
  { title: 'كشوف الحساب والخزنة والتحويلات', items: [
    ac('ledger.deleteMovement', 'حذف حركة من كشف حساب (عميل / مورد)', open),
    ac('ledger.clear', 'تصفير كشف حساب كامل', p => !!p.canDeleteLedgers),
    ac('transfer.delete', 'حذف تحويل', open),
    ac('treasury.manage', 'تحويل نقدية بين الإدارات / رصيد افتتاحي', p => !!p.canManageTreasury),
    ac('treasury.clear', 'تصفير الخزنة', p => !!p.canDeleteLedgers),
  ]},
  { title: 'سلة المهملات والنسخ الاحتياطي', items: [
    ac('trash.restore', 'استرجاع من سلة المهملات', p => !!(p.canDeleteInvoices || p.canDeleteCustomers || p.canDeleteSuppliers)),
    ac('trash.purge', 'حذف نهائي من سلة المهملات', p => !!(p.canDeleteInvoices || p.canDeleteCustomers || p.canDeleteSuppliers)),
    ac('backup', 'النسخ الاحتياطي والاسترجاع', p => !!p.canManageBackup),
  ]},
];

const ALL_DEFS: Def[] = [...PAGE_DEFS, ...ACTION_GROUPS.flatMap(g => g.items)];
const DEF_BY_KEY: Record<string, Def> = Object.fromEntries(ALL_DEFS.map(d => [d.key, d]));

export const isFullAdmin = (u?: Partial<User> | null) => !!u && (u.role === 'ADMIN' || u.username === 'admin');

export const getPermLabel = (key: string) => DEF_BY_KEY[key]?.label || key;

/** Effective value of one key for one user (explicit choice first, old flags as fallback). */
export const permValue = (perms: Legacy | undefined | null, key: string): boolean => {
  const p: any = perms || {};
  const explicit = p.perms && typeof p.perms === 'object' ? p.perms[key] : undefined;
  if (typeof explicit === 'boolean') return explicit;
  const def = DEF_BY_KEY[key];
  return def ? def.legacy(p) : false;
};

export const canDo = (user: Partial<User> | null | undefined, key: string): boolean => {
  if (!user) return false;
  if (isFullAdmin(user)) return true;
  return permValue(user.permissions, key);
};

/** مزايا اختيارية: مفيش أحد غير الأدمن الأساسي بيشوفها إلا لو اتفعّلت له صراحةً */
export const canFeature = (user: Partial<User> | null | undefined, f: 'clearStatement' | 'archiveStatement'): boolean => {
  if (!user) return false;
  if (user.username === 'admin') return true;
  return (user as any).features?.[f] === true;
};

export const canViewPage = (user: Partial<User> | null | undefined, page: string): boolean => {
  if (page === 'activity') return isFullAdmin(user) || canDo(user, 'view.activity');
  if (page === 'system') return !!user && (user.username === 'admin' || (isFullAdmin(user) && (user as any).allowSystemPage === true));
  if (page === 'users') return isFullAdmin(user) && user?.username === 'admin';
  const def = DEF_BY_KEY[`view.${page}`];
  if (!def) return true;
  return canDo(user, def.key);
};

export const firstAllowedPage = (user: Partial<User> | null | undefined): string | null => {
  for (const d of PAGE_DEFS) {
    const page = d.key.slice(5);
    if (canDo(user, d.key)) return page;
  }
  return null;
};

/** Explicit snapshot of every key for a given permissions object (used to fill the editor form). */
export const effectiveMap = (perms: Legacy | undefined | null): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  ALL_DEFS.forEach(d => { out[d.key] = permValue(perms, d.key); });
  return out;
};

export const uniformMap = (value: boolean): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  ALL_DEFS.forEach(d => { out[d.key] = value; });
  return out;
};

/** Keeps the old flags in step with the new map so any older code path still agrees. */
export const syncLegacyFlags = (perms: Record<string, boolean>, base: UserPermissions): UserPermissions => {
  const v = (k: string) => !!perms[k];
  return {
    ...base,
    perms,
    canViewSales: v('view.sales'),
    canViewInvoicesLog: v('view.sales-history'),
    canViewPurchases: v('view.purchases'),
    canViewInventory: v('view.warehouse'),
    canViewCustomers: v('view.customers'),
    canViewSuppliers: v('view.suppliers'),
    canViewTreasury: v('view.treasury') || v('view.collections') || v('view.transfers') || v('view.expenses') || v('view.employees'),
    canViewReports: v('view.reports'),
    canDeleteInvoices: v('invoice.delete'),
    canDeleteCustomers: v('customer.delete'),
    canDeleteSuppliers: v('supplier.delete'),
    canEditPrices: v('price.edit'),
    canEditInvoices: v('invoice.edit'),
    canManageBackup: v('backup'),
    canDeleteLedgers: v('ledger.clear') || v('treasury.clear') || v('invoice.clearAll'),
    canEditWarehouse: v('product.add') || v('product.edit') || v('product.delete') || v('stock.transfer'),
    canManageTreasury: v('treasury.manage'),
    canEditPurchases: v('purchase.edit'),
    canDeletePurchases: v('purchase.delete'),
  };
};
