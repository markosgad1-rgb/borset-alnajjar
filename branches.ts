export type BranchId = 'MARG' | 'NOZHA';

export interface Branch {
  id: BranchId;
  name: string;
  shortName: string;
  badgeClass: string;
  borderClass: string;
  bgLightClass: string;
}

export const BRANCHES: Branch[] = [
  {
    id: 'MARG',
    name: 'إدارة المرج',
    shortName: 'المرج',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    borderClass: 'border-emerald-500',
    bgLightClass: 'bg-emerald-50/60'
  },
  {
    id: 'NOZHA',
    name: 'إدارة النزهة',
    shortName: 'النزهة',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    borderClass: 'border-blue-500',
    bgLightClass: 'bg-blue-50/60'
  }
];

export const DEFAULT_AREAS_BY_BRANCH: Record<BranchId, string[]> = {
  MARG: [
    'المرج القديمة',
    'المرج الجديدة',
    'القلج',
    'الخانكة',
    'بركة الحاج',
    'كفر الشرفا',
    '23 يوليو',
    'مؤسسة الزكاة',
    'كفر أبو صير',
    'عزبة النخل',
    'الخصوص',
    'أبو زعبل'
  ],
  NOZHA: [
    'النزهة الجديدة',
    'النزهة 1',
    'النزهة 2',
    'مساكن شيراتون',
    'الألف مسكن',
    'مصر الجديدة',
    'جسر السويس',
    'الحجاز',
    'سانت فاتيما',
    'ميدان المحكمة',
    'روكسي',
    'عين شمس الشرقية'
  ]
};

export const getBranchName = (branchId?: BranchId | string | null): string => {
  if (branchId === 'NOZHA') return 'إدارة النزهة';
  return 'إدارة المرج';
};

export const getBranchBadgeStyle = (branchId?: BranchId | string | null) => {
  if (branchId === 'NOZHA') {
    return {
      name: 'النزهة',
      fullName: 'إدارة النزهة',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200'
    };
  }
  return {
    name: 'المرج',
    fullName: 'إدارة المرج',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  };
};
