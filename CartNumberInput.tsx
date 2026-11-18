import React, { useState, useEffect } from 'react';

// حقل رقم داخل سلة الفاتورة: يسمح بالكتابة الحرة ويثبّت القيمة الصحيحة عند الخروج.
// onCommit يرجع false لو القيمة مرفوضة (مثلاً أكبر من رصيد المخزن) فيتلوّن الحقل بالأحمر ولا تتغير الفاتورة.
export const CartNumberInput: React.FC<{
  value: number;
  onCommit: (v: number) => boolean;
  readOnly?: boolean;
  allowZero?: boolean;
  className?: string;
  title?: string;
}> = ({ value, onCommit, readOnly, allowZero, className = '', title }) => {
  const [text, setText] = useState<string>(String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(String(value)); setBad(false); }, [value]);
  const handle = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setText(cleaned);
    const n = parseFloat(cleaned);
    if (!isFinite(n) || n < 0 || (n === 0 && !allowZero)) { setBad(true); return; }
    setBad(!onCommit(n));
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      readOnly={readOnly}
      title={title}
      onFocus={e => e.target.select()}
      onChange={e => !readOnly && handle(e.target.value)}
      onBlur={() => { setText(String(value)); setBad(false); }}
      className={`${className} border rounded p-1 text-center font-bold outline-none focus:ring-1 focus:ring-brand-500 ${bad ? 'border-red-500 bg-red-50 text-red-600' : readOnly ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-white border-gray-300'}`}
      dir="ltr"
    />
  );
};
