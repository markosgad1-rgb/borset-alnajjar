// نطاق عمل المستخدم (الفرع + المناطق). الأدمن الكامل = بدون قيود (يشوف كل حاجة).
// allowedBranch فاضي = كل الفروع. allowedAreas فاضي = كل مناطق الفرع.
import type { User } from '../types';
import type { BranchId } from './branches';
import { isFullAdmin } from './permissions';

export interface UserScope { restricted: boolean; branch: BranchId | null; areas: string[]; }

export const FULL_SCOPE: UserScope = { restricted: false, branch: null, areas: [] };

export const getUserScope = (u?: Partial<User> | null): UserScope => {
  if (!u || isFullAdmin(u)) return FULL_SCOPE;
  const b = (u as any).allowedBranch;
  if (b !== 'MARG' && b !== 'NOZHA') return FULL_SCOPE;
  const areas = Array.isArray((u as any).allowedAreas) ? ((u as any).allowedAreas as string[]).filter(Boolean) : [];
  return { restricted: true, branch: b, areas };
};

/** هل (فرع، منطقة) داخل نطاق المستخدم؟ */
export const inScope = (s: UserScope, branchId?: string | null, area?: string | null): boolean => {
  if (!s.restricted) return true;
  if ((branchId || 'MARG') !== s.branch) return false;
  if (s.areas.length === 0) return true;
  return s.areas.includes((area || '').trim());
};

export const customerInScope = (s: UserScope, c?: { branchId?: string; area?: string } | null): boolean =>
  !s.restricted ? true : !!c && inScope(s, c.branchId, c.area);
