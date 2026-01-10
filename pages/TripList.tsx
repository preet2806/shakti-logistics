
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Calendar, Truck, CheckCircle2,
  MapPin, AlertCircle, X, ChevronRight, Navigation, Edit2, Lock, AlertTriangle, Route as RouteIcon, Info, Droplets
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { TripStatus, BLOCKING_STATUSES, Trip } from '../types.ts';
import { STATUS_COLORS } from '../constants.tsx';
import { formatKm, formatLiters, getNextTripStatus } from '../utils/helpers.ts';

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

    if (newStatus === TripStatus.LOADED_AT_SUPPLIER) {
      if (tanker?.status === 'BREAKDOWN') {
        alert(`CRITICAL ALERT: Tanker ${tanker.number} is currently marked as BREAKDOWN.`);
        return;
      }
      if (tanker?.status === 'ON_TRIP') {
        alert(`OPERATIONAL CONFLICT: Tanker ${tanker.number} is already out ON TRIP.`);
        return;
      }
    }

    if (tanker?.status === 'BREAKDOWN' && !isFinalStatus(newStatus)) {
      alert(`ASSET GROUNDED: Tanker ${tanker.number} is offline for breakdown.`);
      return;
    }

    if (BLOCKING_STATUSES.includes(newStatus)) {
      const active = getActiveTripForTanker(trip.tankerId);
      if (active && active.id !== trip.id) {
        alert(`Tanker is currently on active trip.`);
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
        if (window.confirm("All planned stops complete. Add more?")) {
          navigate(`/trips/${trip.id}`);
        }
        return;
      }
      const updatedUnloads = [...trip.unloads];
      updatedUnloads[nextStopIdx] = { ...updatedUnloads[nextStopIdx], unloadedAt: new Date().toISOString() };
      updateTrip({ ...trip, status: newStatus, unloads: updatedUnloads });
      return;
    }

    if (newStatus === TripStatus.CLOSED && trip.unloads.length === 0) {
      alert("Please add delivery destinations before closing.");
      navigate(`/trips/${trip.id}`);
      return;
    }

    updateTrip({ ...trip, status: newStatus });
  };

  return (
    <div className="space-y-6 px-2">
      {/* Optimized Header */}
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
              <input
                type="text"
                placeholder="Search Tanker No..."
                className="pl-3 pr-4 py-2 bg-transparent outline-none text-xs font-bold w-48"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="w-px h-6 bg-slate-200 mx-2"></div>
              <select
                className="bg-transparent pr-4 outline-none text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                {Object.values(TripStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
           </div>
           <button
             onClick={() => navigate('/trips/new')}
             className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest shrink-0"
           >
            <Plus size={18} /> New Trip
          </button>
        </div>
      </div>

      {/* Balanced Density Grid - 2 columns on large screens to show full list of drops */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTrips.map((trip) => {
          const tanker = tankers.find(t => t.id === trip.tankerId);
          const supplier = suppliers.find(s => s.id === trip.supplierId);
          const isBlocking = BLOCKING_STATUSES.includes(trip.status);
          const nextStatuses = getNextTripStatus(trip.status);
          const isFinal = isFinalStatus(trip.status);
          const isBreakdown = tanker?.status === 'BREAKDOWN';

          const completedStops = trip.unloads.filter(u => u.unloadedAt);
          const totalStops = trip.unloads.length;

          const reportedLocId = (() => {
            if (trip.status === TripStatus.PLANNED || trip.status === TripStatus.TENTATIVE) return tanker?.currentLocationId;
            if (trip.status === TripStatus.LOADED_AT_SUPPLIER || trip.status === TripStatus.IN_TRANSIT) return trip.supplierId;
            if (trip.status === TripStatus.PARTIALLY_UNLOADED && completedStops.length > 0) return completedStops[completedStops.length - 1].customerId;
            if (trip.status === TripStatus.CLOSED && totalStops > 0) return trip.unloads[totalStops - 1].customerId;
            return trip.supplierId;
          })();

          const locName = allLocations.find(l => l.id === reportedLocId)?.name || 'Processing...';
          const fuelValue = trip.dieselIssuedL > 0
            ? formatLiters(trip.dieselIssuedL)
            : `${Math.round(trip.totalDistanceKm / (tanker?.dieselAvgKmPerL || 3.5))}L`;

          return (
            <div key={trip.id} className={`bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-xl ${isBlocking ? 'ring-2 ring-blue-500/10' : ''} ${isFinal ? 'grayscale-[0.4] opacity-80' : ''} ${isBreakdown ? 'ring-4 ring-rose-500/10' : ''}`}>

              {/* Card Header */}
              <div className="p-5 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isBreakdown ? 'bg-rose-100 text-rose-600' : isBlocking ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {isBreakdown ? <AlertTriangle size={24} /> : <Truck size={24} />}
                  </div>
                  <div>
                    <h3 className={`text-base font-black tracking-tight leading-none ${isBreakdown ? 'text-rose-600' : 'text-slate-900'}`}>{tanker?.number}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                      ID: {trip.id.slice(0, 8)} <span className="text-slate-200">•</span> <Calendar size={12} className="inline" /> {trip.plannedStartDate}
                    </p>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[trip.status]}`}>
                  {trip.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Routing Body */}
              <div className="flex-1 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source & Details */}
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <Navigation size={14} className="text-slate-400" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Plant</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-800 uppercase truncate">{supplier?.name}</p>
                      <p className="text-[9px] font-medium text-slate-500 truncate mt-1">{supplier?.address}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={12} className="text-blue-600" />
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Live Pos</span>
                      </div>
                      <p className="text-[11px] font-black text-slate-900 uppercase truncate max-w-[120px]">{locName}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Km</span>
                        <p className="text-xs font-black text-slate-900">{formatKm(trip.totalDistanceKm)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Fuel</span>
                        <p className="text-xs font-black text-blue-600">{fuelValue}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vertical Drops List - User requested to see all on screen */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <RouteIcon size={14} className="text-emerald-500" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Manifest</span>
                    </div>
                    {!isFinal && !isBreakdown && (
                      <button onClick={() => navigate(`/trips/${trip.id}`)} className="text-[10px] font-black text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 uppercase tracking-tighter">
                        Edit <Edit2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                    {trip.unloads.length === 0 ? (
                      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">No Drops Assigned</p>
                      </div>
                    ) : (
                      trip.unloads.map((unload, idx) => {
                        const cust = customers.find(c => c.id === unload.customerId);
                        return (
                          <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${unload.unloadedAt ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                               <div className={`w-2 h-2 rounded-full shrink-0 ${unload.unloadedAt ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 animate-pulse'}`}></div>
                               <div className="min-w-0">
                                 <p className={`text-[10px] font-black uppercase truncate ${unload.unloadedAt ? 'text-emerald-700' : 'text-slate-700'}`}>{cust?.name}</p>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase">{unload.quantityMT} MT</p>
                               </div>
                            </div>
                            {unload.unloadedAt && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer: Deployment Control */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                {isBreakdown ? (
                  <div className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                    <AlertTriangle size={16} /> Asset Grounded for Repairs
                  </div>
                ) : isFinal ? (
                  <div className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 ${trip.status === TripStatus.CLOSED ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                    {trip.status === TripStatus.CLOSED ? <CheckCircle2 size={16} /> : <X size={16} />}
                    Deployment {trip.status}
                  </div>
                ) : (
                  <>
                    {nextStatuses.length > 0 ? (
                      nextStatuses.map(next => (
                        <button
                          key={next}
                          onClick={() => handleStatusChange(trip.id, next)}
                          className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group ${next === TripStatus.CLOSED ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-black'}`}
                        >
                          {next === TripStatus.CLOSED ? <CheckCircle2 size={16} /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                          {next.replace(/_/g, ' ')}
                        </button>
                      ))
                    ) : (
                      <button onClick={() => navigate(`/trips/${trip.id}`)} className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm">
                        Manage Active Manifest
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTrips.length === 0 && (
        <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
           <div className="p-6 bg-slate-50 rounded-full w-fit mx-auto mb-6 text-slate-300">
             <Search size={48} />
           </div>
           <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No Strategic Deployments Found</h3>
           <p className="text-sm font-bold text-slate-400 uppercase mt-2 tracking-widest">Adjust your search parameters or initiate a new logistics plan.</p>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};
