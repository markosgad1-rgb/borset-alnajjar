// فهم الكلام العربي (مصري/فصحى مبسطة) للمساعد الصوتي — بدون أي خدمة خارجية.
// كل الدوال هنا نقية (pure) عشان نقدر نختبرها لوحدها.

export const normalizeAr = (s: string): string => {
  let t = String(s ?? '').toLowerCase();
  t = t.replace(/[ً-ٰٟـ]/g, '');
  t = t.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  t = t.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  t = t.replace(/(\d)[,٬](?=\d{3}\b)/g, '$1');
  t = t.replace(/٫/g, '.');
  t = t.replace(/(^|\s)ب(\d)/g, '$1بسعر $2').replace(/(\d)([ا-ي])/g, '$1 $2').replace(/([ا-ي])(\d)/g, '$1 $2');
  t = t.replace(/[^ء-يa-z0-9.\s]/g, ' ');
  t = t.replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
};

export const tokensOf = (s: string): string[] => normalizeAr(s).split(' ').filter(Boolean);

const stripAl = (w: string) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w);
const stripWaw = (w: string) => (w.length > 3 && w.startsWith('و') ? w.slice(1) : w);
const stripLam = (w: string) => (w.length > 3 && w.startsWith('لل') ? 'ال' + w.slice(2) : (w.length > 3 && w.startsWith('ل') ? w.slice(1) : w));
const variantsOf = (w: string): string[] => { const a = stripWaw(w); return Array.from(new Set([w, a, stripLam(w), stripLam(a)])); };
const bestSim = (s: string, n: string) => Math.max(...variantsOf(s).map(v => wordSim(v, n)));

export const lev = (a: string, b: string): number => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

