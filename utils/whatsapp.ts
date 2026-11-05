import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SalesInvoice, Purchase } from '../types';
import {
  getSalesInvoiceHtml,
  getPurchaseInvoiceHtml,
  getLedgerHtml,
  getConsolidatedLedgerHtml
} from './printTemplates';

/**
 * Sanitizes Arabic names and strings into safe, valid filenames:
 * - Normalizes Unicode (NFC)
 * - Removes Arabic diacritics / tashkeel and tatweel
 * - Replaces unsupported file system symbols (\ / : * ? " < > | # % & { } $ ! ' ` + = ~ @ ; , .) with spaces
 * - Replaces spaces and multiple separators with underscores '_'
 * - Avoids corrupted characters (mojibake) in WhatsApp and all browsers
 * Example: 'ايهاب نشات' -> 'ايهاب_نشات'
 */
export function sanitizeArabicFileName(name?: string, fallback = 'مستند'): string {
  if (!name || !name.trim()) return fallback;

  // 1. Unicode NFC normalization
  let cleaned = name.trim().normalize('NFC');

  // 2. Remove Arabic tashkeel / diacritics & tatweel
  cleaned = cleaned.replace(/[ـًٌٍَُِّْٰ۪ۭٓۨ۫۬]/g, '');

  // 3. Replace invalid file system characters with space
  cleaned = cleaned.replace(/[\/\\:*?"<>|#%&{}\\<>*?/$!'":@+`|~=^;,.\x00-\x1F\x7F]/g, ' ');

  // 4. Replace whitespace with single underscore
  cleaned = cleaned.trim().replace(/\s+/g, '_');

  // 5. Deduplicate underscores and trim trailing/leading underscores
  cleaned = cleaned.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  return cleaned || fallback;
}

/**
 * Common Arabic name dictionary for fallback/optional transliteration
 */
const ARABIC_NAME_DICTIONARY: Record<string, string> = {
  // Common Egyptian & Arabic Names
  'ايهاب': 'Ehab',
  'إيهاب': 'Ehab',
  'نشات': 'Nshat',
  'نشأت': 'Nshat',
  'رامي': 'Ramy',
  'رامى': 'Ramy',
  'الامير': 'Alamyar',
  'الأمير': 'Alamyar',
  'امير': 'Ameer',
  'أمير': 'Ameer',
  'محمد': 'Mohamed',
  'محمود': 'Mahmoud',
  'احمد': 'Ahmed',
  'أحمد': 'Ahmed',
  'علي': 'Ali',
  'على': 'Ali',
  'حسن': 'Hassan',
  'حسين': 'Hussein',
  'حمدي': 'Hamdi',
  'حمدى': 'Hamdi',
  'إبراهيم': 'Ibrahim',
  'ابراهيم': 'Ibrahim',
  'سيد': 'Sayed',
  'مصطفى': 'Mostafa',
  'مصطفي': 'Mostafa',
  'عمر': 'Omar',
  'عمرو': 'Amr',
  'خالد': 'Khaled',
  'طارق': 'Tarek',
  'عادل': 'Adel',
  'هشام': 'Hesham',
  'يوسف': 'Youssef',
  'أيمن': 'Ayman',
  'ايمن': 'Ayman',
  'كيرلس': 'Kyrillos',
  'مينا': 'Mina',
  'جورج': 'George',
  'مايكل': 'Michael',
  'بيتر': 'Peter',
  'شنودة': 'Shenouda',
  'بولا': 'Paula',
  'فادي': 'Fady',
  'سامح': 'Sameh',
  'رمزي': 'Ramzy',
  'رضا': 'Reda',
  'عصام': 'Essam',
  'جمال': 'Gamal',
  'سعيد': 'Saeed',
  'شريف': 'Sherif',
  'اشرف': 'Ashraf',
  'أشرف': 'Ashraf',
  'وليد': 'Waleed',
  'وائل': 'Wael',
  'إسلام': 'Islam',
  'اسلام': 'Islam',
  'عاطف': 'Atef',
  'هاني': 'Hany',
  'هانى': 'Hany',
  'علاء': 'Alaa',
  'باسم': 'Bassem',
  'تامر': 'Tamer',
  'مجدي': 'Magdy',
  'مجدى': 'Magdy',
  'مروان': 'Marwan',
  'ياسر': 'Yasser',
  'يحيى': 'Yehia',
  'يحيي': 'Yehia',
  'نبيل': 'Nabil',
  'سمير': 'Samir',
  'صلاح': 'Salah',
  'ممدوح': 'Mamdouh',
  'مدحت': 'Medhat',
  'شحاتة': 'Shehata',
  'شحاته': 'Shehata',
  'رمضان': 'Ramadan',
  'شعبان': 'Shaaban',
  'صبري': 'Sabry',
  'صبحي': 'Sobhy',
  'رفعت': 'Refaat',
  'سامي': 'Samy',
  'سامى': 'Samy',
  'كريم': 'Kareem',
  'فارس': 'Fares',
  'زياد': 'Ziad',
  'معتز': 'Moataz',
  'عزيز': 'Aziz',
  'فتحي': 'Fathy',
  'فتوح': 'Fatouh',
  'مبروك': 'Mabrouk',
  'شادي': 'Shady',
  'ماجد': 'Maged',
  'بهاء': 'Bahaa',
  'ضياء': 'Diaa',
  'حسام': 'Hossam',
  'محسن': 'Mohsen',
  'سليمان': 'Soliman',
  'شريفة': 'Sherifa',
  'فاطمة': 'Fatma',
  'مريم': 'Maryam',
  'سارة': 'Sara',
  'ساره': 'Sara',
  'منى': 'Mona',
  'مني': 'Mona',
  'بيشوي': 'Bishoy',
  'مكاريوس': 'Makarious',
  'ابانوب': 'Abanoub',
  'عبدالله': 'Abdallah',
  'عبدالرحمن': 'Abdelrahman',
  'عبدالعزيز': 'Abdelaziz',
  'عبدالفتاح': 'Abdelfattah',

  // Titles, Places, Business Types
  'مزرعة': 'Mazraat',
  'مزرعه': 'Mazraat',
  'البركة': 'AlBaraka',
  'البركه': 'AlBaraka',
  'بركة': 'Baraka',
  'بركه': 'Baraka',
  'شركة': 'Company',
  'شركه': 'Company',
  'مؤسسة': 'Est',
  'مؤسسه': 'Est',
  'مكتب': 'Maktab',
  'محل': 'Shop',
  'بورصة': 'Borsa',
  'بورصه': 'Borsa',
  'عميل': 'Customer',
  'مورد': 'Supplier'
};

const ARABIC_CHAR_MAP: Record<string, string> = {
  'أ': 'A', 'إ': 'E', 'آ': 'A', 'ا': 'A', 'ء': '', 'ئ': 'Y', 'ؤ': 'W',
  'ب': 'B', 'ت': 'T', 'ث': 'Th', 'ج': 'G', 'ح': 'H', 'خ': 'Kh',
  'د': 'D', 'ذ': 'Z', 'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'Sh',
  'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'A', 'غ': 'Gh',
  'ف': 'F', 'ق': 'Q', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
  'ه': 'H', 'ة': 'a', 'و': 'W', 'ي': 'Y', 'ى': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

export function sanitizeNameToLatin(name?: string, fallback = 'Client'): string {
  if (!name || !name.trim()) return fallback;
  
  // 1. Remove diacritics / tashkeel
  let text = name.trim().replace(/[ـًٌٍَُِّْٰ۪ۭٓۨ۫۬]/g, '');
  
  // 2. Normalize compound "عبد ..." to single word "عبد..."
  text = text.replace(/عبد\s+/g, 'عبد');

  const words = text
    .replace(/[\s\-_/\\|:;,.*?"<>#%&{}!@+=~`^()\[\]\x00-\x1F\x7F]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) return fallback;

  const convertedWords = words.map((w) => {
    const cleanW = w.trim();
    if (ARABIC_NAME_DICTIONARY[cleanW]) return ARABIC_NAME_DICTIONARY[cleanW];
    if (/^[A-Za-z0-9]+$/.test(cleanW)) return cleanW;

    // Check if word starts with "ال" and remainder is in dictionary
    if (cleanW.startsWith('ال') && cleanW.length > 2) {
      const rest = cleanW.slice(2);
      if (ARABIC_NAME_DICTIONARY[rest]) {
        return 'Al' + ARABIC_NAME_DICTIONARY[rest];
      }
    }
    if ((cleanW.startsWith('الأ') || cleanW.startsWith('الإ') || cleanW.startsWith('الآ')) && cleanW.length > 3) {
      const rest = cleanW.slice(3);
      if (ARABIC_NAME_DICTIONARY[rest]) {
        return 'Al' + ARABIC_NAME_DICTIONARY[rest];
      }
    }

    let transliterated = '';
    for (let i = 0; i < cleanW.length; i++) {
      const char = cleanW[i];
      if (ARABIC_CHAR_MAP[char] !== undefined) {
        transliterated += ARABIC_CHAR_MAP[char];
      } else if (/[A-Za-z0-9]/.test(char)) {
        transliterated += char;
      }
    }
    if (transliterated.length > 0) {
      return transliterated.charAt(0).toUpperCase() + transliterated.slice(1).toLowerCase();
    }
    return '';
  }).filter(Boolean);

  const result = convertedWords
    .join('_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return result || fallback;
}

/**
 * Builds clean Latin filename for Sales Invoices:
 * Fatora_[Customer_Name]_[Invoice_ID].pdf
 * Example: Fatora_Ehab_Nshat_N013.pdf
 */
export function getSalesInvoicePdfFileName(invoice: { id: string; customerName?: string }): string {
  const safeName = sanitizeNameToLatin(invoice.customerName, 'Customer');
  const safeId = (invoice.id || 'N001').replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_');
  return `Fatora_${safeName}_${safeId}.pdf`;
}

/**
 * Builds clean Latin filename for Purchase Invoices:
 * Moshtrayat_[Supplier_Name]_[Purchase_ID].pdf
 * Example: Moshtrayat_Mazraat_AlBaraka_R001.pdf
 */
export function getPurchaseInvoicePdfFileName(purchase: { id: string; supplierName?: string }): string {
  const safeName = sanitizeNameToLatin(purchase.supplierName, 'Supplier');
  const safeId = (purchase.id || 'R001').replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_');
  return `Moshtrayat_${safeName}_${safeId}.pdf`;
}

/**
 * Builds clean Latin filename for Customer Statements:
 * Kashf_Hesab_[Customer_Name].pdf
 * Example: Kashf_Hesab_Ramy_Alamyar.pdf
 */
export function getCustomerStatementPdfFileName(customerName?: string): string {
  const safeName = sanitizeNameToLatin(customerName, 'Customer');
  return `Kashf_Hesab_${safeName}.pdf`;
}

/**
 * Builds clean Latin filename for Supplier Statements:
 * Kashf_Mored_[Supplier_Name].pdf
 * Example: Kashf_Mored_Mazraat_AlBaraka.pdf
 */
export function getSupplierStatementPdfFileName(supplierName?: string): string {
  const safeName = sanitizeNameToLatin(supplierName, 'Supplier');
  return `Kashf_Mored_${safeName}.pdf`;
}

/**
 * Builds clean Latin filename for Consolidated Statements:
 * Kashf_Hesab_Mogamaa_Omaala.pdf / Kashf_Hesab_Mogamaa_Mawredean.pdf / Kashf_Hesab_Mogamaa_Shamel.pdf
 */
export function getConsolidatedStatementPdfFileName(reportType: 'CUSTOMERS' | 'SUPPLIERS' | 'ALL'): string {
  if (reportType === 'CUSTOMERS') {
    return 'Kashf_Hesab_Mogamaa_Omaala.pdf';
  } else if (reportType === 'SUPPLIERS') {
    return 'Kashf_Hesab_Mogamaa_Mawredean.pdf';
  }
  return 'Kashf_Hesab_Mogamaa_Shamel.pdf';
}

/**
 * Normalizes Arabic-Indic digits to standard western numbers
 * and formats phone numbers for WhatsApp API (e.g. 01012345678 -> 201012345678).
 */
export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';

  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = phone.toString();
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(arabicDigits[i], i.toString());
  }

  cleaned = cleaned.replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Egyptian numbers formatting
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    cleaned = '2' + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '20' + cleaned;
  }

  return cleaned;
}

