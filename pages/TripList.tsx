
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Calendar, Truck, CheckCircle2,
  MapPin, AlertCircle, X, ChevronRight, Navigation, Edit2, Lock, AlertTriangle, Route as RouteIcon, Info, Droplets, Save, FileText, Hash, Ruler, Receipt, MessageSquare, Loader2
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { TripStatus, BLOCKING_STATUSES, Trip, UnloadStop } from '../types.ts';
import { STATUS_COLORS } from '../constants.tsx';
import { formatKm, formatLiters, getNextTripStatus, formatKg } from '../utils/helpers.ts';

interface ActionModalProps {
  type: 'CHALLAN' | 'DECANTING' | 'REMARK';
  title: string;
  onConfirm: (val: string | number) => void;
  onClose: () => void;
  defaultValue?: string | number;
  customerName?: string;
}

const ActionModal: React.FC<ActionModalProps> = ({ type, title, onConfirm, onClose, defaultValue, customerName }) => {
  const [value, setValue] = useState<string | number>(defaultValue || '');

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-md shadow-3xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-10 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{title}</h2>
          {customerName && <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-3 flex items-center gap-2">
            <MapPin size={12} /> Target: {customerName}
          </p>}
        </div>
        <div className="p-10 space-y-8">
          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
               {type === 'CHALLAN' ? 'Dispatch Reference' : type === 'DECANTING' ? 'Weightment Record' : 'Operational Note'}
             </label>
             <div className="relative">
               {type === 'CHALLAN' ? <Hash size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" /> :
                type === 'DECANTING' ? <Ruler size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" /> :
                <FileText size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />}

               <input
                 autoFocus
                 type={type === 'DECANTING' ? 'number' : 'text'}
                 step={type === 'DECANTING' ? '1' : undefined}
                 value={value}
                 onChange={e => setValue(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-6 py-5 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                 placeholder={type === 'CHALLAN' ? "Enter Challan No..." : type === 'DECANTING' ? "Actual kg..." : "Type remarks..."}
               />
               {type === 'DECANTING' && <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-[10px] text-slate-400 uppercase">kg</span>}
             </div>
          </div>

          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 py-5 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-colors">Abort</button>
            <button
              onClick={() => onConfirm(value)}
              className="flex-2 py-5 px-10 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
            >
              <Save size={16} /> Finalize Action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TripList: React.FC = () => {
  const navigate = useNavigate();
  const { trips, tankers, suppliers, customers, updateTrip, getTripExpenses } = useGlobalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [processingTripId, setProcessingTripId] = useState<string | null>(null);

  const [actionData, setActionData] = useState<{
    tripId: string;
    newStatus: TripStatus;
    type: 'CHALLAN' | 'DECANTING' | 'REMARK';
    stopIndex?: number;
    title: string;
    customerName?: string;
    initialValue?: string | number;
  } | null>(null);

  const filteredTrips = trips.filter(t => {
    const tanker = tankers.find(v => v.id === t.tankerId);
    const matchesSearch = tanker?.number.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (tripId: string, newStatus: TripStatus) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    const tanker = tankers.find(v => v.id === trip.tankerId);
    if (newStatus === TripStatus.TRANSIT_TO_SUPPLIER || newStatus === TripStatus.LOADED_AT_SUPPLIER) {
      if (tanker?.status === 'BREAKDOWN') { alert(`CRITICAL ALERT: Tanker ${tanker.number} is in BREAKDOWN.`); return; }
      if (tanker?.status === 'ON_TRIP' && trip.status === TripStatus.PLANNED) { alert(`CONFLICT: Tanker already out ON TRIP.`); return; }
    }

    const pendingStopIdx = trip.unloads.findIndex(u => !u.unloadedAt);
    if (newStatus === TripStatus.IN_TRANSIT) {
       if (pendingStopIdx === -1) {
         // If no next destination is set or manifest is empty, take them to the edit page
         navigate(`/trips/${tripId}`);
         return;
       }
       const cust = customers.find(c => c.id === trip.unloads[pendingStopIdx].customerId);
       setActionData({
         tripId, newStatus, type: 'CHALLAN', stopIndex: pendingStopIdx,
         title: 'Capture Challan Number', customerName: cust?.name
       });
       return;
    }

    if (newStatus === TripStatus.PARTIALLY_UNLOADED) {
       if (pendingStopIdx === -1) {
         // Consistency fix: if trying to unload but manifest is exhausted, edit the trip
         navigate(`/trips/${tripId}`);
         return;
       }
       const cust = customers.find(c => c.id === trip.unloads[pendingStopIdx].customerId);
       setActionData({
          tripId, newStatus, type: 'DECANTING', stopIndex: pendingStopIdx,
          title: 'Capture Actual Decanting', customerName: cust?.name,
          initialValue: Math.round((trip.unloads[pendingStopIdx].quantityMT || 0) * 1000)
       });
       return;
    }

    setProcessingTripId(tripId);
    try {
      await updateTrip({ ...trip, status: newStatus });
    } catch (err: any) {
      alert(err);
    } finally {
      setProcessingTripId(null);
    }
  };

  const handleCapturedIntelligence = async (val: string | number) => {
    if (!actionData) return;
    const trip = trips.find(t => t.id === actionData.tripId);
    if (!trip) return;

    setProcessingTripId(trip.id);
    try {
      if (actionData.type === 'REMARK') {
         await updateTrip({ ...trip, remarks: String(val) });
      } else {
         const updatedUnloads = [...trip.unloads];
         const idx = actionData.stopIndex!;
         if (actionData.type === 'CHALLAN') updatedUnloads[idx] = { ...updatedUnloads[idx], challanNumber: String(val) };
         else if (actionData.type === 'DECANTING') updatedUnloads[idx] = { ...updatedUnloads[idx], actualQuantityMT: Number(val) / 1000, unloadedAt: new Date().toISOString() };
         await updateTrip({ ...trip, status: actionData.newStatus, unloads: updatedUnloads });
      }
    } catch (err: any) {
      alert("Failed to finalize action.");
    } finally {
      setProcessingTripId(null);
      setActionData(null);
    }
  };

  return (
    <div className="space-y-6 px-2">
      {actionData && (
        <ActionModal type={actionData.type} title={actionData.title} customerName={actionData.customerName} defaultValue={actionData.initialValue} onConfirm={handleCapturedIntelligence} onClose={() => setActionData(null)} />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
            <Truck size={24} className="text-blue-600" /> Fleet Manifest
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Global Deployment Tracking Network</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm items-center">
              <Search size={16} className="ml-3 text-slate-400" />
              <input type="text" placeholder="Search..." className="pl-3 pr-4 py-2 bg-transparent outline-none text-xs font-bold w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div className="w-px h-6 bg-slate-200 mx-2"></div>
              <select className="bg-transparent pr-4 outline-none text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All Status</option>
                {Object.values(TripStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
           </div>
           <button onClick={() => navigate('/trips/new')} className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest shrink-0">
            <Plus size={18} /> New Trip
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTrips.map((trip) => {
          const tanker = tankers.find(t => t.id === trip.tankerId);
          const supplier = suppliers.find(s => s.id === trip.supplierId);
          const isProcessing = processingTripId === trip.id;
          const nextStatuses = getNextTripStatus(trip.status);
          const isFinal = trip.status === TripStatus.CLOSED || trip.status === TripStatus.CANCELLED;
          const estExp = getTripExpenses(trip);

          return (
            <div key={trip.id} className={`bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-xl ${isProcessing ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="p-5 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tanker?.status === 'BREAKDOWN' ? 'bg-rose-100 text-rose-600' : BLOCKING_STATUSES.includes(trip.status) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {tanker?.status === 'BREAKDOWN' ? <AlertTriangle size={24} /> : <Truck size={24} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight leading-none text-slate-900">{tanker?.number}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                      ID: {trip.id.slice(0, 8)} <span className="text-slate-200">•</span> {trip.plannedStartDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {!isFinal && !isProcessing && (
                     <button onClick={() => navigate(`/trips/${trip.id}`)} className="p-2.5 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                   )}
                   {isProcessing && <Loader2 className="animate-spin text-blue-600 mx-2" size={20} />}
                   <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[trip.status]}`}>
                     {trip.status.replace(/_/g, ' ')}
                   </span>
                </div>
              </div>

              <div className="flex-1 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Navigation size={14} /> Source Plant</span>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-800 uppercase truncate">{supplier?.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/30">
                        <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1"><Droplets size={10} /> Fuel Est</p>
                        <p className="text-xs font-black text-amber-700">{formatLiters(trip.dieselIssuedL || 0)}</p>
                     </div>
                     <div className="bg-emerald-50/50 border-emerald-100/30 p-4 rounded-2xl">
                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                           <Receipt size={10} /> Leg Cost
                        </p>
                        <p className="text-xs font-black text-emerald-700">₹{estExp}</p>
                     </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><RouteIcon size={14} className="text-emerald-500" /> Manifest</span>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2">
                    {trip.unloads.map((u, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border flex flex-col gap-1 ${u.unloadedAt ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center justify-between">
                          <p className={`text-[10px] font-black uppercase truncate ${u.unloadedAt ? 'text-emerald-700' : 'text-slate-700'}`}>{customers.find(c => c.id === u.customerId)?.name || '...'}</p>
                          {u.unloadedAt && <CheckCircle2 size={10} className="text-emerald-500" />}
                        </div>
                        <div className="flex justify-between text-[8px] font-bold text-slate-500">
                           <span>{formatKg(u.quantityMT)} Plan</span>
                           {u.actualQuantityMT && <span className="text-emerald-600">{formatKg(u.actualQuantityMT)} Act</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                {isFinal ? (
                  <div className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 bg-slate-100 text-slate-400 border border-slate-200">
                    Deployment {trip.status}
                  </div>
                ) : (
                  <>
                    {nextStatuses.map(next => (
                      <button
                        key={next}
                        disabled={isProcessing}
                        onClick={() => handleStatusChange(trip.id, next)}
                        className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${next === TripStatus.CLOSED ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-white hover:bg-black'}`}
                      >
                        {next === TripStatus.CLOSED ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
                        {next.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