// تشابه كلمتين (0..1) مع تساهل بسيط في اختلافات النطق
const phon = (w: string) => w.replace(/ذ/g, 'د').replace(/ظ/g, 'ض').replace(/ث/g, 'ت').replace(/ص/g, 'س').replace(/ط/g, 'ت').replace(/ق/g, 'ك').replace(/ح/g, 'ه').replace(/غ/g, 'خ').replace(/ء|ع/g, 'ا');
export const wordSim = (a: string, b: string): number => {
  const x = stripAl(a), y = stripAl(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const px = phon(x), py = phon(y);
  if (px === py) return 0.95;
  const d = lev(px, py);
  const r = 1 - d / Math.max(px.length, py.length);
  if (Math.max(px.length, py.length) <= 3) return d === 0 ? 1 : 0;
  return r;
};

// تشابه مدى كلام (span) مع اسم (عميل/مورد/صنف)
export const spanScore = (span: string[], name: string[]): number => {
  if (!span.length || !name.length) return 0;
  let sum = 0;
  for (const s of span) {
    let best = 0;
    for (const n of name) best = Math.max(best, bestSim(s, n));
    sum += best;
  }
  const meanSpan = sum / span.length;
  let cov = 0;
  for (const n of name) {
    let best = 0;
    for (const s of span) best = Math.max(best, bestSim(s, n));
    if (best >= 0.8) cov += 1;
  }
  const coverage = cov / name.length;
  return meanSpan * (0.75 + 0.25 * coverage);
};

export interface SpanMatch<T> { item: T; start: number; len: number; score: number }

/** يدور على أفضل مطابقات لأسماء داخل الكلام (كل مطابقة = مدى كلمات + عنصر + درجة) */
export const findNameSpans = <T>(tokens: string[], items: T[], nameOf: (x: T) => string, blocked: boolean[], maxLen = 4, min = 0.8): SpanMatch<T>[] => {
  const out: SpanMatch<T>[] = [];
  const names = items.map(it => ({ it, toks: tokensOf(nameOf(it)) })).filter(x => x.toks.length);
  for (let i = 0; i < tokens.length; i++) {
    if (blocked[i]) continue;
    for (let len = 1; len <= maxLen && i + len <= tokens.length; len++) {
      let bad = false;
      for (let k = i; k < i + len; k++) if (blocked[k]) { bad = true; break; }
      if (bad) break;
      const span = tokens.slice(i, i + len);
      for (const nm of names) {
        const sc = spanScore(span, nm.toks);
        if (sc >= min) out.push({ item: nm.it, start: i, len, score: sc });
      }
    }
  }
  return out;
};

/** يختار مطابقات غير متداخلة (الأعلى درجة ثم الأطول) ويرجّع المتعادلين كغموض */
export const pickNonOverlapping = <T>(cands: SpanMatch<T>[], nTokens: number) => {
  const sorted = [...cands].sort((a, b) => (b.score - a.score) || (b.len - a.len) || (a.start - b.start));
  const used = new Array(nTokens).fill(false);
  const picked: { start: number; len: number; options: { item: T; score: number }[] }[] = [];
  for (const c of sorted) {
    let overlap = false;
    for (let k = c.start; k < c.start + c.len; k++) if (used[k]) { overlap = true; break; }
    if (overlap) continue;
    const same = sorted.filter(o => o.start === c.start && o.len === c.len && o.score >= c.score - 0.05);
    const seen = new Set<T>();
    const options = same.filter(o => (seen.has(o.item) ? false : (seen.add(o.item), true))).map(o => ({ item: o.item, score: o.score }));
    for (let k = c.start; k < c.start + c.len; k++) used[k] = true;
    picked.push({ start: c.start, len: c.len, options });
  }
  return picked.sort((a, b) => a.start - b.start);
};

// ---------------- الأرقام ----------------
const UNITS: Record<string, number> = {
  صفر: 0, واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, اثنان: 2, تنين: 2, ثنين: 2, تلاته: 3, ثلاثه: 3, تلات: 3, ثلاث: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5,
  سته: 6, ست: 6, سبعه: 7, سبع: 7, تمانيه: 8, ثمانيه: 8, تمان: 8, ثمان: 8, تمن: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10,
  حداشر: 11, احداشر: 11, اتناشر: 12, اثناشر: 12, تلتاشر: 13, تلاتاشر: 13, اربعتاشر: 14, خمستاشر: 15, ستاشر: 16, سبعتاشر: 17, تمنتاشر: 18, تسعتاشر: 19
};
const TENS: Record<string, number> = { عشرين: 20, تلاتين: 30, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70, تمانين: 80, ثمانين: 80, تسعين: 90 };
const HUNDREDS: Record<string, number> = {
  ميه: 100, مايه: 100, مئه: 100, مائه: 100, ميتين: 200, مئتين: 200, مائتين: 200, ميتان: 200,
  تلتميه: 300, تلاتميه: 300, ثلاثميه: 300, ثلاثمايه: 300, تلتمايه: 300, ربعميه: 400, اربعميه: 400, اربعمايه: 400, خمسميه: 500, خمسمايه: 500,
  ستميه: 600, ستمايه: 600, سبعميه: 700, سبعمايه: 700, تمنميه: 800, ثمانميه: 800, تمانميه: 800, ثمانمايه: 800, تسعميه: 900, تسعمايه: 900
};
const SCALES: Record<string, number> = { الف: 1000, الاف: 1000, تلاف: 1000, الفين: 2000, مليون: 1e6, مليونين: 2e6, ملايين: 1e6 };
const FRACS: Record<string, number> = { نص: 0.5, نصف: 0.5, ربع: 0.25, تلت: 1 / 3 };

const isNumWordCore = (w: string) => w in UNITS || w in TENS || w in HUNDREDS || w in SCALES || w in FRACS;

/** يقرا رقم يبدأ من tokens[i] (أرقام أو كلام). يرجّع القيمة وعدد الكلمات المستهلكة */
export const parseNumberAt = (tokens: string[], i: number): { value: number; used: number } | null => {
  const t0 = tokens[i];
  if (t0 === undefined) return null;
  if (/^\d+(\.\d+)?$/.test(t0)) {
    let v = parseFloat(t0); let used = 1;
    const nx = tokens[i + 1], nn = tokens[i + 2];
    if (nx === 'الف' || nx === 'الاف') { v *= 1000; used++; }
    else if (nx === 'مليون') { v *= 1e6; used++; }
    if (nn === undefined) return { value: v, used };
    if ((tokens[i + used] === 'و' || tokens[i + used] === 'ونص') && false) return { value: v, used };
    const f = tokens[i + used];
    if (f === 'ونص' || f === 'ونصف') { const base = v >= 1e6 ? 1e6 : v >= 1000 ? 1000 : 1; if (base > 1) { v += base / 2; used++; } }
    return { value: v, used };
  }
  let j = i; let total = 0; let group = 0; let any = false; let lastScale = 1; let sawCore = false;
  while (j < tokens.length) {
    let w = tokens[j];
    let hadWaw = false;
    if (w.length > 1 && w.startsWith('و') && !isNumWordCore(w) && isNumWordCore(w.slice(1))) { w = w.slice(1); hadWaw = true; }
    else if (w === 'و' && j + 1 < tokens.length && (isNumWordCore(tokens[j + 1]) || /^\d+$/.test(tokens[j + 1])) && any) { j++; continue; }
    if (w in FRACS && any) { group += FRACS[w] * lastScale; any = true; j++; lastScale = lastScale; continue; }
    if (w in FRACS && !any) { group = FRACS[w]; any = true; sawCore = true; j++; continue; }
    if (w in UNITS) { group += UNITS[w]; lastScale = 1; any = true; sawCore = true; j++; continue; }
    if (w in TENS) { group += TENS[w]; lastScale = 10; any = true; sawCore = true; j++; continue; }
    if (w in HUNDREDS) { group += HUNDREDS[w]; lastScale = 100; any = true; sawCore = true; j++; continue; }
    if (w in SCALES) {
      const mult = SCALES[w];
      if (mult === 2000 || mult === 2e6) { total += (group || 0) + mult; group = 0; }
      else { total += (group || 1) * mult; group = 0; }
      lastScale = mult >= 1e6 ? 1e6 : 1000; any = true; sawCore = true; j++; continue;
    }
    if (any && /^\d+(\.\d+)?$/.test(w)) { group += parseFloat(w); j++; continue; }
    break;
  }
  if (!any || !sawCore) return null;
  return { value: total + group, used: j - i };
};

// ---------------- التحدث بالأرقام (للقراءة الصوتية) ----------------
const U = ['', 'واحد', 'اتنين', 'تلاته', 'اربعه', 'خمسه', 'سته', 'سبعه', 'تمانيه', 'تسعه', 'عشره', 'حداشر', 'اتناشر', 'تلتاشر', 'اربعتاشر', 'خمستاشر', 'ستاشر', 'سبعتاشر', 'تمنتاشر', 'تسعتاشر'];
const T = ['', '', 'عشرين', 'تلاتين', 'اربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'];
const H = ['', 'ميه', 'ميتين', 'تلتميه', 'ربعميه', 'خمسميه', 'ستميه', 'سبعميه', 'تمنميه', 'تسعميه'];
const below1000 = (n: number): string => {
  const parts: string[] = [];
  const h = Math.floor(n / 100), r = n % 100;
  if (h) parts.push(H[h]);
  if (r) {
    if (r < 20) parts.push(U[r]);
    else { const u = r % 10, t = Math.floor(r / 10); parts.push(u ? `${U[u]} و${T[t]}` : T[t]); }
  }
  return parts.join(' و');
};
export const numberToArabicSpeech = (num: number): string => {
  const n = Math.round(Math.abs(num));
  if (n === 0) return 'صفر';
  const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const parts: string[] = [];
  if (mil) parts.push(mil === 1 ? 'مليون' : mil === 2 ? 'مليونين' : `${below1000(mil)} مليون`);
  if (th) parts.push(th === 1 ? 'الف' : th === 2 ? 'الفين' : th <= 10 ? `${below1000(th)} الاف` : `${below1000(th)} الف`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' و');
};

// ---------------- فهم الجملة ----------------
export type Intent = 'BALANCE' | 'INVOICE' | 'YES' | 'NO' | 'HELP' | 'UNKNOWN';

const has = (toks: string[], words: string[]) => toks.some(t => words.includes(stripAl(t)) || words.includes(t));
const YES_W = ['تمام', 'اكد', 'احفظ', 'ايوه', 'ايوا', 'اه', 'ماشي', 'موافق', 'نفذ', 'اوكي', 'اوكيه', 'تاكيد', 'اتفضل', 'خلاص', 'صح', 'اكيد', 'يلا'];
const NO_W = ['لا', 'الغي', 'الغاء', 'كنسل', 'وقف', 'بلاش', 'ماتحفظش', 'مش', 'لاء', 'سيبك', 'امسح'];

export const detectIntent = (text: string): Intent => {
  const t = tokensOf(text);
  if (!t.length) return 'UNKNOWN';
  const short = t.length <= 4;
  if (short && has(t, NO_W)) return 'NO';
  if (short && has(t, YES_W) && !has(t, ['فاتوره', 'رصيد', 'حساب'])) return 'YES';
  if (has(t, ['فاتوره', 'بيع', 'بيعله', 'بيعلو', 'بيعلها', 'فاتورة'])) return 'INVOICE';
  if (has(t, ['رصيد', 'حساب', 'مديونيه', 'مديونيته', 'كشف', 'مستحق', 'مستحقات']) || (has(t, ['كام']) && has(t, ['عليه', 'له', 'ليه', 'عليها', 'عنده', 'عندنا', 'على', 'علي']))) return 'BALANCE';
  if (has(t, ['مساعده', 'ساعدني', 'تعمل', 'تقدر'])) return 'HELP';
  return 'UNKNOWN';
};

const CUE_WORDS = new Set([
  'فاتوره', 'اعمل', 'اعملي', 'عمل', 'سجل', 'بيع', 'بيعله', 'بيعلو', 'عميل', 'للعميل', 'لعميل', 'مورد', 'للمورد', 'المورد', 'رصيد', 'حساب', 'مديونيه', 'كام', 'عليه', 'له', 'ليه', 'عليها',
  'عند', 'عنده', 'كشف', 'قولي', 'قول', 'عايز', 'عاوز', 'ابغي', 'اريد', 'من', 'فضلك', 'لو', 'سمحت', 'جديده', 'جديد', 'ده', 'دا', 'على', 'علي', 'ل', 'مع', 'يا', 'اخر'
]);
const PRICE_CUE = ['بسعر', 'سعر', 'سعرها', 'سعره', 'ب'];
const PAID_CUE = ['دفع', 'دافع', 'دفعلي', 'دفعلنا', 'سدد', 'مدفوع', 'كاش', 'عربون', 'مقدم', 'استلمت', 'قبضت', 'نقدي', 'ودفع', 'ودافع', 'وسدد'];
const UNIT_WORDS = new Set(['كرتونه', 'كراتين', 'كرتون', 'كارتونه', 'كرتونة', 'صندوق', 'صناديق', 'طبق', 'اطباق', 'وحده', 'قطعه', 'كيلو', 'جنيه', 'جنيها', 'جنية', 'جنيهات']);

export interface ParsedProductPick { start: number; len: number; options: { name: string; code: string; score: number }[] }
export interface ParsedItem { options: { name: string; code: string }[]; quantity?: number; price?: number }
export interface ParsedInvoice {
  customerOptions: { code: string; name: string; score: number }[];
  items: ParsedItem[];
  paid?: number;
  paidAll?: boolean;
  credit?: boolean;
}

export interface ProductLike { code: string; name: string; price?: number }
export interface EntityLike { code: string; name: string }

const resolveNumbers = (tokens: string[], blocked: boolean[]) => {
  const nums: { pos: number; used: number; value: number; cue: 'price' | 'paid' | null }[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (blocked[i]) { i++; continue; }
    const r = parseNumberAt(tokens, i);
    if (r && !blocked.slice(i, i + r.used).some(Boolean)) {
      let cue: 'price' | 'paid' | null = null;
      const prev = (k: number) => (i - k >= 0 ? tokens[i - k] : '');
      for (let k = 1; k <= 2; k++) {
        const w = prev(k);
        if (PRICE_CUE.includes(w)) { cue = 'price'; break; }
        if (PAID_CUE.includes(w) || PAID_CUE.includes(stripWaw(w))) { cue = 'paid'; break; }
      }
      nums.push({ pos: i, used: r.used, value: r.value, cue });
      i += r.used;
    } else i++;
  }
  return nums;
};

export const parseInvoiceText = (text: string, customers: EntityLike[], products: ProductLike[]): ParsedInvoice => {
  const tokens = tokensOf(text);
  const blocked = new Array(tokens.length).fill(false);
  tokens.forEach((t, i) => { if (CUE_WORDS.has(stripAl(t)) || CUE_WORDS.has(t) || UNIT_WORDS.has(t) || PRICE_CUE.includes(t) || PAID_CUE.includes(t) || t === 'و') blocked[i] = true; });

  // أصناف
  const pCands = findNameSpans(tokens, products, p => p.name, blocked, 3, 0.8);
  const pPicked = pickNonOverlapping(pCands, tokens.length);
  const pBlocked = [...blocked];
  pPicked.forEach(p => { for (let k = p.start; k < p.start + p.len; k++) pBlocked[k] = true; });

  // عميل (من الكلمات اللي مش أصناف ولا كلمات أوامر)
  const cBlocked = [...pBlocked];
  const cCands = findNameSpans(tokens, customers, c => c.name, cBlocked, 4, 0.8);
  const cPicked = pickNonOverlapping(cCands, tokens.length);
  const cBest = cPicked.sort((a, b) => (b.options[0].score - a.options[0].score) || (b.len - a.len))[0];
  const customerOptions = cBest ? cBest.options.map(o => ({ code: o.item.code, name: o.item.name, score: o.score })).sort((a, b) => b.score - a.score).slice(0, 4) : [];
  const allBlocked = [...pBlocked];
  if (cBest) for (let k = cBest.start; k < cBest.start + cBest.len; k++) allBlocked[k] = true;

  // أرقام
  const nums = resolveNumbers(tokens, allBlocked);
  const used = new Set<number>();
  const items: ParsedItem[] = pPicked.map(p => ({ options: p.options.map(o => ({ name: o.item.name, code: o.item.code })) }));
  const bounds = pPicked.map((p, idx) => ({ from: p.start + p.len, to: idx + 1 < pPicked.length ? pPicked[idx + 1].start : tokens.length, prevEnd: idx === 0 ? 0 : pPicked[idx - 1].start + pPicked[idx - 1].len, start: p.start }));

  let paid: number | undefined; let paidAll = false;
  nums.forEach((n, ni) => { if (n.cue === 'paid') { paid = (paid || 0) + n.value; used.add(ni); } });
  const joined = tokens.join(' ');
  if (/(مدفوع|دفع|سدد|كاش|نقدي)\s*(بالكامل|كامل|كله|الكل|كلو)/.test(joined) || /\b(بالكامل|كامل)\b/.test(joined) && paid === undefined && /(دفع|مدفوع|سدد|كاش)/.test(joined)) paidAll = true;
  const credit = /\b(اجل|آجل|بالاجل|على الحساب)\b/.test(joined) || /(^| )اجل( |$)/.test(joined);

  // أسلوب الجملة: "100 ابيض كبير" (الكمية قبل الصنف) ولا "ابيض كبير 100" (بعده)؟
  const numBefore = (idx: number) => {
    const b = bounds[idx]; let r = -1;
    nums.forEach((n, ni) => { if (!used.has(ni) && !n.cue && n.pos >= b.prevEnd && n.pos < b.start) r = ni; });
    return r;
  };
  const qtyBeforeStyle = items.length > 0 && numBefore(0) >= 0;
  items.forEach((it, idx) => {
    const b = bounds[idx];
    const priceIdx = nums.findIndex((n, ni) => !used.has(ni) && n.cue === 'price' && n.pos >= b.from && n.pos < b.to);
    if (priceIdx >= 0) { it.price = nums[priceIdx].value; used.add(priceIdx); }
    else {
      const pi2 = nums.findIndex((n, ni) => !used.has(ni) && n.cue === 'price' && n.pos >= b.prevEnd && n.pos < b.start);
      if (pi2 >= 0) { it.price = nums[pi2].value; used.add(pi2); }
    }
    const after = () => nums.findIndex((n, ni) => !used.has(ni) && !n.cue && n.pos >= b.from && n.pos < b.to);
    const q = qtyBeforeStyle ? (numBefore(idx) >= 0 ? numBefore(idx) : after()) : (after() >= 0 ? after() : numBefore(idx));
    if (q >= 0) { it.quantity = nums[q].value; used.add(q); }
  });

  // مبلغ مدفوع بدون كلمة (مثلاً "ودفع" اتفصلت) أو رقم زيادة بعد آخر صنف بعد كلمة دفع
  return { customerOptions, items, paid, paidAll, credit };
};

/** استعلام عن رصيد: يرجّع المرشحين من العملاء/الموردين */
export const parseBalanceText = (text: string, customers: EntityLike[], suppliers: EntityLike[]) => {
  const tokens = tokensOf(text);
  const wantSupplier = tokens.some(t => ['مورد', 'المورد', 'للمورد', 'موردين'].includes(t));
  const wantCustomer = tokens.some(t => ['عميل', 'العميل', 'للعميل', 'لعميل'].includes(t));
  const blocked = tokens.map(t => CUE_WORDS.has(stripAl(t)) || CUE_WORDS.has(t) || t === 'و');
  const run = <T extends EntityLike>(list: T[]) => {
    const picked = pickNonOverlapping(findNameSpans(tokens, list, x => x.name, blocked, 4, 0.8), tokens.length)
      .sort((a, b) => (b.options[0].score - a.options[0].score) || (b.len - a.len))[0];
    return picked ? picked.options.map(o => ({ code: o.item.code, name: o.item.name, score: o.score })).sort((a, b) => b.score - a.score).slice(0, 4) : [];
  };
  const c = wantSupplier && !wantCustomer ? [] : run(customers);
  const s = wantCustomer && !wantSupplier ? [] : run(suppliers);
  return { customers: c, suppliers: s, wantSupplier, wantCustomer };
};

/** رد قصير (رقم الاختيار أو اسم) على سؤال توضيحي */
export const pickFromOptions = (text: string, options: string[]): number => {
  const t = tokensOf(text);
  const ord: Record<string, number> = { الاول: 0, اول: 0, الاولي: 0, واحد: 0, الاولى: 0, التاني: 1, تاني: 1, الثاني: 1, اتنين: 1, التانيه: 1, التالت: 2, تالت: 2, الثالث: 2, تلاته: 2, الرابع: 3, رابع: 3, اربعه: 3 };
  for (const w of t) { const v = ord[w] ?? ord[stripAl(w)]; if (v !== undefined && v < options.length) return v; }
  let best = -1, bs = 0.8;
  options.forEach((o, i) => { const sc = spanScore(t, tokensOf(o)); if (sc > bs) { bs = sc; best = i; } });
  return best;
};

export const parseSingleNumber = (text: string): number | null => {
  const t = tokensOf(text);
  for (let i = 0; i < t.length; i++) { const r = parseNumberAt(t, i); if (r) return r.value; }
  return null;
};
