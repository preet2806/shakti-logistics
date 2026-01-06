
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import L from 'leaflet';
import { 
  Plus, Trash2, MapPin, ArrowLeft, Navigation, 
  Route as RouteIcon, Clock, Map as MapIcon, 
  ChevronRight, CheckCircle2, Info, Loader2, Droplets,
  Zap, Ruler, MousePointer2, Lock, AlertTriangle
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { Product, Trip, TripStatus, UnloadStop, RouteData, Location } from '../types.ts';
import { fetchRoutes } from '../utils/helpers.ts';

/**
 * ROBUST LOGISTICS MAP PREVIEW
 */
const InteractiveRouteMap: React.FC<{ 
  segments: { id: string, route: RouteData | null, color: string, start: Location, end: Location }[];
  activeSegmentId: string | null;
}> = ({ segments, activeSegmentId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: [21.0, 78.0],
      zoom: 5,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstance.current);
    layerGroup.current = L.layerGroup().addTo(mapInstance.current);
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

    const observer = new ResizeObserver(() => {
      mapInstance.current?.invalidateSize();
    });
    observer.observe(mapRef.current);

    return () => {
      observer.disconnect();
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !layerGroup.current) return;

    const group = layerGroup.current;
    group.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    segments.forEach((seg) => {
      const isFocused = activeSegmentId === seg.id || activeSegmentId === null;
      const opacity = isFocused ? 1.0 : 0.15;
      const weight = isFocused ? 6 : 3;

      const startPos: L.LatLngExpression = [seg.start.lat, seg.start.lng];
      const endPos: L.LatLngExpression = [seg.end.lat, seg.end.lng];
      bounds.push(startPos, endPos);

      L.circleMarker(startPos, { radius: 5, color: seg.color, fillOpacity: 1, weight: 2 }).addTo(group);
      L.circleMarker(endPos, { radius: 7, color: seg.color, fillOpacity: 1, weight: 3 }).addTo(group);

      if (seg.route?.geometry && seg.route.geometry.length > 0) {
        L.polyline(seg.route.geometry, { 
          color: seg.color, 
          weight, 
          opacity,
          dashArray: seg.id === 'leg-empty' ? '5, 10' : undefined 
        }).addTo(group);
      }
    });

    if (bounds.length > 1) {
      mapInstance.current.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], animate: true });
    }
  }, [segments, activeSegmentId]);

  return <div ref={mapRef} className="w-full h-full min-h-[400px] rounded-[2.5rem] overflow-hidden shadow-inner bg-slate-100 border border-slate-200" />;
};

