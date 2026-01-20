
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, ArrowDown, Receipt, Loader2, Database, MapPin } from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { RouteExpense, ExpenseItem } from '../types.ts';

export const ExpenseMaster: React.FC = () => {
  const { suppliers, customers, expenses, addExpense, updateExpense, deleteExpense, currentUser } = useGlobalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RouteExpense | null>(null);

  // Form state
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');
  const [items, setItems] = useState<ExpenseItem[]>([{ description: '', amount: 0 }]);

  const allLocations = useMemo(() => [...suppliers, ...customers], [suppliers, customers]);

  const filteredExpenses = expenses.filter(e => {
    const start = allLocations.find(l => l.id === e.startLocationId)?.name || '';
    const end = allLocations.find(l => l.id === e.endLocationId)?.name || '';
    return start.toLowerCase().includes(searchTerm.toLowerCase()) ||
           end.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleOpenModal = (expense?: RouteExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setStartId(expense.startLocationId);
      setEndId(expense.endLocationId);
      setItems([...expense.items]);
    } else {
      setEditingExpense(null);
      setStartId('');
      setEndId('');
      setItems([{ description: '', amount: 0 }]);
    }
    setIsModalOpen(true);
  };

  const addItem = () => setItems([...items, { description: '', amount: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ExpenseItem, val: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startId === endId) { alert("Start and End locations must be different."); return; }

    // Check for existing pair
    const duplicate = expenses.find(ex => ex.startLocationId === startId && ex.endLocationId === endId && ex.id !== editingExpense?.id);
    if (duplicate) {
      if (window.confirm("An expense record already exists for this route leg. Would you like to update the existing one instead?")) {
        setEditingExpense(duplicate);
        setItems([...duplicate.items]);
        return;
      }
      return;
    }

    setIsSubmitting(true);
    const total = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const data: RouteExpense = {
      id: editingExpense?.id || crypto.randomUUID(),
      startLocationId: startId,
      endLocationId: endId,
      items: items.filter(i => i.description.trim() !== ''),
      totalAmount: total
    };

    try {
      if (editingExpense) await updateExpense(data);
      else await addExpense(data);
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Route Expense Matrix</h1>
          <p className="text-slate-500 font-medium">Define standardized costs for specific transit legs.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-4 px-8 py-5 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest"
        >
          <Plus size={20} /> Define Leg Cost
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by location name..."
            className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-blue-600/5 transition-all font-bold text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredExpenses.map((ex) => {
          const start = allLocations.find(l => l.id === ex.startLocationId);
          const end = allLocations.find(l => l.id === ex.endLocationId);
          return (
            <div key={ex.id} className="bg-white rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group overflow-hidden flex flex-col">
              <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-200">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leg Rate</p>
                    <p className="text-lg font-black text-slate-900">₹{ex.totalAmount}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => handleOpenModal(ex)} className="p-2.5 bg-white text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 shadow-sm transition-all">
                      <Edit2 size={16} />
                   </button>
                   {currentUser?.role === 'ADMIN' && (
                     <button onClick={() => {if(window.confirm('Delete this rate profile?')) deleteExpense(ex.id)}} className="p-2.5 bg-white text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 shadow-sm transition-all">
                        <Trash2 size={16} />
                     </button>
                   )}
                </div>
              </div>

              <div className="p-8 flex-1 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                      <div className="w-0.5 h-8 bg-slate-100 my-1"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    </div>
                    <div className="flex-1 space-y-5">
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Origin</p>
                        <p className="text-[11px] font-black text-slate-700 uppercase leading-tight truncate">{start?.name}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Target</p>
                        <p className="text-[11px] font-black text-slate-700 uppercase leading-tight truncate">{end?.name}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-50 pt-6">
                  {ex.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      <span>{item.description}</span>
                      <span>₹{item.amount}</span>
                    </div>
                  ))}
                  {ex.items.length > 3 && (
                    <p className="text-[9px] font-black text-blue-500 uppercase text-center mt-2 tracking-widest">+ {ex.items.length - 3} more charges</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl shadow-3xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingExpense ? 'Modify Leg Rate' : 'Define Leg Rate'}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Route Expense Configuration</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-10">
              <div className="grid grid-cols-2 gap-8 items-center">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Location</label>
                    <div className="relative">
                       <MapPin size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500" />
                       <select
                         value={startId}
                         onChange={e => setStartId(e.target.value)}
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold outline-none appearance-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                         required
                       >
                         <option value="">Select point...</option>
                         {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Location</label>
                    <div className="relative">
                       <MapPin size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500" />
                       <select
                         value={endId}
                         onChange={e => setEndId(e.target.value)}
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold outline-none appearance-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                         required
                       >
                         <option value="">Select point...</option>
                         {allLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                       </select>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Expense Breakdown</h3>
                    <button type="button" onClick={addItem} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">+ Add Charge</button>
                 </div>
                 <div className="space-y-4">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-end animate-in fade-in slide-in-from-top-1">
                        <div className="flex-1 space-y-2">
                           <input
                             placeholder="Description (e.g. Toll, State Tax)"
                             value={item.description}
                             onChange={e => updateItem(idx, 'description', e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs"
                           />
                        </div>
                        <div className="w-32 space-y-2">
                           <input
                             type="number"
                             placeholder="Amount"
                             value={item.amount}
                             onChange={e => updateItem(idx, 'amount', e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-xs"
                           />
                        </div>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="p-3 text-rose-400 hover:text-rose-600 transition-colors">
                             <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                 </div>
              </div>

              <div className="p-8 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-center justify-between">
                 <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Total Leg Rate</p>
                 <p className="text-3xl font-black text-blue-600 tracking-tighter">
                   ₹{items.reduce((acc, item) => acc + Number(item.amount || 0), 0)}
                 </p>
              </div>

              <div className="pt-6">
                <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-slate-900 text-white font-black rounded-3xl shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  {editingExpense ? 'Authorize Update' : 'Commit Rate Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