/**
 * Builds universal WhatsApp web/app link without mandatory text
 */
export function buildWhatsAppUrl(phone?: string, text?: string): string {
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedText = text ? encodeURIComponent(text) : '';
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}${encodedText ? `&text=${encodedText}` : ''}`;
  }
  return encodedText ? `https://api.whatsapp.com/send?text=${encodedText}` : `https://api.whatsapp.com/send`;
}

/**
 * Generates an actual PDF File object in-memory from HTML
 * using html2canvas and jsPDF with exact pixel fidelity matching invoice printout.
 */
export async function generatePdfFileFromHtml(
  htmlContent: string,
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<File> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.zIndex = '-99999';
  container.style.pointerEvents = 'none';
  container.style.width = orientation === 'landscape' ? '1080px' : '880px';
  container.style.backgroundColor = '#ffffff';
  container.style.direction = 'rtl';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, sans-serif";
  container.style.webkitFontSmoothing = 'antialiased';
  container.style.textRendering = 'optimizeLegibility';
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    // Explicitly wait for Cairo and Arabic fonts to be fully loaded
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: orientation === 'landscape' ? 1200 : 960,
      imageTimeout: 15000,
    });

    // Best-effort: Copy rendered invoice image to system clipboard
    try {
      if (typeof window !== 'undefined' && 'ClipboardItem' in window && navigator.clipboard && navigator.clipboard.write) {
        canvas.toBlob((blob) => {
          if (blob) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).catch(() => {
              // Ignore clipboard errors
            });
          }
        }, 'image/png');
      }
    } catch {
      // Ignore clipboard write errors
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    pdf.setDisplayMode(1, 'continuous', 'UseNone');

    const pageWidth = orientation === 'landscape' ? 297 : 210;
    const pageHeight = orientation === 'landscape' ? 210 : 297;

    const margin = 6;
    const printableWidth = pageWidth - (margin * 2);
    const printableHeight = pageHeight - (margin * 2);

    const imgHeight = (canvas.height * printableWidth) / canvas.width;

    if (imgHeight <= printableHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, imgHeight);
    } else {
      const scaleFactor = printableHeight / imgHeight;
      const scaledWidth = printableWidth * scaleFactor;
      const xOffset = margin + ((printableWidth - scaledWidth) / 2);
      pdf.addImage(imgData, 'JPEG', xOffset, margin, scaledWidth, printableHeight);
    }

    const pdfBlob = pdf.output('blob');
    const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    return new File([pdfBlob], safeName, { type: 'application/pdf' });
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Shares a PDF file via WhatsApp:
 * - Sends the PDF file with a short 1-line text message directly in navigator.share({ files: [file], text: '...' })
 * - Uses clean Latin filename (e.g. Fatora_Ehab_Nshat_N013.pdf).
 * - Does NOT save or download the file to the user's device.
 * - Resolves safely and swiftly without freezing the UI or getting stuck on "جاري التحويل".
 */