export const TripForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tankers, suppliers, customers, addTrip, updateTrip, trips, currentUser } = useGlobalStore();

  const [tankerId, setTankerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState<Product>(Product.LN2);
  const [plannedStartDate, setPlannedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [unloads, setUnloads] = useState<UnloadStop[]>([]);
  const [remarks, setRemarks] = useState('');
  
  const [leg1Options, setLeg1Options] = useState<RouteData[]>([]);
  const [selectedLeg1, setSelectedLeg1] = useState<RouteData | null>(null);
  const [stopOptions, setStopOptions] = useState<Record<number, RouteData[]>>({});
  
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const existingTrip = useMemo(() => trips.find(t => t.id === id), [id, trips]);
  
  const isFinalStatus = existingTrip?.status === TripStatus.CLOSED || existingTrip?.status === TripStatus.CANCELLED;
  
  const isExecuting = existingTrip && (
    existingTrip.status === TripStatus.LOADED_AT_SUPPLIER || 
    existingTrip.status === TripStatus.IN_TRANSIT || 
    existingTrip.status === TripStatus.PARTIALLY_UNLOADED
  );

  const selectedTanker = tankers.find(t => t.id === tankerId);
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const tankerOrigin = selectedTanker 
    ? [...suppliers, ...customers].find(l => l.id === selectedTanker.currentLocationId)
    : null;

  useEffect(() => {
    if (id) {
      const existing = trips.find(t => t.id === id);
      if (existing) {
        setTankerId(existing.tankerId);
        setSupplierId(existing.supplierId);
        setProductId(existing.productId);
        setPlannedStartDate(existing.plannedStartDate);
        setUnloads(existing.unloads);
        setSelectedLeg1(existing.emptyRoute || null);
        setRemarks(existing.remarks);
      }
    }
  }, [id, trips]);

  useEffect(() => {
    async function getLeg1() {
      if (tankerOrigin && selectedSupplier && !isExecuting && !isFinalStatus) {
        setIsLoading(true);
        const routes = await fetchRoutes(tankerOrigin.lat, tankerOrigin.lng, selectedSupplier.lat, selectedSupplier.lng);
        setLeg1Options(routes);
        if (!selectedLeg1 || !routes.some(r => r.summary === selectedLeg1.summary)) {
           setSelectedLeg1(routes[0] || null);
        }
        setIsLoading(false);
      }
    }
    getLeg1();
  }, [tankerId, supplierId, isExecuting, isFinalStatus]);

  useEffect(() => {
    async function getLeg2() {
      if (!selectedSupplier || unloads.length === 0 || isFinalStatus) return;
      
      setIsLoading(true);
      const newStopOptions = { ...stopOptions };
      const updatedUnloads = [...unloads];
      let prevLoc: Location = selectedSupplier;
      let stateChanged = false;

      for (let i = 0; i < unloads.length; i++) {
        const custId = unloads[i].customerId;
        const cust = customers.find(c => c.id === custId);
        
        if (cust) {
          if (!newStopOptions[i]) {
            const routes = await fetchRoutes(prevLoc.lat, prevLoc.lng, cust.lat, cust.lng);
            newStopOptions[i] = routes;
            
            if (!unloads[i].selectedRoute && routes.length > 0) {
              updatedUnloads[i] = { ...updatedUnloads[i], selectedRoute: routes[0] };
              stateChanged = true;
            }
          }
          prevLoc = cust;
        }
      }

      if (stateChanged) setUnloads(updatedUnloads);
      setStopOptions(newStopOptions);
      setIsLoading(false);
    }
    getLeg2();
  }, [unloads.map(u => u.customerId).join(','), supplierId, isFinalStatus]);

  const mapSegments = useMemo(() => {
    const res = [];
    if (tankerOrigin && selectedSupplier) {
      res.push({ id: 'leg-empty', route: selectedLeg1, color: '#64748b', start: tankerOrigin, end: selectedSupplier });
    }
    unloads.forEach((stop, i) => {
      const prev = i === 0 ? selectedSupplier : customers.find(c => c.id === unloads[i-1].customerId);
      const curr = customers.find(c => c.id === stop.customerId);
      if (prev && curr) {
        res.push({ id: `stop-${i}`, route: stop.selectedRoute || null, color: stop.unloadedAt ? '#94a3b8' : '#2563eb', start: prev, end: curr });
      }
    });
    return res;
  }, [tankerOrigin, selectedSupplier, selectedLeg1, unloads]);

  const totalDist = useMemo(() => {
    const l1 = selectedLeg1?.distanceKm || 0;
    const l2 = unloads.reduce((acc, u) => acc + (u.selectedRoute?.distanceKm || 0), 0);
    return Number((l1 + l2).toFixed(1));
  }, [selectedLeg1, unloads]);

  const estimatedDiesel = useMemo(() => {
    if (!selectedTanker || totalDist === 0) return 0;
    return Math.round(totalDist / selectedTanker.dieselAvgKmPerL);
  }, [selectedTanker, totalDist]);

  const addUnloadStop = () => {
    if (isFinalStatus) return;
    setUnloads([...unloads, { customerId: '', quantityMT: 0 }]);
  };

  const removeUnloadStop = (i: number) => {
    if (isFinalStatus) return;
    if (unloads[i].unloadedAt) {
      alert("Historical stops that have already been unloaded cannot be removed from the manifest.");
      return;
    }
    const next = unloads.filter((_, idx) => idx !== i);
    
    // Clear stop options for indices after the removed stop
    const nextOptions = { ...stopOptions };
    for (let j = i; j <= unloads.length; j++) delete nextOptions[j];
    setStopOptions(nextOptions);
    
    setUnloads(next);
  };

  const updateUnload = (i: number, field: keyof UnloadStop, val: any) => {
    if (unloads[i].unloadedAt || isFinalStatus) return;

    const next = [...unloads];
    next[i] = { ...next[i], [field]: val };
    
    if (field === 'customerId') {
      const nextOptions = { ...stopOptions };
      for (let j = i; j < unloads.length; j++) delete nextOptions[j];
      setStopOptions(nextOptions);
    }
    setUnloads(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFinalStatus) return;
    if (!tankerId || !supplierId) return;

    const payload: Trip = {
      id: id || crypto.randomUUID(),
      tankerId,
      productId,
      supplierId,
      plannedStartDate,
      status: id ? (trips.find(t => t.id === id)?.status || TripStatus.PLANNED) : TripStatus.PLANNED,
      emptyRoute: selectedLeg1 || undefined,
      unloads,
      totalLoadedMT: unloads.reduce((acc, u) => acc + Number(u.quantityMT || 0), 0),
      dieselIssuedL: (existingTrip?.dieselIssuedL && existingTrip.dieselIssuedL > 0) ? existingTrip.dieselIssuedL : estimatedDiesel,
      dieselUsedL: existingTrip?.dieselUsedL || 0,
      emptyDistanceKm: selectedLeg1?.distanceKm || 0,
      loadedDistanceKm: unloads.reduce((acc, u) => acc + (u.selectedRoute?.distanceKm || 0), 0),
      totalDistanceKm: totalDist,
      remarks,
      createdBy: currentUser.id
    };

    if (id) updateTrip(payload);
    else addTrip(payload);

    navigate('/trips');
  };

  return (
    <div className={`max-w-[1750px] mx-auto px-4 pb-20 space-y-8 animate-in fade-in duration-500 ${isFinalStatus ? 'select-none pointer-events-none grayscale-[0.3]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-4 hover:bg-white rounded-2xl shadow-sm border border-slate-200 transition-all pointer-events-auto">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-4">
              {id ? (isFinalStatus ? 'Historical Record' : 'Refine Deployment') : 'Strategic Planning'}
              {isFinalStatus && <Lock className="text-slate-400" size={32} />}
            </h1>
            <p className="text-slate-500 font-medium">
              {isFinalStatus
                ? 'This trip is finalized or cancelled. Edits are no longer permitted.'
                : isExecuting ? 'Appending new destinations to an active deployment.' : 'Configure multi-segment road paths and destination sequences.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-8">
          {selectedTanker?.status === 'BREAKDOWN' && (
            <div className="bg-rose-50 border-2 border-rose-200 p-8 rounded-[2.5rem] flex items-center gap-6 text-rose-700">
               <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg">
                  <AlertTriangle size={32} />
               </div>
               <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Tanker Breakdown Alert</h3>
                  <p className="font-bold text-sm opacity-80 uppercase tracking-widest leading-none mt-1">Vehicle is offline. You can still QUEUE this trip, but it cannot start until repairs are complete.</p>
               </div>
            </div>
          )}

          <section className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-3 h-10 bg-blue-600 rounded-full"></div>
                <div>
                  <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] leading-tight">Leg 01</h2>
                  <p className="text-xl font-bold text-slate-900">Primary Configuration</p>
                </div>
              </div>
              {isLoading && <Loader2 className="animate-spin text-blue-600" size={24} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Tanker</label>
                <div className="relative">
                  <select
                    value={tankerId}
                    onChange={(e) => setTankerId(e.target.value)}
                    className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 font-bold outline-none appearance-none disabled:opacity-50 transition-all focus:bg-white focus:ring-4 focus:ring-blue-600/5 ${selectedTanker?.status === 'BREAKDOWN' ? 'border-rose-300 ring-rose-500/10 ring-4' : ''}`}
                    required
                    disabled={isExecuting || isFinalStatus}
                  >
                    <option value="">Select vehicle...</option>
                    {tankers.map(t => (
                      <option
                        key={t.id}
                        value={t.id}
                      >
                        {t.number} ({t.capacityMT}MT)
                        {t.status === 'BREAKDOWN' ? ' — ⚠️ BREAKDOWN' : ''}
                        {t.status === 'ON_TRIP' ? ' — 🚛 ON TRIP' : ''}
                      </option>
                    ))}
                  </select>
                  {!isFinalStatus && <ChevronRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />}
                </div>
                {tankerOrigin && (
                  <div className={`flex items-center gap-3 text-[10px] font-black bg-blue-50/50 px-5 py-3 rounded-2xl border border-blue-100 uppercase tracking-widest ${selectedTanker?.status === 'BREAKDOWN' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-blue-600'}`}>
                    <Navigation size={14} className="animate-pulse" />
                    <span>Current Position: <span className="text-slate-900">{tankerOrigin.name}</span></span>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Planned Start</label>
                <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 font-bold outline-none disabled:opacity-50 transition-all focus:bg-white focus:ring-4 focus:ring-blue-600/5" required disabled={isExecuting || isFinalStatus} />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loading Plant</label>
                <div className="relative">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 font-bold outline-none appearance-none disabled:opacity-50 transition-all focus:bg-white focus:ring-4 focus:ring-blue-600/5" required disabled={isExecuting || isFinalStatus}>
                    <option value="">Choose Source...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {!isFinalStatus && <ChevronRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Cargo</label>
                <div className="relative">
                  <select value={productId} onChange={(e) => setProductId(e.target.value as Product)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 font-bold outline-none appearance-none disabled:opacity-50 transition-all focus:bg-white focus:ring-4 focus:ring-blue-600/5" disabled={isExecuting || isFinalStatus}>
                    {Object.values(Product).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {!isFinalStatus && <ChevronRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />}
                </div>
              </div>
            </div>
          </section>

          {/* Leg 1 Route Cards */}
          {(!isExecuting && !isFinalStatus) ? (
            leg1Options.length > 0 && (
              <section
                onMouseEnter={() => setActiveSegmentId('leg-empty')}
                onMouseLeave={() => setActiveSegmentId(null)}
                className="space-y-6"
              >
                <div className="flex items-end justify-between px-2">
                  <div>
                    <h2 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] mb-1">Route Corridor</h2>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">Select Entry Path</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {leg1Options.map((route, i) => {
                    const isSelected = selectedLeg1?.summary === route.summary;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedLeg1(route)}
                        className={`group relative flex flex-col p-8 rounded-[2.5rem] border-2 transition-all duration-500 text-left outline-none ${isSelected ? 'border-blue-600 bg-blue-50/80' : 'border-slate-100 bg-white/50'}`}
                      >
                        <div className="flex items-center justify-between mb-8">
                          <span className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all">Path {String(i + 1).padStart(2, '0')}</span>
                          {isSelected && <CheckCircle2 size={18} className="text-blue-600" />}
                        </div>
                        <div className="mb-6">
                          <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black tracking-tighter">{route.distanceKm}</span>
                            <span className="text-sm font-black text-slate-400 uppercase tracking-widest">KM</span>
                          </div>
                        </div>
                        <p className="font-bold truncate text-base text-slate-900">{route.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )
          ) : (
            selectedLeg1 && (
              <section className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Entry Route</p>
                   <p className="text-lg font-black text-slate-800">{selectedLeg1.summary}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Distance</p>
                   <p className="text-xl font-black text-blue-600">{selectedLeg1.distanceKm} KM</p>
                </div>
              </section>
            )
          )}

          <section className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-3 h-10 bg-emerald-500 rounded-full"></div>
                <div>
                  <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] leading-tight">Leg 02</h2>
                  <p className="text-xl font-bold text-slate-900">Delivery Distribution</p>
                </div>
              </div>
              {!isFinalStatus && (
                <button type="button" onClick={addUnloadStop} className="flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white px-8 py-5 rounded-[1.5rem] transition-all border-2 border-blue-50 shadow-sm pointer-events-auto">
                  <Plus size={18} /> Add Drop Point
                </button>
              )}
            </div>

            <div className="space-y-12">
              {unloads.map((stop, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveSegmentId(`stop-${idx}`)}
                  onMouseLeave={() => setActiveSegmentId(null)}
                  className={`space-y-8 p-10 -mx-6 rounded-[2.5rem] border transition-all ${activeSegmentId === `stop-${idx}` ? 'bg-blue-50/20 border-blue-200' : 'border-transparent'}`}
                >
                  <div className="flex gap-8 items-end">
                    <div className="flex-1 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unload Destination {idx + 1}</label>
                      <select
                        value={stop.customerId}
                        onChange={(e) => updateUnload(idx, 'customerId', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 font-bold shadow-sm outline-none disabled:bg-slate-100"
                        required
                        disabled={!!stop.unloadedAt || isFinalStatus}
                      >
                        <option value="">Select customer site...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="w-40 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty (MT)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={stop.quantityMT}
                        onChange={(e) => updateUnload(idx, 'quantityMT', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-8 py-5 font-bold shadow-sm outline-none disabled:bg-slate-100"
                        required
                        disabled={!!stop.unloadedAt || isFinalStatus}
                      />
                    </div>
                    {!isFinalStatus && !stop.unloadedAt && (
                      <button type="button" onClick={() => removeUnloadStop(idx)} className="p-5 mb-1 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all pointer-events-auto">
                        <Trash2 size={24} />
                      </button>
                    )}
                  </div>

                  {stop.customerId && !stop.unloadedAt && !isFinalStatus && stopOptions[idx] && stopOptions[idx].length > 0 && (
                    <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3">
                        <RouteIcon size={16} className="text-blue-500" />
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Select Route for Segment {idx + 1}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stopOptions[idx].map((route, rIdx) => {
                          const isSelected = stop.selectedRoute?.summary === route.summary;
                          return (
                            <button
                              key={rIdx}
                              type="button"
                              onClick={() => updateUnload(idx, 'selectedRoute', route)}
                              className={`flex flex-col p-6 rounded-3xl border-2 transition-all duration-300 text-left outline-none ${isSelected ? 'border-blue-600 bg-white shadow-lg' : 'border-slate-100 bg-slate-50/50 hover:bg-white'}`}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Path {rIdx + 1}</span>
                                {isSelected && <CheckCircle2 size={16} className="text-blue-600" />}
                              </div>
                              <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-3xl font-black tracking-tighter text-slate-900">{route.distanceKm}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">KM</span>
                              </div>
                              <p className="font-bold truncate text-xs text-slate-600 uppercase tracking-tight">{route.summary}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(stop.unloadedAt || isFinalStatus) && stop.selectedRoute && (
                    <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selected Road Path</p>
                          <p className="text-sm font-bold text-slate-700 uppercase">{stop.selectedRoute.summary}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Distance</p>
                        <p className="text-lg font-black text-blue-600">{stop.selectedRoute.distanceKm} KM</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-6 pt-10">
            <button type="button" onClick={() => navigate('/trips')} className="px-12 py-6 bg-white text-slate-600 font-black rounded-3xl border-2 border-slate-100 shadow-sm hover:bg-slate-50 uppercase text-xs tracking-widest transition-all pointer-events-auto">
              {isFinalStatus ? 'Return to Fleet' : 'Abort Planning'}
            </button>
            {!isFinalStatus && (
              <button type="submit" disabled={isLoading} className="px-16 py-6 bg-slate-900 text-white font-black rounded-3xl shadow-2xl hover:bg-black transition-all uppercase text-xs tracking-widest flex items-center gap-5 group pointer-events-auto disabled:opacity-50">
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : (isExecuting ? 'Update Live Manifest' : 'Confirm Deployment')}
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-5 space-y-8 sticky top-10">
          <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl p-12 flex flex-col min-h-[820px]">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-4">
                <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg">
                  <MapIcon size={18} />
                </div>
                Network Analysis
              </h2>
            </div>
            <div className="flex-1 min-h-[520px] relative pointer-events-auto">
              <InteractiveRouteMap segments={mapSegments} activeSegmentId={activeSegmentId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
