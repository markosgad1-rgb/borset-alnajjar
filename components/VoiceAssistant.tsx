import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, X, Send, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { canFeature, canViewPage } from '../utils/permissions';
import {
  detectIntent, normalizeAr, parseInvoiceText, parseBalanceText, pickFromOptions, parseSingleNumber, numberToArabicSpeech, tokensOf, spanScore
} from '../utils/arabicVoice';

type DraftItem = { options: { name: string; code: string }[]; code?: string; name?: string; quantity?: number; price?: number };
type Draft = { customer?: { code: string; name: string }; customerOptions: { code: string; name: string }[]; items: DraftItem[]; paid?: number; paidAll?: boolean; credit?: boolean };
type Pending =
  | { kind: 'confirm' }
  | { kind: 'customer'; options: { code: string; name: string }[] }
  | { kind: 'customer-free' }
  | { kind: 'product'; idx: number }
  | { kind: 'qty'; idx: number }
  | { kind: 'price'; idx: number }
  | { kind: 'items' }
  | { kind: 'balance'; options: { type: 'C' | 'S'; code: string; name: string }[] }
  | null;

const SR: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} ج.م`;
const say = (n: number) => numberToArabicSpeech(n);

const PAGES: { id: string; label: string; keys: string[] }[] = [
  { id: 'sales-history', label: 'سجل الفواتير', keys: ['سجل'] },
  { id: 'sales', label: 'فواتير البيع', keys: ['فواتير', 'فاتوره', 'مبيعات', 'بيع'] },
  { id: 'purchases', label: 'المشتريات', keys: ['مشتريات', 'شراء'] },
  { id: 'warehouse', label: 'المخزن', keys: ['مخزن', 'مخزون', 'اصناف'] },
  { id: 'customers', label: 'العملاء', keys: ['عملا', 'عميل', 'عملاء'] },
  { id: 'suppliers', label: 'الموردين', keys: ['مورد', 'موردين', 'تجار'] },
  { id: 'employees', label: 'الموظفين', keys: ['موظف', 'موظفين'] },
  { id: 'collections', label: 'التحصيل', keys: ['تحصيل', 'تحصيلات'] },
  { id: 'transfers', label: 'التحويلات', keys: ['تحويلات', 'تحويل'] },
  { id: 'expenses', label: 'المصروفات', keys: ['مصروفات', 'مصاريف'] },
  { id: 'treasury', label: 'الخزنة', keys: ['خزنه', 'خزينه'] },
  { id: 'reports', label: 'التقارير', keys: ['تقارير', 'تقرير'] },
  { id: 'dashboard', label: 'الرئيسية', keys: ['رئيسيه', 'داشبورد', 'الرئيسيه'] },
];
const OPEN_VERBS = ['افتح', 'افتحلي', 'افتحي', 'روح', 'وديني', 'ودني', 'خدني', 'وريني', 'اعرض', 'اعرضلي', 'شغل', 'ادخل', 'ادخلي', 'روحلي', 'افتحلى'];

export const VoiceAssistant: React.FC<{ onNavigate?: (page: any) => void }> = ({ onNavigate }) => {
  const { currentUser, customers, suppliers, products, purchases, rawInvoices, invoices, addInvoice, customerBalanceOf, calculateSupplierBalance, userScope } = useERP() as any;
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('اضغط على المايك وقول مثلاً: "رصيد عماد رزق" أو "اعمل فاتورة لمرقص ابيض كبير 100 بسعر 120" أو "افتح صفحة العملاء" أو "آخر فاتورة".');
  const [speakOn, setSpeakOn] = useState(true);
  const [typed, setTyped] = useState('');
  const [draftView, setDraftView] = useState<Draft | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [balanceCard, setBalanceCard] = useState<{ title: string; text: string; neg: boolean } | null>(null);

  const draft = useRef<Draft | null>(null);
  const pending = useRef<Pending>(null);
  const recRef = useRef<any>(null);
  const saving = useRef(false);
  const speakOnRef = useRef(true);
  speakOnRef.current = speakOn;
  const openRef = useRef(false);
  openRef.current = open;

  const allowed = canFeature(currentUser, 'voiceAssistant');
  const canSales = canViewPage(currentUser, 'sales');
  const canCust = canViewPage(currentUser, 'customers') || canSales;
  const canSupp = canViewPage(currentUser, 'suppliers');

  const custList = useMemo(() => (customers || []).filter((c: any) => !c.isDeleted).map((c: any) => ({ code: c.code, name: c.name })), [customers]);
  const suppList = useMemo(() => (suppliers || []).filter((s: any) => !s.isDeleted).map((s: any) => ({ code: s.code, name: s.name })), [suppliers]);
  const prodList = useMemo(() => (products || []).map((p: any) => ({ code: p.code, name: p.name, price: p.price })), [products]);

  // ---------- صوت ----------
  const speak = useCallback((text: string): Promise<void> => new Promise(resolve => {
    setReply(text);
    try {
      if (!speakOnRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const ar = voices.filter(x => x.lang?.toLowerCase().startsWith('ar'));
      const maleRe = /hamed|naayf|majed|maged|shakir|tarik|salem|حامد|نايف|ماجد|شاكر|male/i;
      const male = ar.find(x => maleRe.test(x.name));
      const v = male || ar.find(x => x.lang === 'ar-EG') || ar[0];
      if (v) u.voice = v;
      u.lang = v?.lang || 'ar-EG';
      u.rate = 0.95;
      u.pitch = male ? 0.9 : 0.5; // لو مفيش صوت راجل جاهز: نغلّظ الصوت
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      setTimeout(resolve, Math.min(30000, 2500 + text.length * 120));
    } catch { resolve(); }
  }), []);

  const stopListening = useCallback(() => {
    try { recRef.current?.abort?.(); } catch { /* ignore */ }
    recRef.current = null;
    setListening(false);
  }, []);

  const handleAlts = useRef<(alts: string[]) => Promise<void>>(async () => {});

  const startListening = useCallback(() => {
    if (!SR) { setReply('المتصفح ده مش بيدعم التعرّف على الصوت. استخدم Chrome أو Edge، أو اكتب الأمر في الخانة تحت.'); return; }
    stopListening();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = 'ar-EG';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 3;
    let finalAlts: string[] = [];
    let gotFinal = false;
    rec.onstart = () => { setListening(true); setHeard(''); };
    rec.onresult = (e: any) => {
      const res = e.results[e.results.length - 1];
      setHeard(res[0]?.transcript || '');
      if (res.isFinal) {
        gotFinal = true;
        finalAlts = Array.from({ length: res.length }, (_: any, i: number) => String(res[i].transcript || '')).filter(Boolean);
      }
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setReply('محتاج إذن المايك. اسمح للمايك من إعدادات المتصفح وجرّب تاني.');
      else if (e.error === 'no-speech') setReply('ما سمعتش حاجة. اضغط على المايك وقول تاني.');
      else if (e.error === 'network') setReply('التعرّف على الصوت محتاج إنترنت.');
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (gotFinal && finalAlts.length) handleAlts.current(finalAlts);
    };
    recRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  }, [stopListening]);

  const speakThenListen = useCallback(async (text: string) => {
    await speak(text);
    if (openRef.current) startListening();
  }, [speak, startListening]);

  // ---------- مساعدات ----------
  const yesNo = (t: string) => { const i = detectIntent(t); return i === 'YES' ? 'Y' : i === 'NO' ? 'N' : ''; };

  const branchOf = (c: any) => (c?.branchId as string) || (userScope?.restricted ? userScope.branch : 'MARG');
  const stockOf = (code: string, branch: string) => {
    const p = (products || []).find((x: any) => x.code === code);
    if (!p) return null;
    return branch === 'NOZHA' ? (p.quantityNozha !== undefined ? p.quantityNozha : 0) : (p.quantityMarg !== undefined ? p.quantityMarg : p.quantity);
  };

  const totals = (d: Draft) => {
    const lines = d.items.map(i => ({ ...i, total: Math.round((i.quantity || 0) * (i.price || 0) * 100) / 100 }));
    const total = Math.round(lines.reduce((a, l) => a + l.total, 0) * 100) / 100;
    const paid = d.credit ? 0 : d.paidAll ? total : Math.min(total, Math.max(0, d.paid || 0));
    return { lines, total, paid, remaining: Math.round((total - paid) * 100) / 100 };
  };

  // يكمّل المسودة: يسأل عن أول ناقص، أو يطلب التأكيد
  const advance = async (): Promise<void> => {
    const d = draft.current; if (!d) return;
    setDraftView({ ...d });
    if (!d.customer) {
      if (d.customerOptions.length > 1) {
        pending.current = { kind: 'customer', options: d.customerOptions };
        setChoices(d.customerOptions.map(o => o.name));
        return speakThenListen(`تقصد ${d.customerOptions.slice(0, 3).map(o => o.name).join(' ولا ')}؟`);
      }
      if (d.customerOptions.length === 1) { d.customer = d.customerOptions[0]; }
      else { pending.current = { kind: 'customer-free' }; setChoices([]); return speakThenListen('الفاتورة لمين؟ قول اسم العميل.'); }
    }
    if (!d.items.length) { pending.current = { kind: 'items' }; setChoices([]); return speakThenListen(`تمام، فاتورة لـ ${d.customer!.name}. هتبيع إيه؟ قول الصنف والكمية.`); }
    for (let i = 0; i < d.items.length; i++) {
      const it = d.items[i];
      if (!it.code) {
        if (it.options.length === 1) { it.code = it.options[0].code; it.name = it.options[0].name; }
        else { pending.current = { kind: 'product', idx: i }; setChoices(it.options.map(o => o.name)); return speakThenListen(`تقصد ${it.options.slice(0, 3).map(o => o.name).join(' ولا ')}؟`); }
      }
      if (!it.quantity || it.quantity <= 0) { pending.current = { kind: 'qty', idx: i }; setChoices([]); return speakThenListen(`كام كرتونة من ${it.name}؟`); }
      if (it.price === undefined) {
        const def = (products || []).find((p: any) => p.code === it.code)?.price;
        if (def && def > 0) it.price = def;
        else { pending.current = { kind: 'price', idx: i }; setChoices([]); return speakThenListen(`سعر ${it.name} كام؟`); }
      }
    }
    setDraftView({ ...d });
    const { lines, total, paid, remaining } = totals(d);
    const br = branchOf((customers || []).find((c: any) => c.code === d.customer!.code));
    const warn = lines.map(l => { const st = stockOf(l.code!, br); return st !== null && st < (l.quantity || 0) ? `تنبيه: المتاح من ${l.name} ${say(st)} بس.` : ''; }).filter(Boolean).join(' ');
    const desc = lines.map(l => `${say(l.quantity!)} ${l.name} بسعر ${say(l.price!)}`).join('، ');
    pending.current = { kind: 'confirm' }; setChoices([]);
    const text = `فاتورة لـ ${d.customer.name}: ${desc}. الإجمالي ${say(total)} جنيه${paid > 0 ? `، المدفوع ${say(paid)}` : ''}${remaining > 0 ? `، والباقي ${say(remaining)} على الحساب` : ''}. ${warn} احفظها؟`;
    return speakThenListen(text);
  };

  const save = async () => {
    const d = draft.current; if (!d || !d.customer || saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const cust = (customers || []).find((c: any) => c.code === d.customer!.code);
      const { lines, total, paid, remaining } = totals(d);
      const nums = (rawInvoices || []).filter((i: any) => /^N\d+$/.test(String(i.id))).map((i: any) => parseInt(String(i.id).replace(/\D/g, ''), 10));
      const wantedId = `N${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
      const now = new Date();
      const data: any = {
        id: wantedId,
        branchId: branchOf(cust),
        area: cust?.area || '',
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        customerCode: d.customer.code,
        customerName: d.customer.name,
        customerPhone: cust?.phone || '',
        items: lines.map(l => ({ itemCode: l.code, itemName: l.name, quantity: l.quantity, price: l.price, total: l.total })),
        total, paidAmount: paid, remainingAmount: remaining,
        ...(paid > 0 ? { paymentMethod: 'CASH' } : {})
      };
      const r = await addInvoice(data);
      const finalId = typeof r === 'string' && r ? r : wantedId;
      draft.current = null; pending.current = null; setDraftView(null); setChoices([]);
      await speak(`تم حفظ الفاتورة ${finalId} لـ ${d.customer.name} بإجمالي ${say(total)} جنيه.`);
    } catch (e) {
      console.error(e);
      await speak('حصلت مشكلة ومحفظتش الفاتورة. حاول تاني.');
    } finally { saving.current = false; setBusy(false); }
  };

  const cancelDraft = async (msg = 'تمام، الغيت.') => { draft.current = null; pending.current = null; setDraftView(null); setChoices([]); await speak(msg); };

  const answerBalance = async (o: { type: 'C' | 'S'; code: string; name: string }) => {
    pending.current = null; setChoices([]);
    if (o.type === 'C') {
      const c = (customers || []).find((x: any) => x.code === o.code); if (!c) return speak('مش لاقي العميل ده.');
      const bal = customerBalanceOf(c);
      const abs = Math.abs(bal);
      const text = Math.round(abs) === 0 ? `حساب ${o.name} متزن.` : bal < 0 ? `${o.name} عليه ${say(abs)} جنيه.` : `${o.name} ليه عندنا ${say(abs)} جنيه.`;
      setBalanceCard({ title: `العميل: ${o.name}`, text: `${Math.round(abs) === 0 ? 'متزن' : bal < 0 ? 'عليه' : 'له'} ${money(abs)}`, neg: bal < 0 });
      return speak(text);
    }
    const s = (suppliers || []).find((x: any) => x.code === o.code); if (!s) return speak('مش لاقي المورد ده.');
    const bal = calculateSupplierBalance(s, purchases);
    const abs = Math.abs(bal);
    const text = Math.round(abs) === 0 ? `حساب المورد ${o.name} متزن.` : bal < 0 ? `المورد ${o.name} ليه عندنا ${say(abs)} جنيه.` : `المورد ${o.name} عليه لينا ${say(abs)} جنيه.`;
    setBalanceCard({ title: `المورد: ${o.name}`, text: `${Math.round(abs) === 0 ? 'متزن' : bal < 0 ? 'له علينا' : 'لنا عنده'} ${money(abs)}`, neg: bal < 0 });
    return speak(text);
  };

  const startBalance = async (text: string) => {
    const r = parseBalanceText(text, canCust ? custList : [], canSupp ? suppList : []);
    const opts: { type: 'C' | 'S'; code: string; name: string; score: number }[] = [
      ...r.customers.map(c => ({ type: 'C' as const, code: c.code, name: c.name, score: c.score })),
      ...r.suppliers.map(s => ({ type: 'S' as const, code: s.code, name: s.name, score: s.score }))
    ].sort((a, b) => b.score - a.score);
    if (!opts.length) { pending.current = null; return speakThenListen('مش لاقي الاسم ده. قول اسم العميل أو المورد تاني.'); }
    const top = opts.filter(o => o.score >= opts[0].score - 0.05);
    if (top.length === 1) return answerBalance(top[0]);
    pending.current = { kind: 'balance', options: top.slice(0, 4) };
    setChoices(top.slice(0, 4).map(o => `${o.type === 'S' ? 'مورد: ' : ''}${o.name}`));
    return speakThenListen(`تقصد ${top.slice(0, 3).map(o => (o.type === 'S' ? 'المورد ' : '') + o.name).join(' ولا ')}؟`);
  };

  const startInvoice = async (text: string) => {
    if (!canSales) return speak('مش مسموحلك تعمل فواتير بيع.');
    const r = parseInvoiceText(text, custList, prodList);
    draft.current = {
      customerOptions: r.customerOptions.map(o => ({ code: o.code, name: o.name })),
      items: r.items.map(i => ({ options: i.options, quantity: i.quantity, price: i.price })),
      paid: r.paid, paidAll: r.paidAll, credit: r.credit
    };
    if (draft.current.customerOptions.length > 1 && draft.current.customerOptions[0] && r.customerOptions[0].score - r.customerOptions[1].score > 0.05) {
      draft.current.customerOptions = [draft.current.customerOptions[0]];
    }
    return advance();
  };

  const detectNav = (text: string) => {
    const t = normalizeAr(text).split(' ').map(w => w.replace(/^ال/, ''));
    if (!OPEN_VERBS.some(v => t.includes(normalizeAr(v)))) return null;
    const rest = t.filter(w => !OPEN_VERBS.map(normalizeAr).includes(w));
    // "سجل الفواتير" يتقدّم على "فواتير البيع"
    if (rest.includes('سجل')) return PAGES[0];
    return PAGES.find(pg => pg.id !== 'sales-history' && pg.keys.some(k => rest.includes(k.replace(/^ال/, '')))) || null;
  };

  const goPage = async (pg: { id: string; label: string }) => {
    if (!canViewPage(currentUser, pg.id as any)) { await speak(`مش مسموحلك تفتح ${pg.label}.`); return; }
    draft.current = null; pending.current = null; setDraftView(null); setChoices([]);
    await speak(`تمام، فتحت ${pg.label}.`);
    onNavigate?.(pg.id);
    setOpen(false);
  };

  const isLastInvoice = (text: string) => {
    const t = normalizeAr(text).split(' ');
    return t.includes('اخر') && (t.includes('فاتوره') || t.includes('فاتورة')) && !t.includes('اعمل') && !t.includes('اعملي');
  };

  const lastInvoice = async (text: string) => {
    if (!canViewPage(currentUser, 'sales') && !canViewPage(currentUser, 'sales-history')) { await speak('مش مسموحلك تشوف الفواتير.'); return; }
    const r = parseBalanceText(text, canCust ? custList : [], []);
    const cust = r.customers[0];
    let list = ((invoices || []) as any[]).filter(i => !i.isDeleted && (!cust || i.customerCode === cust.code));
    if (!list.length) { setBalanceCard(null); await speak(cust ? `مفيش فواتير لـ ${cust.name}.` : 'مفيش فواتير.'); return; }
    const key = (i: any) => `${i.date || ''} ${i.time || ''}`;
    const num = (i: any) => parseInt(String(i.id).replace(/\D/g, ''), 10) || 0;
    list = [...list].sort((a, b) => key(b).localeCompare(key(a)) || num(b) - num(a));
    const inv = list[0];
    const total = Number(inv.total) || 0; const paid = Number(inv.paidAmount) || 0; const rem = Number(inv.remainingAmount) || Math.max(0, total - paid);
    setBalanceCard({ title: `آخر فاتورة ${inv.id} — ${inv.customerName || ''} — ${inv.date || ''}`, text: `${money(total)}${rem > 0 ? ` (باقي ${money(rem)})` : ''}`, neg: rem > 0 });
    await speak(`آخر فاتورة ${cust ? `لـ ${cust.name}` : ''} رقم ${inv.id}${cust ? '' : ` للعميل ${inv.customerName || ''}`}، بتاريخ ${inv.date || ''}، إجماليها ${say(total)} جنيه${paid > 0 ? `، المدفوع ${say(paid)}` : ''}${rem > 0 ? `، والباقي ${say(rem)}` : ''}. تحب أفتح سجل الفواتير؟`);
    pending.current = { kind: 'openlog' } as any;
    setChoices(['افتح سجل الفواتير']);
  };

  // ---------- المعالجة الرئيسية ----------
  const processOne = async (text: string): Promise<boolean> => {
    const p = pending.current;
    const d = draft.current;
    const intent = detectIntent(text);
    if (p && d && intent === 'NO' && p.kind !== 'balance') { await cancelDraft(); return true; }
    if ((p as any)?.kind === 'openlog') {
      pending.current = null; setChoices([]);
      if (intent === 'YES' || /سجل|افتح/.test(normalizeAr(text))) { await goPage(PAGES[0]); return true; }
      if (intent === 'NO') { await speak('تمام.'); return true; }
    }
    const nav = detectNav(text);
    if (nav) { await goPage(nav); return true; }
    if (isLastInvoice(text)) { setBalanceCard(null); draft.current = null; if (pending.current?.kind !== undefined) pending.current = null; await lastInvoice(text); return true; }

    if (p?.kind === 'confirm' && d) {
      const yn = yesNo(text);
      if (yn === 'Y') { await save(); return true; }
      const n = parseInvoiceText(text, [], prodList);
      if (n.paid !== undefined || n.paidAll || n.credit) { d.paid = n.paid; d.paidAll = n.paidAll; d.credit = n.credit; await advance(); return true; }
      if (intent === 'INVOICE' || intent === 'BALANCE') { /* أمر جديد */ } else { await speakThenListen('قول "تمام" أحفظ الفاتورة، أو "الغي".'); return true; }
    }
    if (p?.kind === 'customer' && d) {
      const i = pickFromOptions(text, p.options.map(o => o.name));
      if (i < 0) { await speakThenListen('ما فهمتش. قول الاسم أو "الأول" و"التاني".'); return true; }
      d.customer = p.options[i]; d.customerOptions = [p.options[i]]; await advance(); return true;
    }
    if (p?.kind === 'customer-free' && d) {
      const r = parseBalanceText(text, custList, []);
      if (!r.customers.length) { await speakThenListen('مش لاقي العميل ده. قول الاسم تاني.'); return true; }
      d.customerOptions = r.customers.map(c => ({ code: c.code, name: c.name }));
      if (r.customers.length > 1 && r.customers[0].score - r.customers[1].score > 0.05) d.customerOptions = [d.customerOptions[0]];
      await advance(); return true;
    }
    if (p?.kind === 'items' && d) {
      const r = parseInvoiceText(text, [], prodList);
      if (!r.items.length) { await speakThenListen('مش لاقي الصنف ده. قول اسم الصنف والكمية.'); return true; }
      d.items = r.items.map(i => ({ options: i.options, quantity: i.quantity, price: i.price }));
      if (r.paid !== undefined) d.paid = r.paid; if (r.paidAll) d.paidAll = true; if (r.credit) d.credit = true;
      await advance(); return true;
    }
    if (p?.kind === 'product' && d) {
      const it = d.items[p.idx]; const i = pickFromOptions(text, it.options.map(o => o.name));
      if (i < 0) { await speakThenListen('ما فهمتش. قول اسم الصنف كامل.'); return true; }
      it.options = [it.options[i]]; it.code = it.options[0].code; it.name = it.options[0].name; await advance(); return true;
    }
    if ((p?.kind === 'qty' || p?.kind === 'price') && d) {
      const n = parseSingleNumber(text);
      if (n === null || n <= 0) { await speakThenListen('ما سمعتش رقم. قول الرقم تاني.'); return true; }
      if (p.kind === 'qty') d.items[p.idx].quantity = n; else d.items[p.idx].price = n;
      await advance(); return true;
    }
    if (p?.kind === 'balance') {
      const i = pickFromOptions(text, p.options.map(o => o.name));
      if (i < 0) { await speakThenListen('ما فهمتش. قول الاسم أو "الأول" و"التاني".'); return true; }
      await answerBalance(p.options[i]); return true;
    }

    if (intent === 'INVOICE') { setBalanceCard(null); await startInvoice(text); return true; }
    if (intent === 'BALANCE') { setBalanceCard(null); await startBalance(text); return true; }
    if (intent === 'HELP') { await speak('أقدر أعمل فاتورة بيع، أقولك رصيد أي عميل أو مورد، أدوّر على آخر فاتورة، أو أفتحلك أي صفحة. قول مثلاً: رصيد مرقص، آخر فاتورة لعماد، افتح صفحة العملاء.'); return true; }
    // جملة فيها اسم بس؟ نعتبرها استعلام رصيد
    const r = parseBalanceText(text, canCust ? custList : [], canSupp ? suppList : []);
    if (r.customers.length || r.suppliers.length) { await startBalance(text); return true; }
    return false;
  };

  handleAlts.current = async (alts: string[]) => {
    setBusy(true);
    try {
      for (const a of alts) { if (await processOne(a)) return; }
      await speakThenListen('ما فهمتش. ممكن تقول: رصيد فلان، أو اعمل فاتورة لفلان.');
    } catch (e) { console.error(e); await speak('حصلت مشكلة. جرّب تاني.'); }
    finally { setBusy(false); }
  };

  const resetAll = useCallback(() => {
    stopListening();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    draft.current = null; pending.current = null; saving.current = false;
    setDraftView(null); setChoices([]); setBalanceCard(null); setHeard(''); setTyped(''); setBusy(false);
    setReply('اضغط على المايك وقول مثلاً: "رصيد عماد رزق" أو "اعمل فاتورة لمرقص ابيض كبير 100 بسعر 120".');
  }, [stopListening]);

  useEffect(() => { if (!open) resetAll(); }, [open, resetAll]);
  useEffect(() => { try { window.speechSynthesis?.getVoices(); } catch { /* ignore */ } }, []);
  useEffect(() => () => { try { recRef.current?.abort?.(); window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  if (!allowed) return null;

  const total = draftView && draftView.items.every(i => i.quantity && i.price !== undefined) ? totals(draftView) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="fixed z-40 left-4 bottom-20 md:bottom-6 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl flex items-center justify-center"
        title="المساعد الصوتي"
      >
        {open ? <X size={26} /> : <Mic size={26} />}
      </button>

      {open && (
        <div dir="rtl" className="fixed z-40 left-2 right-2 sm:right-auto sm:w-[420px] sm:left-4 bottom-36 md:bottom-24 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-brand-600 text-white">
            <div className="font-bold">المساعد الصوتي</div>
            <button type="button" onClick={resetAll} className="px-2 py-1 rounded text-sm font-bold bg-brand-700 hover:bg-brand-800" title="طلب جديد">طلب جديد</button>
            <button type="button" onClick={() => setSpeakOn(v => !v)} className="p-1 rounded hover:bg-brand-700" title={speakOn ? 'كتم الصوت' : 'تشغيل الصوت'}>
              {speakOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-3">
            {heard && <div className="text-sm text-gray-500">سمعت: <span className="font-bold text-gray-700">{heard}</span></div>}
            <div className="text-lg font-bold text-gray-900 leading-relaxed">{reply}</div>

            {balanceCard && (
              <div className={`rounded-xl p-4 border-2 ${balanceCard.neg ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="text-sm text-gray-600">{balanceCard.title}</div>
                <div className={`text-3xl font-black ${balanceCard.neg ? 'text-red-700' : 'text-emerald-700'}`}>{balanceCard.text}</div>
              </div>
            )}

            {draftView && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                <div className="font-bold">فاتورة لـ {draftView.customer?.name || '—'}</div>
                {draftView.items.map((i, k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span>{i.name || i.options.map(o => o.name).join(' / ')}</span>
                    <span className="font-mono">{i.quantity ?? '؟'} × {i.price ?? '؟'}</span>
                  </div>
                ))}
                {total && (
                  <div className="border-t pt-1 mt-1 flex justify-between font-bold">
                    <span>الإجمالي</span><span className="font-mono">{money(total.total)}</span>
                  </div>
                )}
                {total && total.paid > 0 && <div className="flex justify-between text-emerald-700"><span>مدفوع</span><span className="font-mono">{money(total.paid)}</span></div>}
              </div>
            )}

            {choices.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {choices.map((c, i) => (
                  <button key={i} type="button" onClick={() => handleAlts.current([c])} className="px-3 py-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 font-bold text-sm">{c}</button>
                ))}
              </div>
            )}

            {pending.current?.kind === 'confirm' && (
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => { stopListening(); save(); }} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-60">احفظ الفاتورة</button>
                <button type="button" disabled={busy} onClick={() => { stopListening(); cancelDraft(); }} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold">إلغاء</button>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 space-y-2">
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              disabled={busy}
              className={`w-full py-4 rounded-xl text-white font-black text-lg flex items-center justify-center gap-2 ${listening ? 'bg-red-600 animate-pulse' : 'bg-brand-600 hover:bg-brand-700'} disabled:opacity-60`}
            >
              {busy ? <Loader2 className="animate-spin" size={22} /> : <Mic size={22} />}
              {listening ? 'بسمعك... (اضغط للإيقاف)' : busy ? 'ثانية...' : 'اضغط وقول'}
            </button>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const t = typed.trim(); if (t) { setTyped(''); setHeard(t); handleAlts.current([t]); } }}>
              <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="أو اكتب الأمر هنا" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <button type="submit" className="px-3 rounded-lg bg-gray-100 text-gray-700"><Send size={16} /></button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
