
import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, Shield, User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { User, UserRole } from '../types.ts';

export const UserMaster: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useGlobalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('OPERATOR');

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] p-10 text-center">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mb-6 border-2 border-rose-100">
           <Shield size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Security Violation</h2>
        <p className="text-slate-500 font-medium max-w-sm">Unauthorized access. Administrative clearance is required to manage system credentials.</p>
      </div>
    );
  }

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setName(user.name);
      setPassword(user.password || '');
      setRole(user.role);
    } else {
      setEditingUser(null);
      setName('');
      setPassword('');
      setRole('OPERATOR');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userData: User = {
      id: editingUser?.id || crypto.randomUUID(),
      name,
      role,
      password
    };

    if (editingUser) updateUser(userData);
    else addUser(userData);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Credentials Matrix</h1>
          <p className="text-slate-500 font-medium">Manage operational access and administrative roles.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-4 px-8 py-5 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest"
        >
          <Plus size={20} /> Provision New Account
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Filter identity by name..." 
            className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-blue-600/5 transition-all font-bold text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredUsers.map((u) => (
          <div key={u.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all flex flex-col items-center text-center group relative overflow-hidden">
            {u.role === 'ADMIN' && (
              <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
                <Shield size={120} />
              </div>
            )}
            
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 transition-transform group-hover:scale-110 relative z-10 ${u.role === 'ADMIN' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
              {u.role === 'ADMIN' ? <Shield size={36} /> : <UserIcon size={36} />}
            </div>
            
            <h3 className="font-black text-slate-900 text-xl mb-1 uppercase tracking-tight">{u.name}</h3>
            <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 ${u.role === 'ADMIN' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {u.role}
            </span>

            <div className="w-full pt-8 border-t border-slate-50 flex justify-center gap-8">
              <button onClick={() => handleOpenModal(u)} className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:text-blue-800 transition-colors">
                <Edit2 size={16} /> Modify
              </button>
              {u.id !== currentUser.id && (
                <button onClick={() => { if(window.confirm('Revoke access for this account?')) deleteUser(u.id) }} className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] hover:text-rose-700 transition-colors">
                  <Trash2 size={16} /> Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-md shadow-3xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingUser ? 'Update Profile' : 'Provision Account'}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identity Access Management</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity Name</label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="John Doe" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Security Passphrase</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    type={showPassword ? 'text' : 'password'} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-16 py-5 font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" 
                    placeholder="••••••••" 
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-center block">Security Level</label>
                <div className="grid grid-cols-2 gap-4">
                  {(['ADMIN', 'OPERATOR'] as UserRole[]).map(r => (
                    <button 
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-5 rounded-2xl text-[10px] font-black border transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3 ${role === r ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {r === 'ADMIN' ? <Shield size={14} /> : <UserIcon size={14} />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button type="submit" className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs hover:bg-blue-700 transition-all active:scale-95">
                  <Save size={20} /> {editingUser ? 'Finalize Changes' : 'Commit Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
