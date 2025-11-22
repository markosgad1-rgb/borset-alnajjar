
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { LogIn, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useERP();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(username, password);
    if (!success) {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 bg-brand-600 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">بورصة النجار</h1>
          <p className="text-brand-100">نظام إدارة المبيعات والمخازن</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستخدم</label>
              <input 
                type="text" 
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور</label>
              <input 
                type="password" 
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              <LogIn size={20} /> تسجيل الدخول
            </button>
          </form>
        </div>
        
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 border-t">
           جميع الحقوق محفوظة © بورصة النجار
        </div>
      </div>
    </div>
  );
};
