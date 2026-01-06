
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Calendar, Truck, ArrowRight, CheckCircle2,
  Droplets, MapPin, Fuel, AlertCircle, X, Save, Trash2, ChevronRight, Navigation, Edit2, Lock, AlertTriangle
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { TripStatus, BLOCKING_STATUSES, UnloadStop, Trip } from '../types.ts';
import { STATUS_COLORS } from '../constants.tsx';
import { formatMT, getNextTripStatus, formatKm, formatLiters, calculateDistance } from '../utils/helpers.ts';

export const TripList: React.FC = () => {
  const navigate = useNavigate();
  const { trips, tankers, suppliers, customers, updateTrip, getActiveTripForTanker } = useGlobalStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  const allLocations = [...suppliers, ...customers];

  const filteredTrips = trips.filter(t => {
    const tanker = tankers.find(v => v.id === t.tankerId);
    const matchesSearch = tanker?.number.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isFinalStatus = (status: TripStatus) => status === TripStatus.CLOSED || status === TripStatus.CANCELLED;

  const handleStatusChange = (tripId: string, newStatus: TripStatus) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    const tanker = tankers.find(v => v.id === trip.tankerId);
    
    // VALIDATION: STARTING A TRIP (LOADED)
    if (newStatus === TripStatus.LOADED_AT_SUPPLIER) {
      // 1. Check for Breakdown
      if (tanker?.status === 'BREAKDOWN') {
        alert(`CRITICAL ALERT: Tanker ${tanker.number} is currently marked as BREAKDOWN. You cannot start a trip with a non-operational vehicle.`);
        return;
      }

      // 2. Check for "On Trip" (Already busy)
      if (tanker?.status === 'ON_TRIP') {
        const activeTrip = getActiveTripForTanker(trip.tankerId);
        alert(`OPERATIONAL CONFLICT: Tanker ${tanker.number} is already out ON TRIP ${activeTrip ? `(#${activeTrip.id.slice(0, 8)})` : ''}. A tanker must be AVAILABLE before it can be loaded for a new deployment.`);
        return;
      }

      // 3. Robust secondary check via trip registry
      const activeTrip = getActiveTripForTanker(trip.tankerId);
      if (activeTrip && activeTrip.id !== trip.id) {
        alert(`CONFLICT: Tanker ${tanker?.number} is already associated with an active deployment (#${activeTrip.id.slice(0, 8)}).`);
        return;
      }
    }

    // GENERAL BREAKDOWN CHECK: Suspend all non-closing updates if broken
    if (tanker?.status === 'BREAKDOWN' && !isFinalStatus(newStatus)) {
      alert(`ASSET GROUNDED: Tanker ${tanker.number} is offline for breakdown. Status updates are suspended.`);
      return;
    }

    if (BLOCKING_STATUSES.includes(newStatus)) {
      const active = getActiveTripForTanker(trip.tankerId);
      if (active && active.id !== trip.id) {
        alert(`Tanker is currently on active trip #${active.id.slice(0, 8)}. Cannot activate.`);
        return;
      }
    }

    if ((newStatus === TripStatus.IN_TRANSIT || newStatus === TripStatus.PARTIALLY_UNLOADED) && trip.unloads.length === 0) {
      alert("A delivery route must be configured before this action.");
      navigate(`/trips/${trip.id}`);
      return;
    }

    if (newStatus === TripStatus.PARTIALLY_UNLOADED) {
      const nextStopIdx = trip.unloads.findIndex(u => !u.unloadedAt);
      
      if (nextStopIdx === -1) {
        const confirmEdit = window.confirm("All planned stops for this trip are complete. Would you like to add more delivery stops to this trip?");
        if (confirmEdit) {
          navigate(`/trips/${trip.id}`);
        }
        return;
      }
      
      const updatedUnloads = [...trip.unloads];
      updatedUnloads[nextStopIdx] = { 
        ...updatedUnloads[nextStopIdx], 
        unloadedAt: new Date().toISOString() 
      };
      
      updateTrip({ ...trip, status: newStatus, unloads: updatedUnloads });
      return;
    }

    if (newStatus === TripStatus.CLOSED && trip.unloads.length === 0) {
      alert("Please add delivery destinations before closing the trip.");
      navigate(`/trips/${trip.id}`);
      return;
    }

    updateTrip({ ...trip, status: newStatus });
  };

  const handleManageStops = (trip: Trip) => {
    if (isFinalStatus(trip.status)) {
      return;
    }
    navigate(`/trips/${trip.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Fleet Command</h1>
          <p className="text-slate-500 font-medium">Real-time status updates and delivery tracking.</p>
        </div>
        <button onClick={() => navigate('/trips/new')} className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">
          <Plus size={18} /> New Trip Plan
        </button>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search by Tanker # or ID..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 transition-all font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <select className="bg-slate-50 border border-slate-200 rounded-2xl px-8 py-4 outline-none font-bold text-slate-600 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {Object.values(TripStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {filteredTrips.map((trip) => {
          const tanker = tankers.find(t => t.id === trip.tankerId);
          const supplier = suppliers.find(s => s.id === trip.supplierId);
          const isBlocking = BLOCKING_STATUSES.includes(trip.status);
          const nextStatuses = getNextTripStatus(trip.status);
          const isFinal = isFinalStatus(trip.status);
          const isBreakdown = tanker?.status === 'BREAKDOWN';
          
          const completedStops = trip.unloads.filter(u => u.unloadedAt);
          
          const reportedLocId = (() => {
            if (trip.status === TripStatus.PLANNED || trip.status === TripStatus.TENTATIVE) return tanker?.currentLocationId;
            if (trip.status === TripStatus.LOADED_AT_SUPPLIER || trip.status === TripStatus.IN_TRANSIT) return trip.supplierId;
            if (trip.status === TripStatus.PARTIALLY_UNLOADED && completedStops.length > 0) return completedStops[completedStops.length - 1].customerId;
            if (trip.status === TripStatus.CLOSED && trip.unloads.length > 0) return trip.unloads[trip.unloads.length - 1].customerId;
            return trip.supplierId;
          })();
          
          const locName = allLocations.find(l => l.id === reportedLocId)?.name || 'Processing...';

          const fuelValue = trip.dieselIssuedL > 0 
            ? formatLiters(trip.dieselIssuedL) 
            : `REQ ${Math.round(trip.totalDistanceKm / (tanker?.dieselAvgKmPerL || 3.5))}L`;

          return (
            <div key={trip.id} className={`bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-2xl ${isBlocking ? 'ring-2 ring-blue-500/10' : ''} ${isFinal ? 'grayscale-[0.5] opacity-90' : ''} ${isBreakdown ? 'ring-4 ring-rose-500/20' : ''}`}>
              <div className="p-10">
                <div className="flex flex-col lg:flex-row gap-10">
                  <div className="lg:w-1/4 space-y-6">
                    <div className="flex items-center gap-5">
                      <div className={`p-5 rounded-[2rem] ${isBlocking ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40 animate-pulse' : isFinal ? 'bg-slate-200 text-slate-400' : isBreakdown ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {isBreakdown ? <AlertTriangle size={40} /> : <Truck size={40} />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <h3 className={`text-3xl font-black tracking-tight leading-none ${isBreakdown ? 'text-rose-600' : 'text-slate-900'}`}>{tanker?.number}</h3>
                           {!isFinal && !isBreakdown && (
                             <button onClick={() => navigate(`/trips/${trip.id}`)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                               <Edit2 size={16} />
                             </button>
                           )}
                           {(isFinal || isBreakdown) && (
                             <div className="p-2 text-slate-400">
                               <Lock size={16} />
                             </div>
                           )}
                        </div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{trip.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[trip.status]}`}>
                        {trip.status.replace(/_/g, ' ')}
                      </span>
                      {isBreakdown && (
                        <span className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white animate-pulse">
                          Breakdown
                        </span>
                      )}
                    </div>
                    <div className="pt-6 space-y-4">
                      <div className="flex items-center gap-4 text-xs font-black text-slate-400">
                        <Calendar size={18} className="text-slate-300" /> {trip.plannedStartDate}
                      </div>
                      <div className={`p-5 rounded-3xl text-white shadow-lg ${isBreakdown ? 'bg-rose-900' : 'bg-slate-900'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isBreakdown ? 'text-rose-300' : 'text-slate-500'}`}>Live Activity Focus</p>
                        <div className="flex items-start gap-3">
                          <MapPin size={18} className="text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-sm font-bold truncate uppercase">{locName}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                    <div className="space-y-8">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 shrink-0">
                           <Navigation size={24} />
                        </div>
                        <div className="flex-1 border-b border-dashed border-slate-200 pb-4">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Source / Loading Plant</p>
                           <p className="text-lg font-bold text-slate-800 uppercase">{supplier?.name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-emerald-500 shrink-0">
                           <Truck size={24} />
                        </div>
                        <div className="flex-1">
                           <div className="flex items-center justify-between mb-2">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Route Progress</p>
                             {!isFinal && !isBreakdown && (
                               <button onClick={() => handleManageStops(trip)} className="text-[10px] font-black text-blue-600 bg-white px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm uppercase">
                                 Modify Sequence
                               </button>
                             )}
                           </div>
                           <div className="space-y-3">
                             {trip.unloads.length === 0 ? (
                               <div className="p-4 bg-white/50 border border-dashed border-slate-200 rounded-2xl flex items-center gap-3 text-xs font-bold text-rose-500">
                                 <AlertCircle size={16} /> Destination Manifest Required
                               </div>
                             ) : (
                               trip.unloads.map((u, i) => (
                                 <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${u.unloadedAt ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-slate-100 text-slate-600'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-3 h-3 rounded-full ${u.unloadedAt ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                      <p className="text-xs font-black uppercase">{customers.find(c => c.id === u.customerId)?.name}</p>
                                    </div>
                                    <p className="text-xs font-black">{u.quantityMT} MT</p>
                                 </div>
                               ))
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-1/4 flex flex-col justify-between gap-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-slate-900 p-5 rounded-3xl text-center shadow-lg">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Fuel Log</p>
                          <p className="text-lg font-black text-white">{fuelValue}</p>
                       </div>
                       <div className="bg-blue-600 p-5 rounded-3xl text-center shadow-lg">
                          <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Trip KM</p>
                          <p className="text-lg font-black text-white">{formatKm(trip.totalDistanceKm)}</p>
                       </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {isBreakdown ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-rose-600 font-black text-xs bg-rose-50 py-8 rounded-[1.5rem] border-2 border-rose-200 uppercase tracking-widest">
                          <AlertTriangle size={32} />
                          Asset Offline
                        </div>
                      ) : (
                        nextStatuses.map(next => (
                          <button 
                            key={next} 
                            onClick={() => handleStatusChange(trip.id, next)}
                            className={`w-full py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${next === TripStatus.CLOSED ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-600/30 hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                          >
                            {next === TripStatus.CLOSED ? <CheckCircle2 size={20} /> : <ChevronRight size={20} />}
                            Mark {next.replace(/_/g, ' ')}
                          </button>
                        ))
                      )}
                      {trip.status === TripStatus.CLOSED && (
                        <div className="flex flex-col items-center justify-center gap-2 text-emerald-600 font-black text-xs bg-emerald-50 py-8 rounded-[1.5rem] border border-emerald-100 uppercase tracking-widest">
                          <CheckCircle2 size={32} />
                          Trip Finalized
                        </div>
                      )}
                      {trip.status === TripStatus.CANCELLED && !isBreakdown && (
                        <div className="flex flex-col items-center justify-center gap-2 text-rose-600 font-black text-xs bg-rose-50 py-8 rounded-[1.5rem] border border-rose-100 uppercase tracking-widest">
                          <X size={32} />
                          Trip Cancelled
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
