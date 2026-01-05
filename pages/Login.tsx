
import React, { useState } from 'react';
// Corrected import path to include extension
import { useGlobalStore } from '../store.tsx';
import { Truck, Lock, User as UserIcon, Loader2, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useGlobalStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    
    const success = await login(name, password);
    if (!success) {
      setError('Invalid identity or passphrase. Access denied.');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/20">
          <div className="p-12 text-center bg-slate-50 border-b border-slate-100">
             <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-blue-600/30">
               <Truck size={40} />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Shakti</h1>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Logistics Command Portal</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-12 space-y-8">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3">
                <Lock size={16} /> {error}
              </div>
            )}
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Name</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Admin User"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Passphrase</label>
              <div className="relative">
                <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-6 bg-slate-900 text-white font-black rounded-[2rem] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
              Authorize Access
            </button>
          </form>
          
          <div className="p-8 text-center border-t border-slate-50">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Authorized Personnel Only • Secure Session Enabled</p>
          </div>
        </div>
      </div>
    </div>
  );
};