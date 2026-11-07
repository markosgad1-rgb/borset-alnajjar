import React, { useState, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  Wallet, 
  Calendar, 
  MapPin, 
  Building, 
  Printer, 
  MessageCircle, 
  FileText, 
  Package, 
  ArrowUpRight, 
  Clock, 
  Search,
  Filter,
  Layers,
  Coins,
  Loader2
} from 'lucide-react';
import { BranchId, BRANCHES, getBranchAreas, SalesInvoice, Purchase, Customer } from '../types';
import { shareReportPdfViaWhatsApp, printHtmlDocument } from '../utils/whatsapp';
import { getGeneralReportHtml, GeneralReportPrintOptions } from '../utils/printTemplates';

type DateFilterOption = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM';
type ActiveTab = 'SALES' | 'PURCHASES' | 'CUSTOMERS';

export const Reports: React.FC = () => {
  const { invoices, purchases, products, customers, companyLogo } = useERP();

  // Top Filter State
  const [selectedBranch, setSelectedBranch] = useState<'ALL' | BranchId>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('MONTH');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Active Report Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('SALES');
  const [tableSearch, setTableSearch] = useState('');
  const [purchasesPricingFilter, setPurchasesPricingFilter] = useState<'ALL' | 'PRICED' | 'PENDING_PRICE'>('ALL');

  // Dynamic Available Areas for Selected Branch
  const availableAreas = useMemo(() => {
    if (selectedBranch === 'ALL') {
      const combined = new Set<string>();
      getBranchAreas('MARG', customers).forEach(a => combined.add(a));
      getBranchAreas('NOZHA', customers).forEach(a => combined.add(a));
      return Array.from(combined);
    }
    return getBranchAreas(selectedBranch, customers);
  }, [selectedBranch, customers]);

  // Reset area filter when branch changes if area is not in the new branch
  const handleBranchChange = (branch: 'ALL' | BranchId) => {
    setSelectedBranch(branch);
    setSelectedArea('ALL');
  };

  // Date Range Checker Helper
  const isDateInRange = (dateStr: string): boolean => {
    if (!dateStr) return false;
    if (dateFilter === 'ALL') return true;

    if (dateFilter === 'TODAY') {
      return dateStr === todayStr;
    }

    if (dateFilter === 'WEEK') {
      const d = new Date(dateStr);
      const now = new Date();
      const diffTime = now.getTime() - d.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }

    if (dateFilter === 'MONTH') {
      const currentMonth = todayStr.substring(0, 7); // 'YYYY-MM'
      return dateStr.startsWith(currentMonth);
    }

    if (dateFilter === 'CUSTOM') {
      if (!customStartDate || !customEndDate) return true;
      return dateStr >= customStartDate && dateStr <= customEndDate;
    }

    return true;
  };

  // --- Filtered Sales Invoices ---
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Date Check
      if (!isDateInRange(inv.date)) return false;

      // Branch Check
      const invBranch = inv.branchId || 'MARG';
      if (selectedBranch !== 'ALL' && invBranch !== selectedBranch) return false;

      // Area Check
      const cust = customers.find(c => c.code === inv.customerCode);
      const invArea = inv.area || cust?.area || '';
      if (selectedArea !== 'ALL' && invArea !== selectedArea) return false;

      return true;
    });
  }, [invoices, selectedBranch, selectedArea, dateFilter, customStartDate, customEndDate, customers]);

  // --- Filtered Purchases ---
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Date Check
      if (!isDateInRange(p.date)) return false;

      // Branch Check
      const pBranch = p.branchId || 'MARG';
      if (selectedBranch !== 'ALL' && pBranch !== selectedBranch) return false;

      return true;
    });
  }, [purchases, selectedBranch, dateFilter, customStartDate, customEndDate]);

  // --- Filtered Customers ---
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const cBranch = c.branchId || 'MARG';
      if (selectedBranch !== 'ALL' && cBranch !== selectedBranch) return false;

      if (selectedArea !== 'ALL' && (c.area || '') !== selectedArea) return false;

      return true;
    });
  }, [customers, selectedBranch, selectedArea]);

  // --- KPI Metrics ---
  const kpis = useMemo(() => {
    // 1. Total Sales & Counts
    const totalSalesAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalSalesPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalSalesRemaining = filteredInvoices.reduce((sum, inv) => sum + (inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0))), 0);
    const invoicesCount = filteredInvoices.length;

    // 2. Total Purchases
    const totalPurchasesAmount = filteredPurchases.reduce((sum, p) => sum + p.total, 0);
    const purchasesCount = filteredPurchases.length;

    // 3. Estimated Cost of Goods Sold & Gross Profit
    let totalCostOfSoldItems = 0;
    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const prod = products.find(p => p.code === item.itemCode);
        const cost = prod?.avgCost || 0;
        totalCostOfSoldItems += (Number(item.quantity) || 0) * cost;
      });
    });
    const grossProfit = totalSalesAmount - totalCostOfSoldItems;

    // 4. Customer Debts (negative balance = customer owes us money)
    let totalCustomerDebt = 0;
    filteredCustomers.forEach(c => {
      if (c.balance < 0) {
        totalCustomerDebt += Math.abs(c.balance);
      }
    });

    return {
      totalSalesAmount,
      totalSalesPaid,
      totalSalesRemaining,
      invoicesCount,
      totalPurchasesAmount,
      purchasesCount,
      totalCostOfSoldItems,
      grossProfit,
      totalCustomerDebt,
      customersCount: filteredCustomers.length
    };
  }, [filteredInvoices, filteredPurchases, filteredCustomers, products]);

  // --- Top Selling Products ---
  const topSellingProducts = useMemo(() => {
    const map = new Map<string, { code: string; name: string; quantity: number; totalRevenue: number; profit: number }>();
    
    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const code = (item.itemCode || '').trim();
        if (!code) return;
        const prod = products.find(p => p.code === code);
        const cost = prod?.avgCost || 0;
        const qty = Number(item.quantity) || 0;
        const rev = Number(item.total) || (qty * (Number(item.price) || 0));
        const itemProfit = rev - (qty * cost);

        if (!map.has(code)) {
          map.set(code, {
            code,
            name: item.itemName || prod?.name || code,
            quantity: qty,
            totalRevenue: rev,
            profit: itemProfit
          });
        } else {
          const cur = map.get(code)!;
          cur.quantity += qty;
          cur.totalRevenue += rev;
          cur.profit += itemProfit;
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }, [filteredInvoices, products]);

  // --- Customer Sales Activity Summary ---
  const customerActivitySummary = useMemo(() => {
    const invoiceSummaryByCustomer = new Map<string, { totalPurchased: number; lastDate: string; invoiceCount: number }>();
    
    filteredInvoices.forEach(inv => {
      const code = inv.customerCode;
      if (!code) return;
      if (!invoiceSummaryByCustomer.has(code)) {
        invoiceSummaryByCustomer.set(code, {
          totalPurchased: inv.total,
          lastDate: inv.date,
          invoiceCount: 1
        });
      } else {
        const cur = invoiceSummaryByCustomer.get(code)!;
        cur.totalPurchased += inv.total;
        cur.invoiceCount += 1;
        if (inv.date > cur.lastDate) {
          cur.lastDate = inv.date;
        }
      }
    });

    return filteredCustomers.map(c => {
      const activity = invoiceSummaryByCustomer.get(c.code) || { totalPurchased: 0, lastDate: 'لا توجد حركات', invoiceCount: 0 };
      return {
        customer: c,
        totalPurchased: activity.totalPurchased,
        lastDate: activity.lastDate,
        invoiceCount: activity.invoiceCount
      };
    }).sort((a, b) => b.totalPurchased - a.totalPurchased);
  }, [filteredCustomers, filteredInvoices]);

  // Derived labels for print and WhatsApp summary
  const branchLabel = selectedBranch === 'MARG' 
    ? 'إدارة المرج' 
    : selectedBranch === 'NOZHA' 
    ? 'إدارة النزهة' 
    : 'جميع الفروع (المرج والنزهة)';

  const areaLabel = selectedArea === 'ALL' ? 'جميع المناطق' : selectedArea;

  const dateFilterLabel = useMemo(() => {
    switch (dateFilter) {
      case 'TODAY':
        return `اليوم (${todayStr})`;
      case 'WEEK':
        return 'آخر 7 أيام';
      case 'MONTH':
        return `هذا الشهر (${todayStr.substring(0, 7)})`;
      case 'CUSTOM':
        return `من ${customStartDate} إلى ${customEndDate}`;
      case 'ALL':
      default:
        return 'كافة الفترات';
    }
  }, [dateFilter, todayStr, customStartDate, customEndDate]);

  const activeTabTitle = useMemo(() => {
    switch (activeTab) {
      case 'SALES':
        return 'تقرير المبيعات والأصناف الأكثر طلباً';
      case 'PURCHASES':
        return 'تقرير المشتريات والتوريد';
      case 'CUSTOMERS':
        return 'تقرير العملاء والمديونيات';
    }
  }, [activeTab]);

  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  const getReportPrintOptions = (): GeneralReportPrintOptions => {
    return {
      title: activeTabTitle,
      reportType: activeTab,
      branchLabel,
      areaLabel,
      dateLabel: dateFilterLabel,
      kpis,
      topProducts: activeTab === 'SALES' ? topSellingProducts : undefined,
      salesInvoices: activeTab === 'SALES' ? filteredInvoices.map(inv => {
        const bId = inv.branchId || 'MARG';
        const cust = customers.find(c => c.code === inv.customerCode);
        const area = inv.area || cust?.area || '-';
        const paid = inv.paidAmount || 0;
        const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - paid);
        const status = paid >= inv.total ? 'خالص' : paid > 0 ? 'جزئي' : 'آجل';
        return {
          id: inv.id,
          date: inv.date,
          time: inv.time,
          customerName: inv.customerName,
          branchName: bId === 'NOZHA' ? 'النزهة' : 'المرج',
          area,
          itemsCount: inv.items?.length || 0,
          total: inv.total,
          paid,
          remaining: rem > 0 ? rem : 0,
          status
        };
      }) : undefined,
      purchases: activeTab === 'PURCHASES' ? filteredPurchases
        .filter(p => {
          if (purchasesPricingFilter === 'PENDING_PRICE') return p.pricingStatus === 'PENDING_PRICE';
          if (purchasesPricingFilter === 'PRICED') return p.pricingStatus !== 'PENDING_PRICE';
          return true;
        })
        .map(p => {
          const bId = p.branchId || 'MARG';
          const isPending = p.pricingStatus === 'PENDING_PRICE';
          const itemsSummary = (p.items || []).map(i => `${i.itemName} (${i.quantity})`).join(', ');
          return {
            id: p.id,
            date: p.date,
            supplierName: p.supplierName || 'مورد',
            branchName: bId === 'NOZHA' ? 'مخزن النزهة' : 'مخزن المرج',
            itemsSummary: itemsSummary || 'صنف مباشر',
            total: p.total || 0,
            isPending,
            status: isPending ? 'معلقة السعر' : 'معتمدة'
          };
        }) : undefined,
      customers: activeTab === 'CUSTOMERS' ? customerActivitySummary.map(item => {
        const c = item.customer;
        const bId = c.branchId || 'MARG';
        return {
          code: c.code,
          name: c.name,
          branchName: bId === 'NOZHA' ? 'النزهة' : 'المرج',
          area: c.area || 'غير محدد',
          phone: c.phone || '-',
          totalPurchased: item.totalPurchased,
          invoiceCount: item.invoiceCount,
          balance: c.balance,
          lastDate: item.lastDate
        };
      }) : undefined
    };
  };

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const options = getReportPrintOptions();
      const html = getGeneralReportHtml(options, companyLogo);
      printHtmlDocument(html);
    } catch (err) {
      console.error('Print error:', err);
      window.print();
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
      }, 1000);
    }
  };

  const handleShareWhatsApp = async () => {
    if (isSharingPdf) return;
    setIsSharingPdf(true);

    let syncTab: Window | null = null;
    const isNative = typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function';

    if (!isNative) {
      try {
        syncTab = window.open('about:blank', '_blank');
      } catch {}
    }

    const safetyTimer = setTimeout(() => {
      setIsSharingPdf(false);
    }, 5000);

    try {
      const options = getReportPrintOptions();
      await shareReportPdfViaWhatsApp(options, companyLogo, null, syncTab);
    } catch (err: any) {
      if (syncTab && !syncTab.closed) syncTab.close();
      if (
        err?.name !== 'AbortError' &&
        err?.name !== 'NotAllowedError' &&
        !err?.message?.includes?.('AbortError') &&
        !err?.message?.includes?.('canceled') &&
        !err?.message?.includes?.('cancelled')
      ) {
        console.error('WhatsApp report share error:', err);
      }
    } finally {
      clearTimeout(safetyTimer);
      setIsSharingPdf(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 print:space-y-4 print:pb-0">
      
      {/* Print-Only Header (يظهر فقط أثناء الطباعة وحفظ الـ PDF) */}
      <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900">بورصة النجار لتجارة وتوزيع البيض</h1>
            <p className="text-sm font-bold text-gray-700 mt-1">
              {activeTabTitle}
            </p>
          </div>
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" className="h-16 object-contain" />
          ) : (
            <div className="text-lg font-black border-2 border-gray-900 px-3 py-1 rounded">
              بورصة النجار
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-300 text-xs text-gray-800 bg-gray-50 p-2.5 rounded-lg font-medium">
          <div><span className="font-bold">الفترة:</span> {dateFilterLabel}</div>
          <div><span className="font-bold">الإدارة / الفرع:</span> {branchLabel}</div>
          <div><span className="font-bold">المنطقة:</span> {areaLabel}</div>
          <div><span className="font-bold">تاريخ الطباعة:</span> {new Date().toLocaleDateString('ar-EG')} {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* 1. Header Toolbar (مخفي أثناء الطباعة) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-brand-100 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-brand-900 flex items-center gap-2">
            <BarChart3 className="text-brand-600" size={24} /> التقارير الشاملة وتحليلات الأداء
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            تقارير تفصيلية للمبيعات والمشتريات وأرصدة العملاء مع التقسيم الجغرافي وحساب الأرباح
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            disabled={isSharingPdf}
            onClick={handleShareWhatsApp}
            className={`px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
              isSharingPdf ? 'opacity-80 cursor-wait' : ''
            }`}
            title="مشاركة التقرير كملف PDF عبر واتساب (مثل الفواتير وكشف الحساب)"
          >
            {isSharingPdf ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>جاري تحويل الـ PDF...</span>
              </>
            ) : (
              <>
                <MessageCircle size={15} />
                <span>مشاركة واتساب</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isPrinting}
            onClick={handlePrint}
            className={`px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer ${
              isPrinting ? 'opacity-80 cursor-wait' : ''
            }`}
            title="طباعة التقرير أو حفظه كـ PDF"
          >
            {isPrinting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>جاري الطباعة...</span>
              </>
            ) : (
              <>
                <Printer size={15} />
                <span>طباعة التقرير</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Interactive Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-brand-100 space-y-3 print:hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
          <Filter size={16} className="text-brand-600" />
          <h3 className="text-xs font-bold text-gray-700">شريط الفلاتر الموحد للتقارير</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Branch Filter (col-span-4) */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <Building size={12} className="text-blue-600" /> الإدارة / الفرع
            </label>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleBranchChange('ALL')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  selectedBranch === 'ALL'
                    ? 'bg-white text-brand-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => handleBranchChange('MARG')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  selectedBranch === 'MARG'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                المرج
              </button>
              <button
                type="button"
                onClick={() => handleBranchChange('NOZHA')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  selectedBranch === 'NOZHA'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-700 hover:text-purple-900'
                }`}
              >
                النزهة
              </button>
            </div>
          </div>

          {/* Dynamic Area Filter (col-span-3) */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <MapPin size={12} className="text-brand-600" /> المنطقة الجغرافية
            </label>
            <div className="relative">
              <select
                className="w-full pr-8 pl-2 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                value={selectedArea}
                onChange={e => setSelectedArea(e.target.value)}
              >
                <option value="ALL">جميع المناطق ({availableAreas.length} منطقة)</option>
                {availableAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
              <MapPin size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Date Filter (col-span-5) */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
              <Calendar size={12} className="text-brand-600" /> الفترة الزمنية
            </label>
            <div className="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { id: 'TODAY', label: 'اليوم' },
                { id: 'WEEK', label: 'الأسبوع' },
                { id: 'MONTH', label: 'هذا الشهر' },
                { id: 'ALL', label: 'الكل' },
                { id: 'CUSTOM', label: 'مخصص' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDateFilter(opt.id as DateFilterOption)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                    dateFilter === opt.id
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Custom Date Pickers when 'CUSTOM' is selected */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 animate-fade-in text-xs font-bold">
            <span className="text-gray-600">الفترة المخصصة:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">من تاريخ:</span>
              <input
                type="date"
                className="p-1.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-brand-500"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">إلى تاريخ:</span>
              <input
                type="date"
                className="p-1.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-brand-500"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. KPI Summary Cards (Dynamic & Real-time) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2 print:mb-4">
        {/* Total Sales KPI */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between print:bg-none print:bg-white print:text-gray-900 print:border print:border-gray-300 print:p-2.5 print:rounded-lg print:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-xs font-bold mb-1 print:text-gray-600">إجمالي المبيعات المفلترة</p>
              <h3 className="text-2xl font-black font-mono print:text-base print:text-blue-900" dir="ltr">
                {kpis.totalSalesAmount.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-white/20 rounded-xl print:hidden">
              <TrendingUp size={22} className="text-white" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/20 flex justify-between text-xs text-blue-100 print:border-gray-200 print:text-gray-600 print:mt-1.5 print:pt-1.5 print:text-[10px]">
            <span>عدد الفواتير: <strong className="text-white font-mono print:text-gray-900">{kpis.invoicesCount}</strong></span>
            <span>المحصل: <strong className="text-white font-mono print:text-gray-900">{kpis.totalSalesPaid.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Total Purchases KPI */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between print:bg-none print:bg-white print:text-gray-900 print:border print:border-gray-300 print:p-2.5 print:rounded-lg print:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-xs font-bold mb-1 print:text-gray-600">إجمالي المشتريات (الوارد)</p>
              <h3 className="text-2xl font-black font-mono print:text-base print:text-indigo-900" dir="ltr">
                {kpis.totalPurchasesAmount.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-white/20 rounded-xl print:hidden">
              <ShoppingCart size={22} className="text-white" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/20 flex justify-between text-xs text-indigo-100 print:border-gray-200 print:text-gray-600 print:mt-1.5 print:pt-1.5 print:text-[10px]">
            <span>عدد الفواتير: <strong className="text-white font-mono print:text-gray-900">{kpis.purchasesCount}</strong></span>
            <span>المخزن المستلم: <strong className="text-white print:text-gray-900">{selectedBranch === 'NOZHA' ? 'النزهة' : selectedBranch === 'MARG' ? 'المرج' : 'الفرعين'}</strong></span>
          </div>
        </div>

        {/* Gross Profit KPI */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between print:bg-none print:bg-white print:text-gray-900 print:border print:border-gray-300 print:p-2.5 print:rounded-lg print:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-xs font-bold mb-1 print:text-gray-600">صافي الأرباح التقديري</p>
              <h3 className="text-2xl font-black font-mono print:text-base print:text-emerald-900" dir="ltr">
                {kpis.grossProfit.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-white/20 rounded-xl print:hidden">
              <Coins size={22} className="text-white" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/20 flex justify-between text-xs text-emerald-100 print:border-gray-200 print:text-gray-600 print:mt-1.5 print:pt-1.5 print:text-[10px]">
            <span>تكلفة البضاعة: <strong className="text-white font-mono print:text-gray-900">{kpis.totalCostOfSoldItems.toLocaleString()}</strong></span>
            <span>هامش الربح: <strong className="text-white font-mono print:text-gray-900">{kpis.totalSalesAmount > 0 ? ((kpis.grossProfit / kpis.totalSalesAmount) * 100).toFixed(1) : 0}%</strong></span>
          </div>
        </div>

        {/* Customer Debts KPI */}
        <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between print:bg-none print:bg-white print:text-gray-900 print:border print:border-gray-300 print:p-2.5 print:rounded-lg print:shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 text-xs font-bold mb-1 print:text-gray-600">مديونيات العملاء (في النطاق)</p>
              <h3 className="text-2xl font-black font-mono print:text-base print:text-amber-900" dir="ltr">
                {kpis.totalCustomerDebt.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-white/20 rounded-xl print:hidden">
              <Users size={22} className="text-white" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/20 flex justify-between text-xs text-amber-100 print:border-gray-200 print:text-gray-600 print:mt-1.5 print:pt-1.5 print:text-[10px]">
            <span>عدد العملاء: <strong className="text-white font-mono print:text-gray-900">{kpis.customersCount}</strong></span>
            <span>آجل الفواتير: <strong className="text-white font-mono print:text-gray-900">{kpis.totalSalesRemaining.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 print:hidden">
        <button
          type="button"
          onClick={() => { setActiveTab('SALES'); setTableSearch(''); }}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'SALES'
              ? 'border-brand-600 text-brand-700 bg-brand-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <FileText size={17} />
          <span>تقرير المبيعات والأصناف الأكثر طلباً ({filteredInvoices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('PURCHASES'); setTableSearch(''); }}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'PURCHASES'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShoppingCart size={17} />
          <span>تقرير المشتريات والتوريد ({filteredPurchases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('CUSTOMERS'); setTableSearch(''); }}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'CUSTOMERS'
              ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users size={17} />
          <span>تقرير العملاء والمديونيات ({filteredCustomers.length})</span>
        </button>
      </div>

      {/* 5. Tab Content */}

      {/* TAB 1: SALES REPORT */}
      {activeTab === 'SALES' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Selling Products Block */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-100 space-y-4 print:p-3 print:border-gray-300 print:shadow-none print:mb-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-600" /> الأصناف الأكثر مبيعاً وتحقيقاً للإيراد
              </h3>
              <span className="text-xs text-gray-500 font-mono">أعلى {topSellingProducts.length} صنف</span>
            </div>

            {topSellingProducts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">لا توجد مبيعات في الفترة والفلاتر المحددة</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {topSellingProducts.map((p, idx) => {
                  const sharePercent = kpis.totalSalesAmount > 0 
                    ? ((p.totalRevenue / kpis.totalSalesAmount) * 100).toFixed(1) 
                    : '0';

                  return (
                    <div key={p.code} className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 flex flex-col justify-between print:bg-white print:p-2 print:border-gray-300">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 bg-white px-1.5 py-0.5 rounded border">
                            {p.code}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-xs mt-2 line-clamp-1" title={p.name}>
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-200/60 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[11px]">الكمية المباعة:</span>
                          <span className="font-bold text-blue-700 font-mono">{p.quantity.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[11px]">إجمالي الإيراد:</span>
                          <span className="font-bold text-emerald-700 font-mono">{p.totalRevenue.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-[11px]">الربح التقديري:</span>
                          <span className="font-bold text-indigo-700 font-mono">{p.profit.toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sales Invoices Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-brand-100 overflow-hidden print:shadow-none print:border-gray-300 print:rounded-none">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">بيان فواتير المبيعات</h3>
                <p className="text-xs text-gray-500">تفاصيل الفواتير المطابقة للفلترة المختارة</p>
              </div>

              <div className="relative w-full sm:w-64 print:hidden">
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة أو العميل..."
                  className="w-full pr-8 pl-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-brand-500"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-right text-xs print:text-[11px]">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                  <tr>
                    <th className="p-3 w-20"># الفاتورة</th>
                    <th className="p-3 w-28">التاريخ والوقت</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3 w-24">الإدارة</th>
                    <th className="p-3 w-28">المنطقة</th>
                    <th className="p-3 w-20 text-center">الأصناف</th>
                    <th className="p-3 w-28 text-center">الإجمالي</th>
                    <th className="p-3 w-28 text-center">المدفوع</th>
                    <th className="p-3 w-28 text-center">المتبقي</th>
                    <th className="p-3 w-24 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices
                    .filter(inv => {
                      if (!tableSearch.trim()) return true;
                      const q = tableSearch.toLowerCase().trim();
                      return inv.id.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q);
                    })
                    .map(inv => {
                      const bId = inv.branchId || 'MARG';
                      const cust = customers.find(c => c.code === inv.customerCode);
                      const area = inv.area || cust?.area || '-';
                      const paid = inv.paidAmount || 0;
                      const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - paid);
                      const isFull = paid >= inv.total;
                      const isPart = paid > 0 && paid < inv.total;

                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3 font-mono font-bold text-brand-700">{inv.id}</td>
                          <td className="p-3 text-gray-500 font-mono">{inv.date} <span className="text-[10px] text-gray-400">{inv.time}</span></td>
                          <td className="p-3 font-bold text-gray-900">{inv.customerName}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              bId === 'NOZHA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {bId === 'NOZHA' ? 'النزهة' : 'المرج'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600">{area}</td>
                          <td className="p-3 text-center font-mono">{inv.items?.length || 0}</td>
                          <td className="p-3 text-center font-bold text-gray-900 font-mono">{inv.total.toLocaleString()}</td>
                          <td className="p-3 text-center font-bold text-emerald-600 font-mono">{paid.toLocaleString()}</td>
                          <td className="p-3 text-center font-bold text-amber-700 font-mono">{rem > 0 ? rem.toLocaleString() : '0'}</td>
                          <td className="p-3 text-center">
                            {isFull ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">خالص</span>
                            ) : isPart ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">جزئي</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">آجل</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-400">
                        لا توجد فواتير مبيعات مطابقة للفلاتر المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASES REPORT */}
      {activeTab === 'PURCHASES' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-sm border border-brand-100 overflow-hidden print:shadow-none print:border-gray-300 print:rounded-none">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">بيان فواتير المشتريات والتوريد</h3>
                <p className="text-xs text-gray-500">حركات استلام البضاعة من الموردين وتوزيعها على المخازن</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto print:hidden">
                {/* Pricing Status Tabs Filter */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setPurchasesPricingFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      purchasesPricingFilter === 'ALL'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    الكل ({filteredPurchases.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasesPricingFilter('PRICED')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      purchasesPricingFilter === 'PRICED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    مسعرة ({filteredPurchases.filter(p => p.pricingStatus !== 'PENDING_PRICE').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasesPricingFilter('PENDING_PRICE')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      purchasesPricingFilter === 'PENDING_PRICE'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    معلقة السعر ({filteredPurchases.filter(p => p.pricingStatus === 'PENDING_PRICE').length})
                  </button>
                </div>

                <div className="relative flex-1 md:w-56">
                  <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="بحث برقم الفاتورة أو المورد..."
                    className="w-full pr-8 pl-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-brand-500"
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-right text-xs print:text-[11px]">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                  <tr>
                    <th className="p-3 w-24"># الفاتورة</th>
                    <th className="p-3 w-28">التاريخ</th>
                    <th className="p-3">اسم المورد</th>
                    <th className="p-3 w-28">المخزن المستلم</th>
                    <th className="p-3">بيان الأصناف الموردة</th>
                    <th className="p-3 w-28 text-center">إجمالي الفاتورة</th>
                    <th className="p-3 w-28 text-center">حالة الفاتورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPurchases
                    .filter(p => {
                      if (purchasesPricingFilter === 'PENDING_PRICE') return p.pricingStatus === 'PENDING_PRICE';
                      if (purchasesPricingFilter === 'PRICED') return p.pricingStatus !== 'PENDING_PRICE';
                      return true;
                    })
                    .filter(p => {
                      if (!tableSearch.trim()) return true;
                      const q = tableSearch.toLowerCase().trim();
                      return p.id.toLowerCase().includes(q) || (p.supplierName && p.supplierName.toLowerCase().includes(q));
                    })
                    .map(p => {
                      const bId = p.branchId || 'MARG';
                      const isPending = p.pricingStatus === 'PENDING_PRICE';
                      const itemsSummary = (p.items || []).map(i => `${i.itemName} (${i.quantity})`).join(', ');

                      return (
                        <tr key={p.id} className={`hover:bg-gray-50/70 transition-colors ${isPending ? 'bg-amber-50/30' : ''}`}>
                          <td className="p-3 font-mono font-bold text-indigo-700">{p.id}</td>
                          <td className="p-3 text-gray-500 font-mono">{p.date}</td>
                          <td className="p-3 font-bold text-gray-900">{p.supplierName}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              bId === 'NOZHA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {bId === 'NOZHA' ? 'مخزن النزهة' : 'مخزن المرج'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600 line-clamp-1">{itemsSummary || 'صنف مباشر'}</td>
                          <td className="p-3 text-center font-bold font-mono">
                            {isPending ? (
                              <span className="text-amber-700 text-xs">معلّق السعر</span>
                            ) : (
                              <span className="text-gray-900">{p.total.toLocaleString()} ج.م</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                معلقة السعر
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                معتمدة
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        لا توجد فواتير مشتريات مطابقة للفلاتر المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMERS & DEBTS REPORT */}
      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-sm border border-brand-100 overflow-hidden print:shadow-none print:border-gray-300 print:rounded-none">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">بيان العملاء والمديونيات في النطاق المحدد</h3>
                <p className="text-xs text-gray-500">حركة سحب ومسحوبات ومديونيات كل عميل وموعد آخر فاتورة</p>
              </div>

              <div className="relative w-full sm:w-64 print:hidden">
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث باسم العميل أو الكود..."
                  className="w-full pr-8 pl-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-brand-500"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-right text-xs print:text-[11px]">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                  <tr>
                    <th className="p-3 w-20">الكود</th>
                    <th className="p-3">اسم العميل</th>
                    <th className="p-3 w-24">الإدارة</th>
                    <th className="p-3 w-32">المنطقة</th>
                    <th className="p-3 w-28">الهاتف</th>
                    <th className="p-3 w-32 text-center">المسحوبات بالفترة</th>
                    <th className="p-3 w-24 text-center">عدد الفواتير</th>
                    <th className="p-3 w-32 text-center">الرصيد / المديونية</th>
                    <th className="p-3 w-28 text-center">آخر حركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customerActivitySummary
                    .filter(item => {
                      if (!tableSearch.trim()) return true;
                      const q = tableSearch.toLowerCase().trim();
                      return item.customer.name.toLowerCase().includes(q) || item.customer.code.toLowerCase().includes(q);
                    })
                    .map(item => {
                      const c = item.customer;
                      const bId = c.branchId || 'MARG';
                      const hasDebt = c.balance < 0;

                      return (
                        <tr key={c.code} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3 font-mono font-bold text-gray-700">{c.code}</td>
                          <td className="p-3 font-bold text-gray-900">{c.name}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              bId === 'NOZHA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {bId === 'NOZHA' ? 'النزهة' : 'المرج'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700 font-medium">{c.area || 'غير محدد'}</td>
                          <td className="p-3 text-gray-500 font-mono" dir="ltr">{c.phone || '-'}</td>
                          <td className="p-3 text-center font-bold text-blue-700 font-mono">{item.totalPurchased.toLocaleString()} ج.م</td>
                          <td className="p-3 text-center font-mono">{item.invoiceCount}</td>
                          <td className="p-3 text-center">
                            <span className={`font-mono font-black ${hasDebt ? 'text-red-600' : c.balance > 0 ? 'text-green-600' : 'text-gray-500'}`} dir="ltr">
                              {c.balance.toLocaleString()} ج.م
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-gray-500">{item.lastDate}</td>
                        </tr>
                      );
                    })}

                  {customerActivitySummary.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        لا يوجد عملاء في هذه الإدارة والمنطقة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
