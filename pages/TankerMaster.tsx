
import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, Loader2, MapPin } from 'lucide-react';
// Corrected import path to include extension
import { useGlobalStore } from '../store.tsx';
import { Tanker, Product } from '../types.ts';

export const TankerMaster: React.FC = () => {
  const { tankers, suppliers, customers, addTanker, updateTanker, deleteTanker, currentUser } = useGlobalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTanker, setEditingTanker] = useState<Tanker | null>(null);

  // Form state
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState(20);
  const [dieselAvg, setDieselAvg] = useState(3.5);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [currentLocId, setCurrentLocId] = useState('');

  const allLocations = [...suppliers, ...customers];
  const filteredTankers = tankers.filter(t => t.number.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleOpenModal = (tanker?: Tanker) => {
    if (tanker) {
      setEditingTanker(tanker);
      setNumber(tanker.number);
      setCapacity(tanker.capacityMT);
      setDieselAvg(tanker.dieselAvgKmPerL);
      setSelectedProducts(tanker.compatibleProducts);
      setCurrentLocId(tanker.currentLocationId);
    } else {
      setEditingTanker(null);
      setNumber('');
      setCapacity(20);
      setDieselAvg(3.5);
      setSelectedProducts([]);
      setCurrentLocId(suppliers[0]?.id || customers[0]?.id || '');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const tankerData: Tanker = {
        id: editingTanker?.id || crypto.randomUUID(),
        number,
        capacityMT: capacity,
        dieselAvgKmPerL: dieselAvg,
        compatibleProducts: selectedProducts,
        currentLocationId: currentLocId || (suppliers[0]?.id || customers[0]?.id || ''),
        status: editingTanker?.status || 'AVAILABLE'
      };

      if (editingTanker) {
        await updateTanker(tankerData);
      } else {
        await addTanker(tankerData);
      }
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProduct = (p: Product) => {
    setSelectedProducts(prev => 
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Tanker Fleet Master</h1>
          <p className="text-slate-500 font-medium">Manage vehicle details, efficiency, and current location.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase text-xs tracking-widest"
        >
          <Plus size={20} /> Add New Tanker
        </button>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by tanker number..." 
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanker No.</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Location</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacity</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Products</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTankers.map((t) => {
              const location = allLocations.find(l => l.id === t.currentLocationId);
              return (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-5 font-black text-slate-800">{t.number}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase truncate max-w-[200px]">
                      <MapPin size={12} className="text-blue-500 shrink-0" />
                      {location?.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-slate-600 font-bold">{t.capacityMT} MT</td>
                  <td className="px-8 py-5 text-slate-600 font-bold">{t.dieselAvgKmPerL} KM/L</td>
                  <td className="px-8 py-5">
                    <div className="flex gap-1 flex-wrap">
                      {t.compatibleProducts.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded uppercase tracking-tighter">
                          {p.split(' ')[1]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right space-x-2">
                    <button onClick={() => handleOpenModal(t)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit2 size={18} />
                    </button>
                    {currentUser.role === 'ADMIN' && (
                      <button onClick={() => {if(window.confirm('Delete tanker?')) deleteTanker(t.id)}} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredTankers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                   No tankers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingTanker ? 'Modify Fleet Asset' : 'New Fleet Asset'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration Number</label>
                  <input required value={number} onChange={e => setNumber(e.target.value)} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="e.g. HR-55-A-1234" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payload (MT)</label>
                  <input required value={capacity} onChange={e => setCapacity(Number(e.target.value))} type="number" step="0.1" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Avg KM/L</label>
                  <input required value={dieselAvg} onChange={e => setDieselAvg(Number(e.target.value))} type="number" step="0.1" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Base / Location</label>
                <div className="relative">
                  <select 
                    value={currentLocId} 
                    onChange={e => setCurrentLocId(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none appearance-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                    required
                  >
                    <optgroup label="Suppliers">
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} (Supplier)</option>)}
                    </optgroup>
                    <optgroup label="Customers">
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} (Customer)</option>)}
                    </optgroup>
                  </select>
                  <X size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-45 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gas Compatibility</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.values(Product).map(p => (
                    <button 
                      key={p} 
                      type="button" 
                      onClick={() => toggleProduct(p)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${selectedProducts.includes(p) ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {p.split(' ')[1]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] hover:text-slate-600">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center gap-3 uppercase tracking-widest text-[10px] disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingTanker ? 'Update Asset' : 'Authorize Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
