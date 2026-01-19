import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  Save,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';

export const Profile: React.FC = () => {
  const { currentUser, updateUser } = useGlobalStore();

  const [name, setName] = useState(currentUser?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  if (!currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ text: "Passphrases do not match.", type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUser({
        ...currentUser,
        name,
        password: newPassword || currentUser.password
      });
      setMessage({ text: "Profile credentials updated successfully.", type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ text: "Failed to update credentials. Please try again.", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-6 bg-slate-900 text-blue-500 rounded-[2.5rem] shadow-2xl mb-2">
          <ShieldCheck size={48} />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Account Security</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Manage your credentials</p>
        </div>
      </header>

      <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-12 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-slate-400 shadow-sm">
                 <UserIcon size={32} />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Identity</p>
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentUser.name}</h2>
              </div>
           </div>
           <div className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-blue-600/20">
              {currentUser.role}
           </div>
        </div>

        <form onSubmit={handleSubmit} className="p-12 space-y-10">
          {message && (
            <div className={`p-6 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
              {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              <p className="text-xs font-black uppercase tracking-widest leading-relaxed">{message.text}</p>
            </div>
          )}

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Display Name</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Key size={12} className="text-blue-500" /> New Passphrase
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-14 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all placeholder:font-medium placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Passphrase</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Verify new passphrase"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all placeholder:font-medium placeholder:text-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 bg-slate-900 text-white font-black rounded-3xl shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs disabled:opacity-50 group"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="group-hover:scale-110 transition-transform" />}
              Authorize Profile Update
            </button>
          </div>
        </form>
      </div>

      <div className="text-center p-10 bg-blue-50/50 rounded-[3rem] border border-blue-100/50">
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] leading-relaxed">
          Operational Security Warning:
          Always use high-entropy passphrases.
        </p>
      </div>
    </div>
  );
};