export async function sharePdfViaWhatsApp(options: {
  htmlContent: string;
  fileName: string;
  recipientPhone?: string;
  title: string;
  text?: string;
  orientation?: 'portrait' | 'landscape';
  cachedFile?: File | null;
  openWhatsAppTabSync?: Window | null;
}): Promise<void> {
  const {
    htmlContent,
    fileName,
    recipientPhone,
    title,
    text,
    orientation = 'portrait',
    cachedFile,
    openWhatsAppTabSync
  } = options;

  // Use preloaded file or generate in-memory without saving to disk
  const file = cachedFile || (await generatePdfFileFromHtml(htmlContent, fileName, orientation));
  const waUrl = buildWhatsAppUrl(recipientPhone, text);

  // 1. Try Native Web Share API (Mobile / Tablet / supported platforms)
  // Sends the PDF file with short 1-line text message directly
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  ) {
    try {
      const shareData: ShareData = {
        files: [file],
        title: title || file.name.replace(/\.pdf$/i, ''),
      };
      if (text) {
        shareData.text = text;
      }

      if (navigator.canShare(shareData) || navigator.canShare({ files: [file] })) {
        if (openWhatsAppTabSync && !openWhatsAppTabSync.closed) {
          openWhatsAppTabSync.close();
        }

        // Race navigator.share with a safety timeout and window focus/visibility listeners
        // This guarantees the UI button will NEVER get stuck in loading / "جاري التحويل",
        // even if mobile OS backgrounding or share drawer freezes the underlying Promise!
        const sharePromise = navigator.share(shareData);

        await Promise.race([
          sharePromise.catch((err: any) => {
            // Handle AbortError or cancellation silently
            if (
              err?.name === 'AbortError' ||
              err?.name === 'NotAllowedError' ||
              err?.message?.includes?.('AbortError') ||
              err?.message?.includes?.('canceled') ||
              err?.message?.includes?.('cancelled')
            ) {
              return 'aborted';
            }
            throw err;
          }),
          new Promise<void>((resolve) => {
            const onReturn = () => {
              window.removeEventListener('focus', onReturn);
              window.removeEventListener('blur', onReturn);
              document.removeEventListener('visibilitychange', onReturn);
              resolve();
            };
            window.addEventListener('focus', onReturn, { once: true });
            window.addEventListener('blur', onReturn, { once: true });
            document.addEventListener('visibilitychange', onReturn, { once: true });
            setTimeout(() => {
              onReturn();
            }, 2500);
          })
        ]);

        showPdfShareToast(file.name, true, false);
        return;
      }
    } catch (err: any) {
      if (
        err?.name === 'AbortError' ||
        err?.name === 'NotAllowedError' ||
        err?.message?.includes?.('AbortError') ||
        err?.message?.includes?.('canceled') ||
        err?.message?.includes?.('cancelled')
      ) {
        if (openWhatsAppTabSync && !openWhatsAppTabSync.closed) {
          openWhatsAppTabSync.close();
        }
        return;
      }
      console.warn('Native Web Share with files unavailable, redirecting to WhatsApp:', err);
    }
  }

  // 2. Direct Redirect to WhatsApp (Desktop / Browsers without native file sharing):
  // Redirect directly to WhatsApp without saving/downloading the file to the user's device!
  if (openWhatsAppTabSync && !openWhatsAppTabSync.closed) {
    openWhatsAppTabSync.location.href = waUrl;
  } else {
    try {
      const opened = window.open(waUrl, '_blank');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = waUrl;
      }
    } catch {
      window.location.href = waUrl;
    }
  }

  showPdfShareToast(file.name, false, true, file);
}

