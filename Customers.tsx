import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  UserPlus, FileText, Edit, X, Check, Download, Phone, Trash2, 
  AlertTriangle, Eye, Printer, Layers, Package, Search, PlusCircle, ArrowRight,
  Calendar, Filter, MessageCircle, MapPin, Building, Sliders, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { SalesInvoice, BranchId, BRANCHES, BRANCH_AREAS, getBranchAreas, ManualCustomerTransaction, CustomerHistory } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { ConsolidatedLedgerModal } from '../components/ConsolidatedLedgerModal';
import { shareCustomerStatementPdfViaWhatsApp, shareSalesInvoicePdfViaWhatsApp } from '../utils/whatsapp';
import { useBackHandler } from '../utils/backNavigation';

export const Customers: React.FC = () => {
  const { 
    customers, addCustomer, updateCustomer, deleteCustomer, 
    clearLedger, 
    currentUser, invoices, printInvoice, printLedger, companyLogo 
  } = useERP();

  const canDeleteCustomers = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canDeleteCustomers);
  
  // Mobile Master-Detail view state: 'LIST' or 'DETAILS'
  const [mobileView, setMobileView] = useState<'LIST' | 'DETAILS'>('LIST');
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  // Search & Branch Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'ALL' | BranchId>('ALL');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');

  // Consolidated Ledger Modal state
  const [isConsolidatedModalOpen, setIsConsolidatedModalOpen] = useState(false);
  const [consolidatedInitialTab, setConsolidatedInitialTab] = useState<'CUSTOMERS' | 'SUPPLIERS' | 'ALL'>('CUSTOMERS');

  // Customer Add/Edit Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    phone: string;
    branchId: BranchId;
    area: string;
    balance: string;
    adjustmentReason: string;
  }>({
    code: '',
    name: '',
    phone: '',
    branchId: 'MARG',
    area: BRANCH_AREAS.MARG[0],
    balance: '',
    adjustmentReason: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null);
  const [originalBalance, setOriginalBalance] = useState<number>(0);

  // Selected customer
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string | null>(null);

  // Date Filter state for statement
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Print Date Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printStartDate, setPrintStartDate] = useState<string>('');
  const [printEndDate, setPrintEndDate] = useState<string>('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Clear Ledger confirmation
  const [showClearLedgerConfirm, setShowClearLedgerConfirm] = useState(false);

  // View Invoice Modal State
  const [viewInvoice, setViewInvoice] = useState<SalesInvoice | null>(null);

  // View Mode for Ledger: 'ITEMS' (default, itemized statement) or 'INVOICES' (summary)
  const [viewMode, setViewMode] = useState<'ITEMS' | 'INVOICES'>('ITEMS');

  // Manual Transaction / Adjustment Modal State
  const [isManualTxModalOpen, setIsManualTxModalOpen] = useState(false);
  const [manualTxType, setManualTxType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [manualTxAmount, setManualTxAmount] = useState('');
  const [manualTxDescription, setManualTxDescription] = useState('');
  const [manualTxDate, setManualTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingManualTx, setIsSavingManualTx] = useState(false);

  // Mobile Back Button handlers for modals & sub-views
  useBackHandler(() => setIsCustomerModalOpen(false), isCustomerModalOpen, 'customers-add-edit-modal');
  useBackHandler(() => setIsConsolidatedModalOpen(false), isConsolidatedModalOpen, 'customers-consolidated-modal');
  useBackHandler(() => setIsPrintModalOpen(false), isPrintModalOpen, 'customers-print-modal');
  useBackHandler(() => setViewInvoice(null), !!viewInvoice, 'customers-view-invoice-modal');
  useBackHandler(() => setDeleteConfirmId(null), !!deleteConfirmId, 'customers-delete-confirm');
  useBackHandler(() => setShowClearLedgerConfirm(false), showClearLedgerConfirm, 'customers-clear-ledger-confirm');
  useBackHandler(() => setIsManualTxModalOpen(false), isManualTxModalOpen, 'customers-manual-tx-modal');
  useBackHandler(() => setMobileView('LIST'), mobileView === 'DETAILS', 'customers-mobile-details');

  // Helper to generate next code
  const generateNextCode = () => {
    if (customers.length === 0) return 'C001';
    const maxId = customers.reduce((max, c) => {
      const num = parseInt(c.code.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `C${(maxId + 1).toString().padStart(3, '0')}`;
  };

  // Active (non-deleted) customers
  const activeCustomers = useMemo(() => customers.filter(c => !c.isDeleted), [customers]);

  // Auto-select first customer if none selected
  useEffect(() => {
    if ((!selectedCustomerCode || !activeCustomers.some(c => c.code === selectedCustomerCode)) && activeCustomers.length > 0) {
      setSelectedCustomerCode(activeCustomers[0].code);
    }
  }, [activeCustomers, selectedCustomerCode]);

  // Filtered customer list by search, branch, and area
  const filteredCustomers = useMemo(() => {
    let list = activeCustomers;
    if (selectedBranchFilter !== 'ALL') {
      list = list.filter(c => (c.branchId || 'MARG') === selectedBranchFilter);
    }
    if (selectedAreaFilter !== 'ALL') {
      list = list.filter(c => (c.area || '') === selectedAreaFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.code.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) ||
        (c.area && c.area.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeCustomers, searchTerm, selectedBranchFilter, selectedAreaFilter]);

  const selectedCustomer = useMemo(() => {
    return activeCustomers.find(c => c.code === selectedCustomerCode) || (filteredCustomers.length > 0 ? filteredCustomers[0] : (activeCustomers.length > 0 ? activeCustomers[0] : null));
  }, [activeCustomers, filteredCustomers, selectedCustomerCode]);

  // Dynamic list of areas for the filter toolbar based on selectedBranchFilter (default + typed custom areas)
  const availableFilterAreas = useMemo(() => {
    if (selectedBranchFilter === 'ALL') {
      const set = new Set<string>();
      getBranchAreas('MARG', customers).forEach(a => set.add(a));
      getBranchAreas('NOZHA', customers).forEach(a => set.add(a));
      return Array.from(set);
    }
    return getBranchAreas(selectedBranchFilter, customers);
  }, [selectedBranchFilter, customers]);

  // Dynamic list of areas for the Add/Edit Customer modal based on formData.branchId
  const modalBranchAreas = useMemo(() => {
    return getBranchAreas(formData.branchId, customers);
  }, [formData.branchId, customers]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setOriginalBalance(0);
    const defaultBranch: BranchId = selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'MARG';
    const branchAreasList = getBranchAreas(defaultBranch, customers);
    const defaultArea = selectedAreaFilter !== 'ALL' ? selectedAreaFilter : (branchAreasList[0] || 'المرج القديمة');
    setFormData({ 
      code: generateNextCode(), 
      name: '', 
      phone: '', 
      branchId: defaultBranch,
      area: defaultArea,
      balance: '',
      adjustmentReason: ''
    });
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, customer: any) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingOldCode(customer.code);
    setOriginalBalance(customer.balance || 0);
    const bId: BranchId = customer.branchId === 'NOZHA' ? 'NOZHA' : 'MARG';
    const cArea = customer.area || (bId === 'NOZHA' ? 'النزهة الجديدة' : 'المرج القديمة');
    setFormData({
      code: customer.code,
      name: customer.name,
      phone: customer.phone || '',
      branchId: bId,
      area: cArea,
      balance: formatWithCommas(customer.balance),
      adjustmentReason: ''
    });
    setIsCustomerModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCustomerModalOpen(false);
    setIsEditing(false);
    setEditingOldCode(null);
    setOriginalBalance(0);
  };

  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.code && formData.name) {
      if (!formData.branchId || !formData.area) {
        alert("يرجى اختيار الإدارة والمنطقة للعميل");
        return;
      }
      const parsedBal = parseNumberFromCommas(formData.balance);
      if (isEditing && editingOldCode) {
        const oldCustomer = customers.find(c => c.code === editingOldCode);
        const oldBal = oldCustomer ? oldCustomer.balance : 0;
        const diff = parsedBal - oldBal;
        
        let updatedHistory = [...(oldCustomer?.history || [])];

        if (diff !== 0) {
          if (!formData.adjustmentReason || !formData.adjustmentReason.trim()) {
            alert("حقل 'سبب/بيان تعديل الرصيد' إجباري لتسجيل حركة التسوية في كشف حساب العميل (مثل: تسوية حساب، رصيد افتتاحي، خصم إضافي).");
            return;
          }
          const adjustmentMovement: CustomerHistory = {
            date: new Date().toISOString().split('T')[0],
            description: formData.adjustmentReason.trim(),
            amount: diff
          };
          updatedHistory.push(adjustmentMovement);
        }

        updateCustomer(editingOldCode, { 
          code: formData.code, 
          name: formData.name, 
          phone: formData.phone,
          branchId: formData.branchId,
          area: formData.area,
          balance: parsedBal,
          history: updatedHistory
        });
        handleCloseModal();
      } else {
        if (customers.some(c => c.code === formData.code)) {
          alert('هذا الكود مستخدم بالفعل لعميل آخر!');
          return;
        }
        const initialHistory: CustomerHistory[] = [];
        if (parsedBal !== 0) {
          const reason = formData.adjustmentReason.trim() || 'رصيد افتتاحي';
          initialHistory.push({
            date: new Date().toISOString().split('T')[0],
            description: reason,
            amount: parsedBal
          });
        }
        addCustomer({ 
          code: formData.code, 
          name: formData.name, 
          phone: formData.phone, 
          branchId: formData.branchId,
          area: formData.area,
          balance: parsedBal, 
          history: initialHistory 
        });
        setSelectedCustomerCode(formData.code);
        handleCloseModal();
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    if (!canDeleteCustomers) {
      alert('ليس لديك صلاحية حذف العملاء');
      return;
    }
    await deleteCustomer(code);
    setDeleteConfirmId(null);
    if (selectedCustomerCode === code) {
      const remaining = customers.filter(c => c.code !== code);
      setSelectedCustomerCode(remaining.length > 0 ? remaining[0].code : null);
    }
  };

  const handleClearLedger = async () => {
    if (!selectedCustomer) return;
    const success = await clearLedger('CUSTOMER', selectedCustomer.code);
    if (success) {
       setShowClearLedgerConfirm(false);
       alert("تم تصفير الحساب ومسح السجلات بنجاح.");
    }
  };

  const handleOpenManualTxModal = () => {
    setManualTxType('DEBIT');
    setManualTxAmount('');
    setManualTxDescription('');
    setManualTxDate(new Date().toISOString().split('T')[0]);
    setIsManualTxModalOpen(true);
  };

  const handleCloseManualTxModal = () => {
    setIsManualTxModalOpen(false);
    setManualTxAmount('');
    setManualTxDescription('');
    setIsSavingManualTx(false);
  };

  const handleSelectQuickChip = (chip: string) => {
    setManualTxDescription(chip);
    const lower = chip.toLowerCase();
    if (lower.includes('مرتجع') || lower.includes('دفعة') || lower.includes('سداد') || lower.includes('خصم')) {
      setManualTxType('CREDIT');
    } else if (lower.includes('بضاعة') || lower.includes('مسحوبات') || lower.includes('مصاريف') || lower.includes('فرق سعر')) {
      setManualTxType('DEBIT');
    }
  };

  const handleManualDescriptionChange = (val: string) => {
    setManualTxDescription(val);
    const lower = val.toLowerCase();
    if (lower.includes('مرتجع') || lower.includes('دفعة') || lower.includes('سداد') || lower.includes('خصم')) {
      setManualTxType('CREDIT');
    }
  };

  const handleSaveManualTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('يرجى اختيار عميل أولاً');
      return;
    }

    const amt = parseNumberFromCommas(manualTxAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const desc = manualTxDescription.trim();
    if (!desc) {
      alert('يرجى كتابة البيان / سبب الحركة (مثال: مرتجع بضاعة، دفعة مسددة، بضاعة بدون فاتورة، خصم خاص)');
      return;
    }

    // Auto-direction: مرتجع بضاعة أو دفعة مسددة تنزل تلقائياً في خانة دائن
    let finalType = manualTxType;
    const lowerDesc = desc.toLowerCase();
    if (lowerDesc.includes('مرتجع') || lowerDesc.includes('دفعة') || lowerDesc.includes('سداد') || lowerDesc.includes('خصم')) {
      finalType = 'CREDIT';
    }

    setIsSavingManualTx(true);
    try {
      const balanceChange = finalType === 'DEBIT' ? -amt : amt;
      const currentBal = finalItemizedBalance;
      const newBal = currentBal + balanceChange;

      const historyMovement: CustomerHistory = {
        date: manualTxDate || new Date().toISOString().split('T')[0],
        description: desc,
        amount: balanceChange
      };

      const manualTxRecord: ManualCustomerTransaction = {
        id: `MTX_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: manualTxDate || new Date().toISOString().split('T')[0],
        type: finalType,
        amount: amt,
        description: desc,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || currentUser?.username || 'مستخدم'
      };

      const updatedHistory = [...(selectedCustomer.history || []), historyMovement];
      const updatedManualTxs = [...(selectedCustomer.manualTransactions || []), manualTxRecord];

      await updateCustomer(selectedCustomer.code, {
        balance: newBal,
        history: updatedHistory,
        manualTransactions: updatedManualTxs
      } as any);

      handleCloseManualTxModal();
    } catch (error) {
      console.error('Error saving manual transaction:', error);
      alert('حدث خطأ أثناء حفظ الحركة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSavingManualTx(false);
    }
  };

  const handleViewInvoiceDetails = (description: string) => {
    const match = description.match(/#([A-Za-z0-9-]+)/);
    if (match) {
      const invoiceId = match[1];
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        setViewInvoice(invoice);
      } else {
        alert("عذراً، تفاصيل هذه الفاتورة غير متوفرة في السجل العام (ربما تم حذفها).");
      }
    }
  };

  // Helper to format movement descriptions to a clean label like 'دفعة'
  const formatCustomerMovementDesc = (desc: string): string => {
    if (!desc) return '';
    if (
      desc.includes('سداد/تحصيل نقدية') || 
      desc.includes('تحصيل من عميل') || 
      desc.includes('دفعة نقدية مسددة') || 
      desc.includes('سداد نقدي كامل') || 
      desc.includes('استلام من عميل') ||
      desc.startsWith('تحصيل') ||
      desc.startsWith('سداد')
    ) {
      const parts = desc.split(' - ');
      if (parts.length > 1) {
        const last = parts[parts.length - 1].trim();
        if (!last.includes('تحصيل من عميل') && !last.startsWith('فاتورة #') && last !== '') {
          return `دفعة (${last})`;
        }
      }
      return 'دفعة';
    }
    return desc;
  };

  // Helper to map and identify payment entries in customer history that correspond to invoice payments,
  // preventing duplicate entries and double-counting in the ledger.
  const getConsumedPaymentIndices = (history: Array<{ date: string; description: string; amount: number }>) => {
    const consumedIndices = new Set<number>();

    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      if (h.description.includes('تعديل فاتورة')) continue;

      const isInvoiceSale = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
      if (!isInvoiceSale) continue;

      const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
      const invId = invMatch ? invMatch[1] : null;
      if (!invId) continue;

      const invoice = invoices.find(inv => inv.id === invId);
      const rawPaid = Number(invoice?.paidAmount || 0);
      const invoicePaid = Math.max(0, isNaN(rawPaid) ? 0 : rawPaid);

      if (invoicePaid <= 0) continue;

      // 1. Direct match by invoice number in description with matching positive amount
      let matchedIdx = -1;
      for (let j = 0; j < history.length; j++) {
        if (j === i || consumedIndices.has(j)) continue;
        const candidate = history[j];
        if (candidate.amount > 0 && Math.abs(candidate.amount - invoicePaid) < 0.01) {
          if (candidate.description.includes(`#${invId}`) || candidate.description.includes(invId)) {
            matchedIdx = j;
            break;
          }
        }
      }

      // 2. Direct sequence match: immediate entry following invoice (standard ERPContext.addInvoice order)
      if (matchedIdx === -1 && i + 1 < history.length && !consumedIndices.has(i + 1)) {
        const next = history[i + 1];
        if (next.amount > 0 && Math.abs(next.amount - invoicePaid) < 0.01 && !next.description.includes('فاتورة بيع') && (next.description.includes('دفعة') || next.description.includes(invId))) {
          matchedIdx = i + 1;
        }
      }

      // 3. Same-date payment entry with matching amount
      if (matchedIdx === -1) {
        for (let j = 0; j < history.length; j++) {
          if (j === i || consumedIndices.has(j)) continue;
          const candidate = history[j];
          if (candidate.amount > 0 && Math.abs(candidate.amount - invoicePaid) < 0.01) {
            if (candidate.date === (invoice?.date || h.date) && !candidate.description.includes('فاتورة بيع') && (candidate.description.includes('دفعة') || candidate.description.includes(invId))) {
              matchedIdx = j;
              break;
            }
          }
        }
      }

      if (matchedIdx !== -1) {
        consumedIndices.add(matchedIdx);
      }
    }

    return consumedIndices;
  };

  // Helper to compute itemized ledger rows by expanding sales invoices into individual egg products with optional date filter
  const getItemizedRowsForRange = (startDate?: string, endDate?: string) => {
    if (!selectedCustomer || !selectedCustomer.history) return [];

    const consumedPaymentIndices = getConsumedPaymentIndices(selectedCustomer.history);
    let priorBalance = 0;

    // 1. Calculate prior balance if startDate is specified
    if (startDate) {
      for (let i = 0; i < selectedCustomer.history.length; i++) {
        if (consumedPaymentIndices.has(i)) continue; // Prevent double-counting in prior balance
        const h = selectedCustomer.history[i];
        if (h.description.includes('تعديل فاتورة')) continue;
        if (h.date < startDate) {
          const isInvoiceSale = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
          const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
          const invId = invMatch ? invMatch[1] : null;
          const invoice = invId ? invoices.find(inv => inv.id === invId) : null;

          if (isInvoiceSale && invoice && invoice.items && invoice.items.length > 0) {
            const invoiceTotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const invoicePaid = Math.max(0, Number(invoice.paidAmount || 0));
            // Net debt increase from invoice = total - paid
            priorBalance -= (invoiceTotal - invoicePaid);
          } else {
            priorBalance += h.amount;
          }
        }
      }
    }

    const rows: Array<{
      num: number;
      date: string;
      ref: string;
      itemName: string;
      quantity: number | string;
      price: number | string;
      lineTotal: number | string; // الإجمالي
      debit: number; // مدين (عليه)
      credit: number; // دائن (له/سداد)
      runningBalance: number;
      status: 'مدين' | 'دائن' | 'متزن';
      isInvoiceItem: boolean;
      invoiceId?: string;
    }> = [];

    let running = startDate ? priorBalance : 0;
    let counter = 1;

    // Insert opening balance row if there is a prior balance before the start date
    if (startDate && priorBalance !== 0) {
      rows.push({
        num: counter++,
        date: startDate,
        ref: '-',
        itemName: 'رصيد سابق ما قبل الفترة',
        quantity: '-',
        price: '-',
        lineTotal: '-',
        debit: priorBalance < 0 ? Math.abs(priorBalance) : 0,
        credit: priorBalance > 0 ? priorBalance : 0,
        runningBalance: running,
        status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
        isInvoiceItem: false
      });
    }

    for (let i = 0; i < selectedCustomer.history.length; i++) {
      // If this history entry is the payment entry belonging to an invoice, skip it because
      // it is displayed directly under the invoice items as a single dedicated line with the invoice ref!
      if (consumedPaymentIndices.has(i)) continue;

      const h = selectedCustomer.history[i];
      if (h.description.includes('تعديل فاتورة')) continue;
      if (startDate && h.date < startDate) continue;
      if (endDate && h.date > endDate) continue;

      const isInvoiceSale = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
      const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
      const invId = invMatch ? invMatch[1] : null;
      const invoice = invId ? invoices.find(inv => inv.id === invId) : null;

      if (isInvoiceSale && invoice && invoice.items && invoice.items.length > 0) {
        const rawPaid = Number(invoice.paidAmount || 0);
        const invoicePaid = Math.max(0, isNaN(rawPaid) ? 0 : rawPaid);

        // 1. Expand invoice items (all invoice item lines have debit = lineTotal and credit = 0)
        invoice.items.forEach((item) => {
          const lineTotal = item.quantity * item.price;
          const debit = lineTotal;

          // Debit increases customer debt (-)
          running -= debit;

          rows.push({
            num: counter++,
            date: invoice.date || h.date,
            ref: invoice.id,
            itemName: item.itemName,
            quantity: item.quantity,
            price: item.price,
            lineTotal: lineTotal,
            debit: debit,
            credit: 0,
            runningBalance: running,
            status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
            isInvoiceItem: true,
            invoiceId: invoice.id
          });
        });

        // 2. Add the single dedicated payment row right below the last item of the invoice
        if (invoicePaid > 0) {
          // Payment credit reduces customer debt (+)
          running += invoicePaid;

          rows.push({
            num: counter++,
            date: invoice.date || h.date,
            ref: invoice.id,
            itemName: 'دفعة',
            quantity: '-',
            price: '-',
            lineTotal: '-',
            debit: 0,
            credit: invoicePaid,
            runningBalance: running,
            status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
            isInvoiceItem: false,
            invoiceId: invoice.id
          });
        }
      } else {
        const isDebit = h.amount < 0;
        const debit = isDebit ? Math.abs(h.amount) : 0;
        const credit = !isDebit ? h.amount : 0;
        running += h.amount;

        const displayName = formatCustomerMovementDesc(h.description);
        let refCol = invId || '-';
        if (h.description.includes('افتتاحي')) refCol = 'افتتاحي';
        else if (
          h.description.includes('تسوية') || 
          h.description.includes('خصم') || 
          h.description.includes('تعديل') || 
          h.description.includes('يدوي') || 
          h.description.includes('حركة') ||
          h.description.includes('سداد خارجي') ||
          h.description.includes('بدون فاتورة') ||
          !invId
        ) {
          refCol = 'تسوية';
        }

        rows.push({
          num: counter++,
          date: h.date,
          ref: refCol,
          itemName: displayName,
          quantity: '-',
          price: '-',
          lineTotal: '-',
          debit,
          credit,
          runningBalance: running,
          status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
          isInvoiceItem: false,
          invoiceId: invId || undefined
        });
      }
    }

    return rows;
  };

  const itemizedRows = useMemo(() => {
    return getItemizedRowsForRange(filterStartDate, filterEndDate);
  }, [selectedCustomer, invoices, filterStartDate, filterEndDate]);

  // Invoice Mode rows with date range
  const invoiceRows = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.history) return [];

    const consumedPaymentIndices = getConsumedPaymentIndices(selectedCustomer.history);
    let prior = 0;

    if (filterStartDate) {
      selectedCustomer.history.forEach((h, i) => {
        if (h.description.includes('تعديل فاتورة') || consumedPaymentIndices.has(i)) return;
        if (h.date < filterStartDate) {
          const isInv = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة');
          const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
          const invId = invMatch ? invMatch[1] : null;
          const invoice = invId ? invoices.find(inv => inv.id === invId) : null;
          if (isInv && invoice) {
            const paid = Math.max(0, Number(invoice.paidAmount || 0));
            prior -= (invoice.total - paid);
          } else {
            prior += h.amount;
          }
        }
      });
    }

    const list: typeof selectedCustomer.history = [];
    if (filterStartDate && prior !== 0) {
      list.push({
        date: filterStartDate,
        description: 'رصيد سابق ما قبل الفترة',
        amount: prior
      });
    }

    selectedCustomer.history.forEach((h, i) => {
      if (h.description.includes('تعديل فاتورة') || consumedPaymentIndices.has(i)) return;
      if (filterStartDate && h.date < filterStartDate) return;
      if (filterEndDate && h.date > filterEndDate) return;

      const isInv = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة');
      const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
      const invId = invMatch ? invMatch[1] : null;
      const invoice = invId ? invoices.find(inv => inv.id === invId) : null;
      const invPaid = (isInv && invoice) ? Math.max(0, Number(invoice.paidAmount || 0)) : 0;

      list.push({
        ...h,
        amount: (isInv && invoice) ? -invoice.total : h.amount,
        description: formatCustomerMovementDesc(h.description)
      });

      if (invPaid > 0 && invoice) {
        list.push({
          date: invoice.date || h.date,
          description: 'دفعة',
          amount: invPaid
        });
      }
    });

    return list;
  }, [selectedCustomer, invoices, filterStartDate, filterEndDate]);

  // Summary Metrics based on currently filtered rows
  const totalEggQuantity = useMemo(() => {
    return itemizedRows.reduce((sum, r) => typeof r.quantity === 'number' ? sum + r.quantity : sum, 0);
  }, [itemizedRows]);

  const totalItemizedLineTotal = useMemo(() => {
    return itemizedRows.reduce((sum, r) => typeof r.lineTotal === 'number' ? sum + r.lineTotal : sum, 0);
  }, [itemizedRows]);

  const totalItemizedDebit = useMemo(() => {
    return itemizedRows.reduce((sum, r) => sum + r.debit, 0);
  }, [itemizedRows]);

  const totalItemizedCredit = useMemo(() => {
    return itemizedRows.reduce((sum, r) => sum + r.credit, 0);
  }, [itemizedRows]);

  const finalItemizedBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    if (itemizedRows.length > 0) {
      return totalItemizedCredit - totalItemizedDebit;
    }
    return Number(selectedCustomer.balance) || 0;
  }, [selectedCustomer, itemizedRows.length, totalItemizedCredit, totalItemizedDebit]);

  // Handler to print statement with optional custom dates
  const handlePrintStatement = (sDate?: string, eDate?: string) => {
    if (!selectedCustomer) return;
    const targetRows = getItemizedRowsForRange(sDate, eDate);
    const deb = targetRows.reduce((sum, r) => sum + r.debit, 0);
    const cred = targetRows.reduce((sum, r) => sum + r.credit, 0);
    const lastRow = targetRows[targetRows.length - 1];
    const finalBal = lastRow ? lastRow.runningBalance : selectedCustomer.balance;

    const dateLabel = (sDate || eDate) ? ` للفترة (${sDate ? `من ${sDate}` : ''} ${eDate ? `إلى ${eDate}` : ''})` : '';

    printLedger({
      title: viewMode === 'ITEMS' 
        ? `بيان كشف حساب عميل تفصيلي بالأصناف والأسعار${dateLabel}` 
        : `كشف حساب عميل مجمع بالفواتير${dateLabel}`,
      entityName: selectedCustomer.name,
      entityCode: selectedCustomer.code,
      entityPhone: selectedCustomer.phone,
      type: 'CUSTOMER',
      dateRange: (sDate || eDate) ? { from: sDate, to: eDate } : undefined,
      rows: targetRows,
      totalDebit: deb,
      totalCredit: cred,
      finalBalance: finalBal
    });
    setIsPrintModalOpen(false);
  };

  // Handler to share statement via WhatsApp as PDF
  const handleShareWhatsAppStatement = async (sDate?: string, eDate?: string) => {
    if (!selectedCustomer || isSharingPdf) return;
    const fromDate = sDate !== undefined ? sDate : filterStartDate;
    const toDate = eDate !== undefined ? eDate : filterEndDate;
    const targetRows = getItemizedRowsForRange(fromDate, toDate);
    const deb = targetRows.reduce((sum, r) => sum + r.debit, 0);
    const cred = targetRows.reduce((sum, r) => sum + r.credit, 0);
    const lastRow = targetRows[targetRows.length - 1];
    const finalBal = lastRow ? lastRow.runningBalance : selectedCustomer.balance;

    const dateLabel = (fromDate || toDate) ? ` للفترة (${fromDate ? `من ${fromDate}` : ''} ${toDate ? `إلى ${toDate}` : ''})` : '';

    let syncTab: Window | null = null;
    const isNative = typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function';

    if (!isNative) {
      try {
        syncTab = window.open('about:blank', '_blank');
      } catch {}
    }

    let safetyTimer: any = null;
    try {
      setIsSharingPdf(true);
      // Failsafe timer so the button NEVER remains stuck on 'جاري التحويل'
      safetyTimer = setTimeout(() => {
        setIsSharingPdf(false);
      }, 3500);

      await shareCustomerStatementPdfViaWhatsApp({
        title: viewMode === 'ITEMS' 
          ? `بيان كشف حساب عميل تفصيلي بالأصناف والأسعار${dateLabel}` 
          : `كشف حساب عميل مجمع بالفواتير${dateLabel}`,
        entityName: selectedCustomer.name,
        entityCode: selectedCustomer.code,
        entityPhone: selectedCustomer.phone,
        dateRange: (fromDate || toDate) ? { from: fromDate, to: toDate } : undefined,
        rows: targetRows,
        totalDebit: deb,
        totalCredit: cred,
        finalBalance: finalBal
      }, companyLogo, null, syncTab);
    } catch (err: any) {
      if (syncTab && !syncTab.closed) syncTab.close();
      if (
        err?.name !== 'AbortError' &&
        err?.name !== 'NotAllowedError' &&
        !err?.message?.includes?.('AbortError') &&
        !err?.message?.includes?.('canceled') &&
        !err?.message?.includes?.('cancelled')
      ) {
        console.error(err);
      }
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSharingPdf(false);
      setIsPrintModalOpen(false);
    }
  };

  const applyDatePreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30' | 'TODAY') => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (preset === 'ALL') {
      setPrintStartDate('');
      setPrintEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setPrintStartDate(first);
      setPrintEndDate(today);
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setPrintStartDate(first);
      setPrintEndDate(last);
    } else if (preset === 'LAST_30') {
      const prior = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setPrintStartDate(prior);
      setPrintEndDate(today);
    } else if (preset === 'TODAY') {
      setPrintStartDate(today);
      setPrintEndDate(today);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 h-[calc(100dvh-60px)] md:h-[calc(100vh-85px)] min-h-0">
      
      {/* Sleek Compact Action Toolbar (Hidden on mobile when viewing customer details) */}
      <div className={`bg-white px-3 py-2 rounded-xl shadow-xs border border-brand-100 flex-wrap justify-between items-center gap-2 ${
        mobileView === 'DETAILS' ? 'hidden lg:flex' : 'flex'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            type="button" 
            onClick={() => window.history.back()}
            className="lg:hidden flex items-center gap-1 text-xs font-bold text-brand-950 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg border border-brand-200 transition-all shadow-2xs shrink-0"
            title="العودة للصفحة السابقة"
          >
            <ArrowRight size={14} />
            <span>العودة</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-brand-900 text-base">العملاء</span>
            <span className="bg-brand-50 text-brand-700 font-mono font-bold text-xs px-2 py-0.5 rounded-full border border-brand-200">
              {filteredCustomers.length}
            </span>
          </div>

          {/* Branch Filter Tabs */}
          <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
            <button 
              type="button" 
              onClick={() => { setSelectedBranchFilter('ALL'); setSelectedAreaFilter('ALL'); }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${selectedBranchFilter === 'ALL' ? 'bg-white text-brand-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              كل الإدارات
            </button>
            <button 
              type="button" 
              onClick={() => { setSelectedBranchFilter('MARG'); setSelectedAreaFilter('ALL'); }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${selectedBranchFilter === 'MARG' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              إدارة المرج
            </button>
            <button 
              type="button" 
              onClick={() => { setSelectedBranchFilter('NOZHA'); setSelectedAreaFilter('ALL'); }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${selectedBranchFilter === 'NOZHA' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              إدارة النزهة
            </button>
          </div>

          {/* Dynamic Area Filter Dropdown */}
          {selectedBranchFilter !== 'ALL' && (
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
              <MapPin size={12} className="text-gray-400" />
              <select
                value={selectedAreaFilter}
                onChange={e => setSelectedAreaFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer max-w-[170px]"
              >
                <option value="ALL">جميع مناطق {selectedBranchFilter === 'NOZHA' ? 'النزهة' : 'المرج'}</option>
                {availableFilterAreas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {/* Real-time Search Input */}
          <div className="relative">
            <Search size={15} className="absolute right-2.5 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="بحث بالاسم أو الكود أو المنطقة..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-8 pl-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-500 focus:bg-white w-44 sm:w-56 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors shadow-xs"
          >
            <PlusCircle size={15} /> إضافة عميل جديد
          </button>
          
          <button 
            onClick={() => {
              setConsolidatedInitialTab('CUSTOMERS');
              setIsConsolidatedModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-800 transition-colors shadow-xs"
            title="عرض وطباعة كشف حساب مجمع لجميع العملاء"
          >
            <Layers size={15} /> كشف حساب مجمع للعملاء
          </button>
        </div>
      </div>

      {/* Main Grid: Customer List (col-3) + Statement Ledger (col-9) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0">
        
        {/* Customer List Sidebar (Hidden on mobile when in DETAILS view) */}
        <div className={`lg:col-span-3 bg-white rounded-xl shadow-xs border border-brand-100 flex-col min-h-0 overflow-hidden ${
          mobileView === 'DETAILS' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-2.5 bg-brand-50/60 border-b border-brand-100 flex justify-between items-center text-xs font-bold text-brand-900">
            <span>قائمة العملاء</span>
            <span className="text-gray-500 font-normal">اضغط لفتح الحساب</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredCustomers.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs">
                {searchTerm || selectedBranchFilter !== 'ALL' || selectedAreaFilter !== 'ALL' 
                  ? 'لا توجد نتائج مطابقة للبحث أو الفلتر المحدد' 
                  : 'لا يوجد عملاء مسجلين'}
              </div>
            ) : (
              filteredCustomers.map((c, idx) => {
                const isSelected = selectedCustomer?.code === c.code;
                const isNegative = c.balance < 0;
                const isPositive = c.balance > 0;
                const bId = c.branchId || 'MARG';

                return (
                  <div 
                    key={`${c.code}_${idx}`}
                    onClick={() => {
                      setSelectedCustomerCode(c.code);
                      setMobileView('DETAILS');
                    }}
                    className={`p-2.5 hover:bg-brand-50/60 cursor-pointer transition-colors relative group flex items-center justify-between ${
                      isSelected ? 'bg-brand-50/90 border-r-4 border-brand-600' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900 text-xs truncate">{c.name}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-mono font-bold">
                          {c.code}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          bId === 'NOZHA' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-brand-100 text-brand-800 border border-brand-200'
                        }`}>
                          {bId === 'NOZHA' ? 'النزهة' : 'المرج'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                        {c.area && (
                          <span className="flex items-center gap-0.5 text-gray-500 font-medium">
                            <MapPin size={10} /> {c.area}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-0.5 font-mono" dir="ltr">
                            <Phone size={10} /> {c.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-1.5">
                      <div className="text-left">
                        <p className={`font-black text-xs font-mono ${isNegative ? 'text-red-600' : isPositive ? 'text-green-600' : 'text-gray-600'}`} dir="ltr">
                          {c.balance.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400">
                          {isNegative ? 'عليه' : isPositive ? 'له' : 'خالص'}
                        </p>
                      </div>

                      {/* Quick Action Buttons (Edit / Delete) */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleOpenEditModal(e, c)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="تعديل بيانات العميل"
                        >
                          <Edit size={13} />
                        </button>

                        {canDeleteCustomers && (
                          deleteConfirmId === c.code ? (
                           <div className="flex items-center gap-0.5 bg-red-50 p-0.5 rounded border border-red-200" onClick={e => e.stopPropagation()}>
                             <button 
                               onClick={(e) => handleDelete(e, c.code)} 
                               className="bg-red-500 text-white p-1 rounded hover:bg-red-600" 
                               title="تأكيد الحذف"
                             >
                               <Check size={12}/>
                             </button>
                             <button 
                               onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} 
                               className="bg-white text-gray-500 p-1 rounded border hover:bg-gray-100" 
                               title="إلغاء"
                             >
                               <X size={12}/>
                             </button>
                           </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.code); }}
                            className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                            title="حذف العميل"
                          >
                            <Trash2 size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Customer Statement (بيان كشف الحساب) - Wide & Roomy (Hidden on mobile when in LIST view) */}
        <div className={`lg:col-span-9 bg-white rounded-xl shadow-xs border border-brand-100 flex-col min-h-0 overflow-hidden ${
          mobileView === 'LIST' ? 'hidden lg:flex' : 'flex'
        }`}>
          {selectedCustomer ? (
            <div className="flex flex-col h-full min-h-0">
              
              {/* 1. Mobile-Only Compact Header (Minimal Vertical Space, 100% Focused on Statement Table) */}
              <div className="lg:hidden p-2 bg-white border-b border-gray-200 flex flex-col gap-1.5 shrink-0">
                {/* Row 1: Back + Name + Code + Compact Balance Badge */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button 
                      type="button"
                      onClick={() => setMobileView('LIST')}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 px-2.5 py-1.5 rounded-lg shadow-xs transition-all shrink-0 cursor-pointer"
                      title="العودة لقائمة العملاء"
                    >
                      <ArrowRight size={14} />
                      <span>العودة للقائمة</span>
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-xs font-black text-brand-900 truncate flex items-center gap-1">
                        {selectedCustomer.name}
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-mono">
                          {selectedCustomer.code}
                        </span>
                      </h2>
                    </div>
                  </div>

                  {/* Compact Balance Badge */}
                  <div className={`px-2 py-0.5 rounded-lg border flex items-center gap-1 shrink-0 ${
                    selectedCustomer.balance < 0 
                      ? 'bg-red-50 border-red-200 text-red-700' 
                      : selectedCustomer.balance > 0 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                    <span className="text-[10px] font-bold text-gray-500">الرصيد:</span>
                    <span className="text-xs font-black font-mono" dir="ltr">
                      {selectedCustomer.balance.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold">
                      {selectedCustomer.balance < 0 ? '(عليه)' : selectedCustomer.balance > 0 ? '(له)' : '(خالص)'}
                    </span>
                  </div>
                </div>

                {/* Active Date Filter Chip on Mobile (if filtered) */}
                {(filterStartDate || filterEndDate) && (
                  <div className="flex items-center justify-between bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-[10px] border border-blue-200">
                    <span className="font-bold flex items-center gap-1">
                      <Calendar size={11} /> الفترة: {filterStartDate || 'البداية'} إلى {filterEndDate || 'الآن'}
                    </span>
                    <button 
                      onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} 
                      className="text-blue-600 hover:text-blue-800 font-bold"
                    >
                      <X size={11} /> إلغاء التصفية
                    </button>
                  </div>
                )}

                {/* Row 2: Controls (View Mode Toggle + Print by Date + Excel) */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-100">
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setViewMode('ITEMS')}
                      className={`px-2 py-0.5 rounded font-bold transition-all ${
                        viewMode === 'ITEMS' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600'
                      }`}
                    >
                      بالأصناف
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('INVOICES')}
                      className={`px-2 py-0.5 rounded font-bold transition-all ${
                        viewMode === 'INVOICES' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600'
                      }`}
                    >
                      مجمع
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleOpenManualTxModal}
                      className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs"
                      title="إضافة حركة / تسوية يدوية مباشرة للعميل بدون فاتورة"
                    >
                      <PlusCircle size={11} /> + تسوية
                    </button>

                    <button 
                      onClick={() => {
                        setPrintStartDate(filterStartDate);
                        setPrintEndDate(filterEndDate);
                        setIsPrintModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded text-[11px] font-bold hover:bg-blue-700 shadow-2xs"
                    >
                      <Printer size={11} /> طباعة
                    </button>

                    <button 
                      onClick={() => handleShareWhatsAppStatement()}
                      disabled={isSharingPdf}
                      className="flex items-center gap-1 bg-[#25D366] hover:bg-[#1ebc59] text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs disabled:opacity-50"
                      title="إرسال كشف الحساب PDF عبر واتساب مباشرة"
                    >
                      <MessageCircle size={11} /> {isSharingPdf ? '...' : 'PDF واتساب'}
                    </button>

                    <button 
                      onClick={() => {
                        setConsolidatedInitialTab('CUSTOMERS');
                        setIsConsolidatedModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-slate-700 text-white px-2 py-0.5 rounded text-[11px] font-bold hover:bg-slate-800 shadow-2xs"
                      title="فتح كشف الحساب المجمع"
                    >
                      <Layers size={11} /> كشف مجمع
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Desktop-Only Rich Header Banner */}
              <div className="hidden lg:block p-3 border-b border-gray-200 bg-gradient-to-r from-slate-50 via-white to-brand-50/40 shrink-0">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  
                  {/* Right: Customer Info + Secondary Metric Chips */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg md:text-xl font-black text-brand-900 flex items-center gap-2">
                        {selectedCustomer.name}
                        <button 
                          onClick={(e) => handleOpenEditModal(e, selectedCustomer)}
                          className="text-xs font-normal text-gray-500 hover:text-brand-700 bg-white border border-gray-200 hover:border-brand-300 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors shadow-2xs"
                          title="تعديل بيانات العميل"
                        >
                          <Edit size={12}/> تعديل
                        </button>
                      </h2>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono font-bold border border-gray-200">
                        كود: {selectedCustomer.code}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        (selectedCustomer.branchId || 'MARG') === 'NOZHA' 
                          ? 'bg-amber-100 text-amber-800 border-amber-300' 
                          : 'bg-brand-100 text-brand-800 border-brand-300'
                      }`}>
                        {(selectedCustomer.branchId || 'MARG') === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج'}
                      </span>
                      {selectedCustomer.area && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200 flex items-center gap-1">
                          <MapPin size={11} /> {selectedCustomer.area}
                        </span>
                      )}
                      {selectedCustomer.phone && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-100 flex items-center gap-1" dir="ltr">
                          <Phone size={11} /> {selectedCustomer.phone}
                        </span>
                      )}
                    </div>

                    {/* Secondary Metrics Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="bg-white border border-amber-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs">
                        <span className="text-gray-500 font-bold">كراتين البيض:</span>
                        <span className="font-mono font-black text-amber-800">{totalEggQuantity.toLocaleString()}</span>
                      </div>

                      <div className="bg-white border border-red-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs">
                        <span className="text-gray-500 font-bold">مسحوبات (مدين):</span>
                        <span className="font-mono font-black text-red-600">{totalItemizedDebit.toLocaleString()} ج.م</span>
                      </div>

                      <div className="bg-white border border-green-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs">
                        <span className="text-gray-500 font-bold">مدفوعات (دائن):</span>
                        <span className="font-mono font-black text-green-600">{totalItemizedCredit.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* Left: Prominent Balance Box with Large Font (خانة الرصيد في شمال الصفحة بخط أكبر - مربوطة بصافي الإجماليات) */}
                  <div className={`mr-auto px-4 py-2.5 rounded-xl border flex flex-col items-center justify-center text-center shadow-xs transition-all min-w-[150px] ${
                    finalItemizedBalance < 0 
                      ? 'bg-red-50/90 border-red-300' 
                      : finalItemizedBalance > 0 
                      ? 'bg-emerald-50/90 border-emerald-300' 
                      : 'bg-gray-50 border-gray-300'
                  }`}>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">الرصيد الحالي</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${
                        finalItemizedBalance < 0 ? 'text-red-600' : finalItemizedBalance > 0 ? 'text-emerald-600' : 'text-gray-800'
                      }`} dir="ltr">
                        {finalItemizedBalance.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-gray-600">ج.م</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                      finalItemizedBalance < 0 
                        ? 'bg-red-100 text-red-700' 
                        : finalItemizedBalance > 0 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {finalItemizedBalance < 0 ? 'مدين (عليه لنا)' : finalItemizedBalance > 0 ? 'دائن (له علينا)' : 'خالص'}
                    </span>
                  </div>

                </div>

                {/* Sub-toolbar: View Switch & Actions */}
                <div className="flex flex-wrap justify-between items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                        <FileText size={14} className="text-brand-600" /> شكل العرض:
                      </span>
                      <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setViewMode('ITEMS')}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                            viewMode === 'ITEMS' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-brand-700'
                          }`}
                        >
                          <Package size={13} /> بيان بالأصناف والأسعار (كالفاتورة)
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('INVOICES')}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                            viewMode === 'INVOICES' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-brand-700'
                          }`}
                        >
                          <Layers size={13} /> مجمع بالفواتير
                        </button>
                      </div>
                    </div>

                    {/* Active Date Filter Chip or Filter Button on Desktop */}
                    {(filterStartDate || filterEndDate) ? (
                      <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-200 shadow-2xs">
                        <Calendar size={13} className="text-blue-600" />
                        <span>الفترة: {filterStartDate || 'البداية'} إلى {filterEndDate || 'الآن'}</span>
                        <button
                          onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                          className="hover:text-red-600 mr-1"
                          title="إلغاء التصفية وعرض الكل"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPrintStartDate('');
                          setPrintEndDate('');
                          setIsPrintModalOpen(true);
                        }}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-700 bg-gray-50 hover:bg-brand-50 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-brand-300 transition-colors"
                      >
                        <Filter size={13} /> تصفية بالتاريخ
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {currentUser?.permissions.canDeleteLedgers && (
                      showClearLedgerConfirm ? (
                         <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg border border-red-200 animate-fade-in text-xs">
                           <AlertTriangle size={14} className="text-red-500" />
                           <span className="font-bold text-red-600">تأكيد التصفير؟</span>
                           <button 
                             onClick={handleClearLedger}
                             className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold hover:bg-red-700"
                           >
                             نعم
                           </button>
                           <button 
                             onClick={() => setShowClearLedgerConfirm(false)}
                             className="bg-white text-gray-600 px-2 py-0.5 rounded border text-xs font-bold hover:bg-gray-100"
                           >
                             إلغاء
                           </button>
                         </div>
                      ) : (
                        <button 
                          onClick={() => setShowClearLedgerConfirm(true)}
                          className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-md text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
                          title="مسح الحركات وتصفير الحساب"
                        >
                          <Trash2 size={13} /> تصفير
                        </button>
                      )
                    )}

                    <button 
                      onClick={handleOpenManualTxModal}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3 py-1 rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer"
                      title="إضافة معاملة أو تسوية يدوية مباشرة في كشف حساب العميل بدون فاتورة"
                    >
                      <PlusCircle size={14} className="stroke-[2.5]" /> + إضافة حركة / تسوية يدوية
                    </button>

                    <button 
                      onClick={() => {
                        setPrintStartDate(filterStartDate);
                        setPrintEndDate(filterEndDate);
                        setIsPrintModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                    >
                      <Printer size={13} /> طباعة كشف الحساب
                    </button>

                    <button 
                      onClick={() => handleShareWhatsAppStatement()}
                      disabled={isSharingPdf}
                      className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebc59] active:bg-[#199d4b] text-white px-3 py-1 rounded-md text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      title="إرسال كشف الحساب كملف PDF عبر واتساب مباشرة بدون حفظه على الجهاز"
                    >
                      <MessageCircle size={14} className="fill-white/20" /> {isSharingPdf ? 'جاري التحويل...' : 'إرسال PDF عبر واتساب'}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setConsolidatedInitialTab('CUSTOMERS');
                        setIsConsolidatedModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-slate-700 text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs"
                      title="فتح كشف الحساب المجمع"
                    >
                      <Layers size={13} /> كشف حساب مجمع
                    </button>
                  </div>
                </div>
              </div>

              {/* Statement Table Area - Scrollable with Pinned Header & Footer */}
              <div className="flex-1 min-h-0 overflow-auto">
                {viewMode === 'ITEMS' ? (
                  /* ITEM-BY-ITEM DETAILED STATEMENT TABLE (EXACTLY AS IN SALES INVOICE) */
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-gray-100 text-gray-800 font-bold sticky top-0 z-10 border-b border-gray-300 shadow-2xs">
                      <tr>
                        <th className="p-2 text-center w-8 border-l border-gray-200">م</th>
                        <th className="p-2 text-center w-24 whitespace-nowrap border-l border-gray-200">التاريخ</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200">الفاتورة</th>
                        <th className="p-2 border-l border-gray-200">الصنف / البيان</th>
                        <th className="p-2 text-center w-16 border-l border-gray-200">الكمية</th>
                        <th className="p-2 text-center w-16 border-l border-gray-200">السعر</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200 bg-amber-50/70 text-amber-900">الإجمالي</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200 text-red-700 bg-red-50/50">مدين</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200 text-green-700 bg-green-50/50">دائن</th>
                        <th className="p-2 text-center w-24 border-l border-gray-200 bg-gray-50">الرصيد</th>
                        <th className="p-2 text-center w-24 min-w-[85px] whitespace-nowrap">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {itemizedRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-gray-400 font-medium">
                            لا توجد حركات مسجلة لهذا العميل حتى الآن
                          </td>
                        </tr>
                      ) : (
                        itemizedRows.map((r, idx) => (
                          <tr 
                            key={idx} 
                            className={`transition-colors ${
                              r.isInvoiceItem ? 'hover:bg-amber-50/50' : 'bg-gray-50/40 hover:bg-gray-100/60'
                            }`}
                          >
                            <td className="p-2 text-center text-gray-500 font-mono border-l border-gray-100">{r.num}</td>
                            <td className="p-2 text-center text-gray-600 whitespace-nowrap font-mono border-l border-gray-100">{r.date}</td>
                            <td className="p-2 text-center font-mono border-l border-gray-100">
                              {r.invoiceId ? (
                                <button 
                                  onClick={() => handleViewInvoiceDetails(`فاتورة #${r.invoiceId}`)}
                                  className="text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-1.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-0.5 border border-brand-200"
                                  title="عرض تفاصيل الفاتورة"
                                >
                                  #{r.invoiceId}
                                  <Eye size={11} />
                                </button>
                              ) : r.ref && r.ref !== '-' ? (
                                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                  {r.ref}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="p-2 font-bold text-gray-800 border-l border-gray-100">
                              {r.isInvoiceItem ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                  {r.itemName}
                                </span>
                              ) : (
                                <span className="text-gray-700 font-medium">{r.itemName}</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-bold text-gray-800 border-l border-gray-100">
                              {typeof r.quantity === 'number' ? (
                                <span className="bg-amber-100/70 text-amber-950 px-1.5 py-0.5 rounded font-mono font-black text-xs">
                                  {r.quantity.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono text-gray-700 border-l border-gray-100">
                              {typeof r.price === 'number' ? r.price.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-amber-900 bg-amber-50/40 border-l border-gray-100">
                              {typeof r.lineTotal === 'number' ? r.lineTotal.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-black text-red-600 bg-red-50/30 border-l border-gray-100">
                              {r.debit > 0 ? r.debit.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-black text-green-600 bg-green-50/30 border-l border-gray-100">
                              {r.credit > 0 ? r.credit.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-black text-gray-900 bg-gray-50/60 border-l border-gray-100" dir="ltr">
                              {r.runningBalance.toLocaleString()}
                            </td>
                            <td className="p-2 text-center font-bold text-[11px] whitespace-nowrap min-w-[85px]">
                              {r.status === 'مدين' ? (
                                <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">عليه</span>
                              ) : r.status === 'دائن' ? (
                                <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">له</span>
                              ) : (
                                <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-gray-500">متزن</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {itemizedRows.length > 0 && (
                      <tfoot className="bg-gray-100 font-bold sticky bottom-0 z-10 border-t-2 border-gray-300 shadow-xs">
                        <tr>
                          <td colSpan={4} className="p-2 text-right font-black border-l border-gray-200">الإجماليات:</td>
                          <td className="p-2 text-center text-amber-900 font-black font-mono border-l border-gray-200">
                            {totalEggQuantity.toLocaleString()}
                          </td>
                          <td className="p-2 text-center text-gray-400 border-l border-gray-200">-</td>
                          <td className="p-2 text-center text-amber-950 font-black font-mono border-l border-gray-200 bg-amber-100/60">
                            {totalItemizedLineTotal.toLocaleString()}
                          </td>
                          <td className="p-2 text-center text-red-700 font-black font-mono border-l border-gray-200 bg-red-100/60">
                            {totalItemizedDebit.toLocaleString()}
                          </td>
                          <td className="p-2 text-center text-green-700 font-black font-mono border-l border-gray-200 bg-green-100/60">
                            {totalItemizedCredit.toLocaleString()}
                          </td>
                          <td className="p-2 text-center font-black font-mono text-brand-900 border-l border-gray-200 bg-brand-50" dir="ltr">
                            {finalItemizedBalance.toLocaleString()}
                          </td>
                          <td className="p-2 text-center font-bold text-xs whitespace-nowrap min-w-[85px]">
                            {finalItemizedBalance < 0 ? (
                              <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-red-700 font-black">مدين (عليه)</span>
                            ) : finalItemizedBalance > 0 ? (
                              <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-green-700 font-black">دائن (له)</span>
                            ) : (
                              <span className="inline-flex items-center justify-center text-center whitespace-nowrap text-gray-600 font-black">خالص</span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  /* SUMMARY INVOICE VIEW */
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-gray-100 text-gray-800 font-bold sticky top-0 z-10 border-b border-gray-300">
                      <tr>
                        <th className="p-2.5 text-center w-12 border-l border-gray-200">م</th>
                        <th className="p-2.5 text-center w-24 border-l border-gray-200">التاريخ</th>
                        <th className="p-2.5 border-l border-gray-200">البيان</th>
                        <th className="p-2.5 text-center w-28 text-red-700 bg-red-50/50 border-l border-gray-200">مدين</th>
                        <th className="p-2.5 text-center w-28 text-green-700 bg-green-50/50 border-l border-gray-200">دائن</th>
                        <th className="p-2.5 text-center w-28 border-l border-gray-200">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invoiceRows.length === 0 ? (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-400">لا توجد حركات مسجلة للفترة المحددة</td></tr>
                      ) : (
                        (() => {
                          let runBal = 0;
                          return invoiceRows.map((h, idx) => {
                            runBal += h.amount;
                            const isDebit = h.amount < 0;
                            const isCredit = h.amount > 0;
                            const invoiceIdMatch = h.description.match(/#([A-Za-z0-9-]+)/);
                            const hasInvoiceId = !!invoiceIdMatch;

                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-2.5 text-center text-gray-500 font-mono border-l border-gray-100">{idx + 1}</td>
                                <td className="p-2.5 text-center text-gray-600 whitespace-nowrap font-mono border-l border-gray-100">{h.date}</td>
                                <td className="p-2.5 font-medium text-gray-800 border-l border-gray-100">
                                  <div className="flex justify-between items-center">
                                    <span>{h.description}</span>
                                    {hasInvoiceId && (
                                      <button 
                                        onClick={() => handleViewInvoiceDetails(h.description)}
                                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1"
                                        title="عرض تفاصيل الفاتورة"
                                      >
                                        عرض الفاتورة <Eye size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5 text-center font-bold font-mono text-red-600 bg-red-50/30 border-l border-gray-100">
                                  {isDebit ? Math.abs(h.amount).toLocaleString() : '-'}
                                </td>
                                <td className="p-2.5 text-center font-bold font-mono text-green-600 bg-green-50/30 border-l border-gray-100">
                                  {isCredit ? h.amount.toLocaleString() : '-'}
                                </td>
                                <td className="p-2.5 text-center font-black font-mono text-gray-900" dir="ltr">
                                  {runBal.toLocaleString()}
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
              <UserPlus size={44} className="mb-2 opacity-40 text-brand-500"/>
              <p className="font-bold text-sm">اختر عميلاً من القائمة لعرض بيان كشف الحساب</p>
              <button 
                type="button"
                onClick={() => setMobileView('LIST')}
                className="lg:hidden mt-3 flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg shadow-xs"
              >
                <ArrowRight size={14} /> العودة لقائمة العملاء
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal (Clean popup, frees up screen real estate) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className={`p-4 flex justify-between items-center text-white shrink-0 ${isEditing ? 'bg-blue-600' : 'bg-brand-600'}`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                {isEditing ? <Edit size={18} /> : <UserPlus size={18} />}
                {isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h3>
              <button onClick={handleCloseModal} className="hover:bg-black/20 p-1 rounded-full transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomer} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">كود العميل</label>
                <input 
                  type="text" 
                  required
                  className={`w-full p-2.5 border rounded-lg outline-none font-mono font-bold text-sm ${isEditing ? 'bg-white border-blue-300' : 'bg-gray-50 border-gray-300'}`}
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  placeholder="مثال: C001"
                />
              </div>

              {/* Branch Selection - Clean Single Select Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الإدارة / الفرع <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) => {
                    const newBranch = e.target.value as BranchId;
                    setFormData(prev => ({
                      ...prev,
                      branchId: newBranch,
                      area: newBranch === 'MARG'
                        ? (prev.area && !BRANCH_AREAS.NOZHA.includes(prev.area) ? prev.area : (getBranchAreas('MARG', customers)[0] || 'المرج القديمة'))
                        : (prev.area && !BRANCH_AREAS.MARG.includes(prev.area) ? prev.area : (getBranchAreas('NOZHA', customers)[0] || 'النزهة الجديدة'))
                    }));
                  }}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none text-xs font-bold text-gray-900 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 transition-all cursor-pointer"
                >
                  <option value="MARG">إدارة المرج</option>
                  <option value="NOZHA">إدارة النزهة</option>
                </select>
              </div>

              {/* Area Selection - Creatable Combobox & Datalist */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <MapPin size={13} className="text-brand-600" />
                    <span>المنطقة الجغرافية <span className="text-red-500">*</span></span>
                  </label>
                  <span className="text-[10px] text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded">
                    اختر أو اكتب اسم المنطقة / الشارع يدوياً
                  </span>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="customerModalAreaSuggestions"
                    placeholder="اختر من القائمة أو اكتب اسم منطقة أو شارع جديد..."
                    value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm font-bold bg-white"
                  />
                  <datalist id="customerModalAreaSuggestions">
                    {modalBranchAreas.map(areaName => (
                      <option key={areaName} value={areaName} />
                    ))}
                  </datalist>
                </div>

                {/* Quick Selection Pills */}
                <div className="mt-2">
                  <p className="text-[10px] text-gray-500 font-medium mb-1">
                    المناطق الشائعة في {formData.branchId === 'NOZHA' ? 'النزهة' : 'المرج'} (اضغط للاختيار السريع أو اكتب أعلاه):
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-gray-50 rounded-lg border border-gray-200">
                    {modalBranchAreas.map(areaName => {
                      const isSelected = formData.area === areaName;
                      return (
                        <button
                          key={areaName}
                          type="button"
                          onClick={() => setFormData({ ...formData, area: areaName })}
                          className={`text-[11px] px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                            isSelected
                              ? 'bg-brand-600 text-white font-bold shadow-xs'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected && <Check size={11} />}
                          <span>{areaName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم العميل <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-brand-500 text-sm font-bold"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="اسم العميل أو المحل"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-brand-500 text-sm font-mono"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-700">
                    {isEditing ? 'تعديل الرصيد الحالي' : 'رصيد افتتاحي'}
                  </label>
                  {isEditing && (
                    <span className="text-[11px] text-gray-500 font-mono" dir="ltr">
                      الرصيد السابق: {originalBalance.toLocaleString()} ج.م
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    dir="ltr"
                    placeholder="0"
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-brand-500 font-mono font-bold text-center text-sm"
                    value={formData.balance}
                    onFocus={e => e.target.select()}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setFormData({...formData, balance: val}), true)}
                  />
                  <span className="absolute left-2.5 top-2.5 text-[11px] text-gray-400 pointer-events-none">
                    (سالب = عليه)
                  </span>
                </div>

                {/* Reason / Statement Description for Balance Adjustment */}
                {(() => {
                  const parsedModalBal = parseNumberFromCommas(formData.balance);
                  const balDiff = isEditing ? (parsedModalBal - originalBalance) : parsedModalBal;
                  const isChanged = isEditing ? (balDiff !== 0) : (parsedModalBal !== 0);
                  if (!isChanged) return null;

                  return (
                    <div className="mt-3 p-3 bg-amber-50/90 rounded-xl border border-amber-300 space-y-2 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          <span>سبب/بيان تعديل الرصيد</span>
                          <span className="text-red-600 font-black text-sm">* (إجباري)</span>
                        </label>
                        {isEditing && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                            balDiff > 0 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}>
                            {balDiff > 0 ? `دائن (+${balDiff.toLocaleString()} ج.م)` : `مدين (${balDiff.toLocaleString()} ج.م)`}
                          </span>
                        )}
                      </div>
                      
                      <input 
                        type="text" 
                        required
                        placeholder="مثال: تسوية حساب، رصيد افتتاحي، خصم إضافي، فرق جرد..."
                        className="w-full p-2.5 bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-xs font-bold text-gray-800 placeholder:text-gray-400"
                        value={formData.adjustmentReason}
                        onChange={e => setFormData({ ...formData, adjustmentReason: e.target.value })}
                      />

                      {/* Quick suggestion tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {['تسوية حساب', 'رصيد افتتاحي', 'خصم إضافي', 'تعديل جرد', 'فرق حساب'].map(chip => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setFormData({ ...formData, adjustmentReason: chip })}
                            className={`text-[11px] px-2.5 py-1 rounded-md transition-colors font-bold ${
                              formData.adjustmentReason === chip 
                                ? 'bg-amber-600 text-white shadow-xs' 
                                : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      
                      <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                        سيتم تسجيل حركة تسوية رسمية في كشف حساب العميل بهذا المسمى مع إظهار الفرق بدقة في عمود (مدين/دائن) وتحديث الرصيد التراكمي.
                      </p>
                    </div>
                  );
                })()}
              </div>

              </div>

              {/* Fixed bottom action buttons bar */}
              <div className="sticky bottom-0 bg-white p-3 border-t border-gray-200 shrink-0 z-10 flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                  type="submit" 
                  className={`flex-1 text-white py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                    isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  <Check size={16} /> {isEditing ? 'تحديث البيانات' : 'حفظ العميل'}
                </button>
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Details Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FileText size={18}/> تفاصيل الفاتورة {viewInvoice.id}
              </h2>
              <button onClick={() => setViewInvoice(null)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                   <span className="block text-gray-400 text-[10px]">العميل</span>
                   <span className="font-bold text-gray-800 text-sm">{viewInvoice.customerName}</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                   <span className="block text-gray-400 text-[10px]">التاريخ والوقت</span>
                   <span className="font-bold text-gray-800 text-sm font-mono">{viewInvoice.date} - {viewInvoice.time}</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold">
                    <tr>
                      <th className="p-2 border-l border-gray-200">الصنف</th>
                      <th className="p-2 text-center border-l border-gray-200">الكمية</th>
                      <th className="p-2 text-center border-l border-gray-200">السعر</th>
                      <th className="p-2 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2 font-bold text-gray-800 border-l border-gray-100">
                          {item.itemName} <span className="text-[10px] text-gray-400 font-mono">({item.itemCode})</span>
                        </td>
                        <td className="p-2 text-center font-mono font-bold border-l border-gray-100">{item.quantity} كرتونة</td>
                        <td className="p-2 text-center font-mono border-l border-gray-100">{item.price.toLocaleString()}</td>
                        <td className="p-2 text-center font-bold font-mono text-brand-900">{item.total.toLocaleString()} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-900 text-white p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center text-sm font-bold">
                   <span>إجمالي الفاتورة:</span>
                   <span className="text-base text-amber-400 font-mono">{viewInvoice.total.toLocaleString()} ج.م</span>
                </div>
                {(() => {
                  const paid = viewInvoice.paidAmount || 0;
                  const remaining = viewInvoice.remainingAmount !== undefined 
                    ? viewInvoice.remainingAmount 
                    : (viewInvoice.total - paid);

                  // حساب قديم / مديونية سابقة: الاعتماد على القيمة المسجلة وقت إصدار الفاتورة
                  let oldDebt = viewInvoice.previousBalance !== undefined 
                    ? viewInvoice.previousBalance 
                    : 0;
                  if (Object.is(oldDebt, -0) || Math.abs(oldDebt) < 0.0001) oldDebt = 0;

                  // إجمالي الحساب بعد الفاتورة = الحساب القديم + المتبقي من الفاتورة
                  let totalAfterInvoice = viewInvoice.currentBalance !== undefined
                    ? viewInvoice.currentBalance
                    : (oldDebt - remaining);
                  if (Object.is(totalAfterInvoice, -0) || Math.abs(totalAfterInvoice) < 0.0001) totalAfterInvoice = 0;

                  // مديونية العميل الحالية الآن (تشمل جميع الحركات والتحصيلات اللاحقة)
                  const liveCustomerDebt = customers.find(c => c.code === viewInvoice.customerCode)?.balance ?? viewInvoice.currentBalance ?? 0;

                  const paymentMethodLabel = viewInvoice.paymentMethod === 'BANK_AHLY' ? 'البنك الأهلي' 
                    : viewInvoice.paymentMethod === 'BANK_MISR' ? 'بنك مصر' 
                    : viewInvoice.paymentMethod === 'VF_CASH_AYMAN' ? 'فودافون كاش أيمن' 
                    : viewInvoice.paymentMethod === 'VF_CASH_KYRILLOS' ? 'فودافون كاش كيرلس' 
                    : 'خزنة (كاش)';

                  return (
                    <>
                      {/* السطر الثاني: المديونية السابقة */}
                      <div className="flex justify-between items-center text-xs text-gray-300 bg-gray-800 px-2.5 py-1.5 rounded">
                        <span>المديونية السابقة:</span>
                        <span className="font-bold font-mono" dir="ltr">{oldDebt.toLocaleString()} ج.م</span>
                      </div>

                      {/* السطر الثالث: دفعة مسددة */}
                      <div className="flex justify-between items-center text-xs text-emerald-300 bg-gray-800 px-2.5 py-1.5 rounded">
                         <span>دفعة مسددة:</span>
                         <span className="font-bold font-mono">{paid > 0 ? `${paid.toLocaleString()} ج.م` : '0 ج.م'}</span>
                      </div>

                      {/* السطر الرابع: الإجمالي */}
                      <div className="flex justify-between items-center text-xs font-bold text-amber-300 bg-gray-800 px-2.5 py-1.5 rounded border border-amber-500/30">
                        <span>الإجمالي:</span>
                        <span className="font-black font-mono text-sm" dir="ltr">{totalAfterInvoice.toLocaleString()} ج.م</span>
                      </div>

                      {/* شريط سفلي مستقل: رصيد العميل الحالي في كشف الحساب */}
                      <div className="mt-2 pt-2 border-t border-gray-700 bg-gray-800/60 p-2 rounded-lg text-[11px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                        <span className="text-gray-400">رصيد العميل الحالي في كشف الحساب:</span>
                        <span className={`font-mono font-bold ${liveCustomerDebt < 0 ? 'text-red-400' : liveCustomerDebt > 0 ? 'text-emerald-400' : 'text-gray-300'}`} dir="ltr">
                          {liveCustomerDebt.toLocaleString()} ج.م {liveCustomerDebt < 0 ? '(مدين)' : liveCustomerDebt > 0 ? '(له رصيد)' : '(خالص)'}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 border-t border-gray-200 flex flex-wrap justify-end gap-2">
              <button 
                onClick={() => {
                  const curBal = customers.find(c => c.code === viewInvoice.customerCode)?.balance ?? viewInvoice.currentBalance;
                  printInvoice({
                    ...viewInvoice,
                    currentBalance: curBal,
                    liveCustomerBalance: curBal
                  });
                }} 
                className="px-3.5 py-1.5 bg-gray-200 text-gray-800 rounded-lg text-xs font-bold hover:bg-gray-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14}/> طباعة الفاتورة
              </button>
              <button 
                onClick={() => {
                  const curBal = customers.find(c => c.code === viewInvoice.customerCode)?.balance ?? viewInvoice.currentBalance;
                  shareSalesInvoicePdfViaWhatsApp({
                    ...viewInvoice,
                    currentBalance: curBal,
                    liveCustomerBalance: curBal
                  }, companyLogo, selectedCustomer.phone);
                }} 
                className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <MessageCircle size={14}/> مشاركة PDF واتساب
              </button>
              <button 
                onClick={() => setViewInvoice(null)} 
                className="px-5 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print / Filter Statement by Custom Date Modal */}
      {isPrintModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Printer size={18} /> طباعة كشف حساب: {selectedCustomer.name}
              </h3>
              <button onClick={() => setIsPrintModalOpen(false)} className="hover:bg-blue-700 p-1 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">فترات سريعة:</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                  <button 
                    type="button" 
                    onClick={() => applyDatePreset('ALL')}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition-colors ${
                      !printStartDate && !printEndDate ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                    }`}
                  >
                    كل التواريخ
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyDatePreset('THIS_MONTH')}
                    className="py-1.5 px-2 rounded-lg font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    هذا الشهر
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyDatePreset('LAST_MONTH')}
                    className="py-1.5 px-2 rounded-lg font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    الشهر الماضي
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyDatePreset('LAST_30')}
                    className="py-1.5 px-2 rounded-lg font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    آخر 30 يوم
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyDatePreset('TODAY')}
                    className="py-1.5 px-2 rounded-lg font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    اليوم
                  </button>
                </div>
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">من تاريخ</label>
                  <input 
                    type="date"
                    value={printStartDate}
                    onChange={e => setPrintStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">إلى تاريخ</label>
                  <input 
                    type="date"
                    value={printEndDate}
                    onChange={e => setPrintEndDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Preview Box */}
              {(() => {
                const previewRows = getItemizedRowsForRange(printStartDate, printEndDate);
                const prevDebit = previewRows.reduce((sum, r) => sum + r.debit, 0);
                const prevCredit = previewRows.reduce((sum, r) => sum + r.credit, 0);
                const lastRow = previewRows[previewRows.length - 1];
                const previewBalance = lastRow ? lastRow.runningBalance : selectedCustomer.balance;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="font-bold text-gray-700 flex justify-between border-b pb-1">
                      <span>معاينة حركات الفترة:</span>
                      <span className="font-mono text-blue-600 font-bold">{previewRows.length} حركة مسجلة</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>إجمالي المدين (عليه):</span>
                      <span className="font-mono font-bold text-red-600">{prevDebit.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>إجمالي الدائن (سدادات/له):</span>
                      <span className="font-mono font-bold text-green-600">{prevCredit.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between font-black text-gray-900 border-t pt-1">
                      <span>الرصيد بنهاية الفترة:</span>
                      <span className={`font-mono text-sm ${previewBalance < 0 ? 'text-red-600' : previewBalance > 0 ? 'text-emerald-600' : 'text-gray-700'}`} dir="ltr">
                        {previewBalance.toLocaleString()} ج.م {previewBalance < 0 ? '(مدين)' : previewBalance > 0 ? '(دائن)' : '(متزن)'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handlePrintStatement(printStartDate, printEndDate)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Printer size={15} /> طباعة كشف الحساب
                </button>
                <button
                  type="button"
                  onClick={() => handleShareWhatsAppStatement(printStartDate, printEndDate)}
                  disabled={isSharingPdf}
                  className="bg-[#25D366] hover:bg-[#1ebc59] active:bg-[#199d4b] text-white py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  title="إرسال كشف الحساب كملف PDF عبر واتساب مباشرة بدون حفظه على الجهاز"
                >
                  <MessageCircle size={15} className="fill-white/20" /> {isSharingPdf ? 'جاري التحويل...' : 'إرسال PDF عبر واتساب'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStartDate(printStartDate);
                    setFilterEndDate(printEndDate);
                    setIsPrintModalOpen(false);
                  }}
                  className="bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 py-2.5 px-3 rounded-lg font-bold text-xs transition-colors"
                >
                  تطبيق التصفية على الشاشة
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-3 rounded-lg font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Customer Transaction / Adjustment Modal */}
      {isManualTxModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-150 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-brand-900 to-slate-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base">إضافة حركة / تسوية يدوية</h3>
                  <p className="text-xs text-brand-200 mt-0.5">
                    العميل: <span className="text-white font-bold">{selectedCustomer.name}</span> ({selectedCustomer.code})
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCloseManualTxModal} 
                className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveManualTransaction} className="p-4 sm:p-5 space-y-4 text-xs">
              
              {/* 1. Transaction Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">نوع الحركة / المعاملة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualTxType('DEBIT')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      manualTxType === 'DEBIT'
                        ? 'bg-red-50 text-red-700 border-red-400 ring-2 ring-red-500/20 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowDownCircle size={16} className={manualTxType === 'DEBIT' ? 'text-red-600' : 'text-gray-400'} />
                    <span>مدين (مسحوبات عليه / بضاعة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualTxType('CREDIT')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      manualTxType === 'CREDIT'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowUpCircle size={16} className={manualTxType === 'CREDIT' ? 'text-emerald-600' : 'text-gray-400'} />
                    <span>دائن (دفعة له / سداد خارجي)</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {manualTxType === 'DEBIT' 
                    ? '⚠️ حركة مدين تزيد من مديونية العميل (مسحوبات بدون فاتورة، فروق أسعار عليه، إلخ).' 
                    : '✅ حركة دائن تخفض من مديونية العميل (دفعة خارجية، خصم إضافي، تسوية سداد، إلخ).'}
                </p>
              </div>

              {/* 2. Amount and Date in Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    placeholder="0"
                    value={manualTxAmount}
                    onChange={(e) => handleNumericChangeWithCommas(e.target.value, setManualTxAmount)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-brand-600 font-mono font-bold text-sm bg-gray-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    required
                    value={manualTxDate}
                    onChange={(e) => setManualTxDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-brand-600 font-mono font-bold text-xs bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* 3. Description & Quick Chips */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">البيان / سبب المعاملة *</label>
                <input
                  type="text"
                  required
                  placeholder="اكتب بيان الحركة (مثال: مرتجع بضاعة، دفعة مسددة، بضاعة بدون فاتورة، خصم خاص)..."
                  value={manualTxDescription}
                  onChange={(e) => handleManualDescriptionChange(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-brand-600 font-bold text-xs bg-gray-50 focus:bg-white"
                />

                {/* Quick Suggestion Chips with Auto-Direction */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'مرتجع بضاعة',
                    'دفعة مسددة',
                    'سداد خارجي',
                    'خصم خاص',
                    'بضاعة بدون فاتورة',
                    'تسوية قديمة',
                    'فرق سعر',
                    'مصاريف نقل',
                    'تسوية رصيد'
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSelectQuickChip(chip)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                        chip === 'مرتجع بضاعة' || chip === 'دفعة مسددة'
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-gray-100 hover:bg-brand-100 text-gray-700 hover:text-brand-900 border-gray-200'
                      }`}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Live Balance Impact Preview */}
              {(() => {
                const parsed = parseNumberFromCommas(manualTxAmount) || 0;
                const change = manualTxType === 'DEBIT' ? -parsed : parsed;
                const currentBal = finalItemizedBalance;
                const projectedBal = currentBal + change;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>الرصيد الحالي قبل الحركة:</span>
                      <span className={`font-mono font-bold ${currentBal < 0 ? 'text-red-600' : currentBal > 0 ? 'text-emerald-600' : 'text-gray-700'}`} dir="ltr">
                        {Math.abs(currentBal).toLocaleString()} ج.م {currentBal < 0 ? '(مدين / عليه)' : currentBal > 0 ? '(دائن / له)' : '(خالص)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-gray-600">
                      <span>قيمة الحركة ({manualTxType === 'DEBIT' ? 'مدين / زيادة دين' : 'دائن / تخفيض دين'}):</span>
                      <span className={`font-mono font-bold ${manualTxType === 'DEBIT' ? 'text-red-600' : 'text-emerald-600'}`} dir="ltr">
                        {manualTxType === 'DEBIT' ? '-' : '+'}{parsed.toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-black text-gray-900 border-t border-slate-200 pt-1.5">
                      <span>الرصيد الجديد بعد الحفظ:</span>
                      <span className={`font-mono text-sm ${projectedBal < 0 ? 'text-red-600 font-black' : projectedBal > 0 ? 'text-emerald-600 font-black' : 'text-gray-700'}`} dir="ltr">
                        {Math.abs(projectedBal).toLocaleString()} ج.م {projectedBal < 0 ? '(مدين / عليه)' : projectedBal > 0 ? '(دائن / له)' : '(خالص)'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingManualTx}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Check size={16} />
                  <span>{isSavingManualTx ? 'جاري الحفظ...' : 'حفظ وإدراج في كشف الحساب'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseManualTxModal}
                  disabled={isSavingManualTx}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-4 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Consolidated Statement Modal */}
      <ConsolidatedLedgerModal
        isOpen={isConsolidatedModalOpen}
        onClose={() => setIsConsolidatedModalOpen(false)}
        initialTab={consolidatedInitialTab}
        onSelectEntity={(type, code) => {
          if (type === 'CUSTOMER') {
            setSelectedCustomerCode(code);
            setMobileView('DETAILS');
          }
        }}
      />
    </div>
  );
};
