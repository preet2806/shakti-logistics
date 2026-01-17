
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, MapPin, Archive, RotateCcw } from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { Supplier, Customer } from '../types.ts';

export const LocationMaster: React.FC = () => {
  const { suppliers, customers, addSupplier, updateSupplier, deleteSupplier, addCustomer, updateCustomer, deleteCustomer, currentUser } = useGlobalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'SUPPLIER' | 'CUSTOMER'>('SUPPLIER');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);

  const list = useMemo(() => activeTab === 'SUPPLIER' ? suppliers : customers, [activeTab, suppliers, customers]);
  const filteredList = useMemo(() => {
    return list
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(item => item.isOperational === !showArchived);
  }, [list, searchTerm, showArchived]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setAddress(item.address);
      setLat(item.lat);
      setLng(item.lng);
    } else {
      setEditingItem(null);
      setName('');
      setAddress('');
      setLat(0);
      setLng(0);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      id: editingItem?.id || crypto.randomUUID(),
      name,
      address,
      lat,
      lng,
      isOperational: editingItem ? editingItem.isOperational : true
    };

    if (activeTab === 'SUPPLIER') {
      if (editingItem) updateSupplier(data);
      else addSupplier(data);
    } else {
      if (editingItem) updateCustomer(data);
      else addCustomer(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (item: any) => {
    if (window.confirm(`Mark ${item.name} as inoperational? It will remain in the database but won't appear in planning tools.`)) {
       if (activeTab === 'SUPPLIER') deleteSupplier(item.id);
       else deleteCustomer(item.id);
    }
  };

  const handleRestore = (item: any) => {
    const data = { ...item, isOperational: true };
    if (activeTab === 'SUPPLIER') updateSupplier(data);
    else updateCustomer(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Location Directory</h1>
          <p className="text-slate-500 font-medium">Manage supply points and customer delivery sites.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase text-xs tracking-widest"
        >
          <Plus size={20} /> Add New {activeTab === 'SUPPLIER' ? 'Supplier' : 'Customer'}
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {setActiveTab('SUPPLIER'); setSearchTerm('');}}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest ${activeTab === 'SUPPLIER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Suppliers
          </button>
          <button
            onClick={() => {setActiveTab('CUSTOMER'); setSearchTerm('');}}
            className={`px-6 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest ${activeTab === 'CUSTOMER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Customers
          </button>
        </div>

        <div className="flex-1 relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab.toLowerCase()}s...`}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showArchived ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          {showArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
          {showArchived ? 'View Operational' : 'View Archived'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredList.map((loc) => (
          <div key={loc.id} className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between group ${!loc.isOperational ? 'grayscale opacity-70 bg-slate-50' : ''}`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl transition-colors ${loc.isOperational ? 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500' : 'bg-slate-200 text-slate-600'}`}>
                  <MapPin size={24} />
                </div>
                <div className="flex gap-2">
                  {loc.isOperational ? (
                    <>
                      <button onClick={() => handleOpenModal(loc)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      {currentUser.role === 'ADMIN' && (
                        <button onClick={() => handleDelete(loc)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => handleRestore(loc)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">
                       <RotateCcw size={12} /> Restore Site
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-black text-slate-800 text-lg mb-1 uppercase tracking-tight">{loc.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4 font-medium">{loc.address}</p>
            </div>
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>GPS Coordinates</span>
              <span className="text-slate-600">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
            </div>
          </div>
        ))}
      </div>

      {filteredList.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No {showArchived ? 'archived' : 'active'} {activeTab.toLowerCase()}s found.</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingItem ? `Modify ${activeTab}` : `New ${activeTab}`}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Location Identity</label>
                <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold" placeholder="Business Name" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Physical Address</label>
                <textarea required value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold" rows={3} placeholder="Full postal address" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Latitude</label>
                  <input required value={lat} onChange={e => setLat(Number(e.target.value))} type="number" step="0.000001" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Longitude</label>
                  <input required value={lng} onChange={e => setLng(Number(e.target.value))} type="number" step="0.000001" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold" />
                </div>
              </div>
              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-black text-slate-500 text-[10px] uppercase tracking-widest hover:text-slate-700">Cancel</button>
                <button type="submit" className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg flex items-center gap-2 text-[10px] uppercase tracking-widest hover:bg-black transition-all">
                  <Save size={18} /> Authorize Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