/**
 * Displays a non-blocking notification toast
 */
function showPdfShareToast(
  fileName: string,
  isSharedNative: boolean,
  isRedirectedWa: boolean,
  fileForManualDownload?: File
) {
  const existing = document.getElementById('pdf-share-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pdf-share-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.zIndex = '99999';
  toast.style.backgroundColor = '#064e3b';
  toast.style.color = '#ffffff';
  toast.style.padding = '14px 18px';
  toast.style.borderRadius = '14px';
  toast.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.45)';
  toast.style.direction = 'rtl';
  toast.style.fontFamily = "'Cairo', sans-serif";
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '700';
  toast.style.display = 'flex';
  toast.style.flexDirection = 'column';
  toast.style.gap = '8px';
  toast.style.maxWidth = '420px';
  toast.style.border = '1.5px solid #10b981';

  let msgHtml = '';
  if (isSharedNative) {
    msgHtml = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px;">✅</span>
        <div>
          <div>تمت مشاركة ملف الـ PDF عبر واتساب بنجاح!</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
            الملف: <strong style="color: #6ee7b7; direction: rtl; display: inline-block;">${fileName}</strong>
          </div>
          <div style="font-size: 10px; opacity: 0.8; margin-top: 1px;">تم الإرسال كملف PDF فقط بدون نصوص وبدون حفظه على جهازك.</div>
        </div>
      </div>
    `;
  } else if (isRedirectedWa) {
    msgHtml = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px;">💬</span>
        <div>
          <div>تم فتح محادثة واتساب بنجاح!</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
            الملف: <strong style="color: #6ee7b7; direction: rtl; display: inline-block;">${fileName}</strong>
          </div>
          <div style="font-size: 10px; opacity: 0.85; margin-top: 2px;">
            يمكنك إرفاق الملف فوراً في المحادثة، أو الضغط على <strong style="color: #6ee7b7; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 4px;">Ctrl + V</strong> للصق صورة الفاتورة مباشرة.
          </div>
        </div>
      </div>
    `;
  }

  toast.innerHTML = msgHtml;

  // Optional manual download button for desktop if user explicitly wants to save
  if (fileForManualDownload) {
    const downloadRow = document.createElement('div');
    downloadRow.style.display = 'flex';
    downloadRow.style.justifyContent = 'flex-end';
    downloadRow.style.marginTop = '4px';

    const dlBtn = document.createElement('button');
    dlBtn.innerText = '💾 حفظ نسخة PDF على جهازي (اختياري)';
    dlBtn.style.background = 'rgba(255, 255, 255, 0.15)';
    dlBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    dlBtn.style.color = '#ffffff';
    dlBtn.style.padding = '4px 10px';
    dlBtn.style.borderRadius = '6px';
    dlBtn.style.fontSize = '11px';
    dlBtn.style.cursor = 'pointer';
    dlBtn.style.fontFamily = "'Cairo', sans-serif";

    dlBtn.onclick = () => {
      const u = URL.createObjectURL(fileForManualDownload);
      const a = document.createElement('a');
      a.href = u;
      a.download = fileForManualDownload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(u);
      dlBtn.innerText = 'تم التنزيل بنجاح ✓';
      dlBtn.disabled = true;
    };

    downloadRow.appendChild(dlBtn);
    toast.appendChild(downloadRow);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

/**
 * Share Sales Invoice directly as PDF via WhatsApp
 * Example filename: Fatora_Ehab_Nshat_N013.pdf
 * Text message: فاتورة مبيعات - [اسم_العميل]
 */
export async function shareSalesInvoicePdfViaWhatsApp(
  invoice: SalesInvoice,
  companyLogo?: string,
  customerPhone?: string,
  cachedFile?: File | null,
  openWhatsAppTabSync?: Window | null
): Promise<void> {
  const html = getSalesInvoiceHtml(invoice, companyLogo);
  const fileName = getSalesInvoicePdfFileName(invoice);
  const phone = customerPhone || invoice.customerPhone;
  const clientName = invoice.customerName?.trim() || 'عميل';
  const textMessage = `فاتورة مبيعات - ${clientName}`;

  await sharePdfViaWhatsApp({
    htmlContent: html,
    fileName,
    recipientPhone: phone,
    title: `فاتورة #${invoice.id} - ${clientName}`,
    text: textMessage,
    cachedFile,
    openWhatsAppTabSync
  });
}

/**
 * Share Purchase Invoice directly as PDF via WhatsApp
 * Example filename: Moshtrayat_Mazraat_AlBaraka_R001.pdf
 * Text message: فاتورة مشتريات - [اسم_المورد]
 */
export async function sharePurchaseInvoicePdfViaWhatsApp(
  purchase: Purchase,
  companyLogo?: string,
  supplierPhone?: string,
  cachedFile?: File | null,
  openWhatsAppTabSync?: Window | null
): Promise<void> {
  const html = getPurchaseInvoiceHtml(purchase, companyLogo);
  const fileName = getPurchaseInvoicePdfFileName(purchase);
  const phone = supplierPhone || purchase.supplierPhone;
  const supplierName = purchase.supplierName?.trim() || 'مورد';
  const textMessage = `فاتورة مشتريات - ${supplierName}`;

  await sharePdfViaWhatsApp({
    htmlContent: html,
    fileName,
    recipientPhone: phone,
    title: `فاتورة مشتريات #${purchase.id} - ${supplierName}`,
    text: textMessage,
    cachedFile,
    openWhatsAppTabSync
  });
}

/**
 * Share Customer Statement directly as PDF via WhatsApp
 * Example filename: Kashf_Hesab_Ramy_Alamyar.pdf
 * Text message: كشف حساب عميل - [اسم_العميل]
 */
export async function shareCustomerStatementPdfViaWhatsApp(
  options: {
    title: string;
    entityName: string;
    entityCode: string;
    entityPhone?: string;
    rows: Array<any>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    dateRange?: { from?: string; to?: string };
  },
  companyLogo?: string,
  cachedFile?: File | null,
  openWhatsAppTabSync?: Window | null
): Promise<void> {
  const html = getLedgerHtml({
    ...options,
    type: 'CUSTOMER'
  }, companyLogo);

  const fileName = getCustomerStatementPdfFileName(options.entityName);
  const clientName = options.entityName?.trim() || 'عميل';
  const textMessage = `كشف حساب عميل - ${clientName}`;

  await sharePdfViaWhatsApp({
    htmlContent: html,
    fileName,
    recipientPhone: options.entityPhone,
    title: `كشف حساب عميل - ${clientName}`,
    text: textMessage,
    cachedFile,
    openWhatsAppTabSync
  });
}

/**
 * Share Supplier Statement directly as PDF via WhatsApp
 * Example filename: Kashf_Mored_Mazraat_AlBaraka.pdf
 * Text message: كشف حساب مورد - [اسم_المورد]
 */
export async function shareSupplierStatementPdfViaWhatsApp(
  options: {
    title?: string;
    entityName?: string;
    entityCode?: string;
    entityPhone?: string;
    supplierName?: string;
    supplierCode?: string;
    supplierPhone?: string;
    rows: Array<any>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    dateRange?: { from?: string; to?: string };
  },
  companyLogo?: string,
  cachedFile?: File | null,
  openWhatsAppTabSync?: Window | null
): Promise<void> {
  const name = (options.entityName || options.supplierName || 'مورد').trim();
  const code = options.entityCode || options.supplierCode || '-';
  const phone = options.entityPhone || options.supplierPhone;

  const html = getLedgerHtml({
    ...options,
    entityName: name,
    entityCode: code,
    entityPhone: phone,
    title: options.title || `كشف حساب مورد - ${name}`,
    type: 'SUPPLIER'
  }, companyLogo);

  const fileName = getSupplierStatementPdfFileName(name);
  const textMessage = `كشف حساب مورد - ${name}`;

  await sharePdfViaWhatsApp({
    htmlContent: html,
    fileName,
    recipientPhone: phone,
    title: `كشف حساب مورد - ${name}`,
    text: textMessage,
    cachedFile,
    openWhatsAppTabSync
  });
}

/**
 * Share Consolidated Statement directly as PDF via WhatsApp
 * Example filename: Kashf_Hesab_Mogamaa_Omaala.pdf
 * Text message: كشف حساب مجمع - عملاء / موردين / شامل
 */
export async function shareConsolidatedStatementPdfViaWhatsApp(
  options: {
    title: string;
    reportType: 'CUSTOMERS' | 'SUPPLIERS' | 'ALL';
    dateRange?: { from?: string; to?: string };
    mode: 'BALANCES' | 'MOVEMENTS';
    balanceRows?: Array<any>;
    movementRows?: Array<any>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
  },
  companyLogo?: string,
  cachedFile?: File | null,
  openWhatsAppTabSync?: Window | null
): Promise<void> {
  const html = getConsolidatedLedgerHtml(options, companyLogo);
  const fileName = getConsolidatedStatementPdfFileName(options.reportType);
  const textMessage = options.reportType === 'CUSTOMERS'
    ? 'كشف حساب مجمع - عملاء'
    : options.reportType === 'SUPPLIERS'
      ? 'كشف حساب مجمع - موردين'
      : 'كشف حساب مجمع - شامل';

  await sharePdfViaWhatsApp({
    htmlContent: html,
    fileName,
    title: options.title,
    text: textMessage,
    orientation: options.mode === 'MOVEMENTS' ? 'landscape' : 'portrait',
    cachedFile,
    openWhatsAppTabSync
  });
}
