import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import { 
  CheckCircle2, AlertTriangle, MapPin, 
  Navigation, Droplets, Activity, Zap, Truck,
  ChevronRight, Gauge, Layers, Radar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from '../store.tsx';
import { BLOCKING_STATUSES, Tanker, Supplier, Customer, Trip, TripStatus } from '../types.ts';
import { STATUS_COLORS } from '../constants.tsx';

// Enhanced Cryogenic Tanker SVG for Map
const TANKER_SVG = `
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M52 38H12C9.79086 38 8 36.2091 8 34V22C8 19.7909 9.79086 18 12 18H52C54.2091 18 56 19.7909 56 22V34C56 36.2091 54.2091 38 52 38Z" fill="currentColor"/>
    <path d="M56 24H60C61.1046 24 62 24.8954 62 26V36C62 37.1046 61.1046 38 60 38H56V24Z" fill="currentColor" fill-opacity="0.6"/>
    <circle cx="16" cy="42" r="4" fill="currentColor"/>
    <circle cx="28" cy="42" r="4" fill="currentColor"/>
    <circle cx="48" cy="42" r="4" fill="currentColor"/>
    <path d="M12 22H52V34H12V22Z" stroke="white" stroke-width="2" stroke-opacity="0.2"/>
    <rect x="50" y="22" width="2" height="12" fill="white" fill-opacity="0.3"/>
  </svg>
`;

interface MapViewProps {
  tankers: Tanker[];
  suppliers: Supplier[];
  customers: Customer[];
  trips: Trip[];
  onHover: (tankerId: string | null) => void;
}

const MapView: React.FC<MapViewProps> = ({ tankers, suppliers, customers, trips, onHover }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center: [21.0, 78.0],
        zoom: 5,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(mapInstanceRef.current);
      L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);
      markerLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const markerLayer = markerLayerRef.current!;
    markerLayer.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    const createTankerIcon = (color: string, number: string) => L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative flex flex-col items-center group cursor-pointer transition-all">
          <div class="relative flex items-center justify-center bg-white p-1 rounded-xl shadow-xl border-2 transition-transform hover:scale-150 hover:z-[9999]" style="border-color: ${color}">
            <div style="width: 30px; height: 30px; color: ${color};">${TANKER_SVG}</div>
          </div>
          <div class="mt-1 bg-slate-900 px-2 py-0.5 rounded-md shadow-lg border border-slate-700 pointer-events-none">
             <span class="text-[8px] font-black text-white uppercase tracking-tighter whitespace-nowrap">${number}</span>
          </div>
        </div>
      `,
      iconSize: [60, 80],
      iconAnchor: [30, 40]
    });

    const createSiteIcon = (type: 'PLANT' | 'SITE', name: string) => {
      const color = type === 'PLANT' ? '#2563eb' : '#64748b';
      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="flex flex-col items-center">
            <div class="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-150" style="background-color: ${color}"></div>
            <span class="text-[6px] font-black uppercase text-slate-400 mt-0.5 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">${name}</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    };

    const activeSuppliers = suppliers.filter(s => s.isOperational);
    const activeCustomers = customers.filter(c => c.isOperational);

    activeSuppliers.forEach(s => {
      const pos: L.LatLngExpression = [s.lat, s.lng];
      bounds.push(pos);
      L.marker(pos, { icon: createSiteIcon('PLANT', s.name) }).addTo(markerLayer).bindTooltip(s.name, { direction: 'top', offset: [0, -10] });
    });

    activeCustomers.forEach(c => {
      const pos: L.LatLngExpression = [c.lat, c.lng];
      bounds.push(pos);
      L.marker(pos, { icon: createSiteIcon('SITE', c.name) }).addTo(markerLayer).bindTooltip(c.name, { direction: 'top', offset: [0, -10] });
    });

    tankers.forEach(t => {
      const activeTrip = trips.find(tr => tr.tankerId === t.id && BLOCKING_STATUSES.includes(tr.status));
      const currentLoc = [...suppliers, ...customers].find(l => l.id === t.currentLocationId);
      
      let color = '#10b981'; 
      if (t.status === 'BREAKDOWN') color = '#e11d48';
      else if (activeTrip) {
        if (activeTrip.status === TripStatus.TRANSIT_TO_SUPPLIER) color = '#6366f1'; 
        else if (activeTrip.status === TripStatus.LOADED_AT_SUPPLIER) color = '#f59e0b';
        else if (activeTrip.status === TripStatus.IN_TRANSIT) color = '#2563eb';
        else if (activeTrip.status === TripStatus.PARTIALLY_UNLOADED) color = '#a855f7';

        const nextStopIdx = activeTrip.unloads.findIndex(u => !u.unloadedAt);
        
        // Draw Leg 1: Empty run to Plant
        if (activeTrip.emptyRoute?.geometry) {
          const isActiveLeg = activeTrip.status === TripStatus.TRANSIT_TO_SUPPLIER;
          L.polyline(activeTrip.emptyRoute.geometry, { 
            color: isActiveLeg ? color : '#94a3b8', 
            weight: isActiveLeg ? 3 : 1, 
            opacity: isActiveLeg ? 0.8 : 0.2, 
            dashArray: isActiveLeg ? '10, 10' : undefined 
          }).addTo(markerLayer);

          if (isActiveLeg) {
            const geo = activeTrip.emptyRoute.geometry;
            const pos = geo[Math.floor(geo.length * 0.5)];
            bounds.push(pos);
            L.marker(pos, { icon: createTankerIcon(color, t.number), zIndexOffset: 2000 })
              .addTo(markerLayer)
              .on('mouseover', () => onHover(t.id))
              .on('mouseout', () => onHover(null));
          }
        }

        // Draw Legs 2+: Deliveries between customers
        activeTrip.unloads.forEach((stop, idx) => {
          if (stop.selectedRoute?.geometry) {
            const isActiveLeg = activeTrip.status === TripStatus.IN_TRANSIT && idx === nextStopIdx;
            const isPast = idx < nextStopIdx;
            
            // Only draw current and future legs
            if (!isPast) {
              L.polyline(stop.selectedRoute.geometry, { 
                color: isActiveLeg ? color : '#94a3b8', 
                weight: isActiveLeg ? 3 : 1, 
                opacity: isActiveLeg ? 0.8 : 0.2,
                dashArray: isActiveLeg ? '10, 10' : undefined
              }).addTo(markerLayer);
            }

            if (isActiveLeg) {
              const geo = stop.selectedRoute.geometry;
              const pos = geo[Math.floor(geo.length * 0.6)];
              bounds.push(pos);
              L.marker(pos, { icon: createTankerIcon(color, t.number), zIndexOffset: 2000 })
                .addTo(markerLayer)
                .on('mouseover', () => onHover(t.id))
                .on('mouseout', () => onHover(null));
            }
          }
        });

        // Draw stationary marker if at plant or site
        const isStationary = activeTrip.status === TripStatus.LOADED_AT_SUPPLIER || 
                             activeTrip.status === TripStatus.PARTIALLY_UNLOADED ||
                             activeTrip.status === TripStatus.PLANNED;
        
        if (isStationary && currentLoc) {
          const pos: L.LatLngExpression = [currentLoc.lat, currentLoc.lng];
          bounds.push(pos);
          L.marker(pos, { icon: createTankerIcon(color, t.number), zIndexOffset: 2000 })
            .addTo(markerLayer)
            .on('mouseover', () => onHover(t.id))
            .on('mouseout', () => onHover(null));
        }
      } else if (currentLoc) {
        // Available tankers
        const pos: L.LatLngExpression = [currentLoc.lat, currentLoc.lng];
        bounds.push(pos);
        L.marker(pos, { icon: createTankerIcon(color, t.number), zIndexOffset: 1000 })
          .addTo(markerLayer)
          .on('mouseover', () => onHover(t.id))
          .on('mouseout', () => onHover(null));
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [80, 80], maxZoom: 8 });
    }
  }, [tankers, suppliers, customers, trips, onHover]);

  return <div ref={mapContainerRef} className="w-full h-full min-h-[700px] z-10" />;
};

export const Dashboard: React.FC = () => {
  const { trips, tankers, customers, suppliers } = useGlobalStore();
  const [hoveredTankerId, setHoveredTankerId] = useState<string | null>(null);
  
  const stats = useMemo(() => {
    const activeTripsCount = trips.filter(t => BLOCKING_STATUSES.includes(t.status)).length;
    const availableCount = tankers.filter(t => t.status === 'AVAILABLE').length;
    const breakdownCount = tankers.filter(t => t.status === 'BREAKDOWN').length;
    const today = new Date().toISOString().split('T')[0];
    const todayLiters = trips
      .filter(t => t.plannedStartDate === today)
      .reduce((acc, t) => acc + (Number(t.dieselIssuedL) || 0), 0);
    
    return { activeTripsCount, availableCount, todayLiters, breakdownCount };
  }, [trips, tankers]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Command Intelligence</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-1">Real-time road tracking and fleet operations.</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Activity className="text-blue-600 animate-pulse" size={18} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Live Operations', val: stats.activeTripsCount, icon: Navigation, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Ready for Duty', val: stats.availableCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Today\'s Diesel', val: `${Math.round(stats.todayLiters)}L`, icon: Droplets, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Breakdown Alerts', val: stats.breakdownCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.val}</p>
            </div>
            <div className={`${stat.bg} ${stat.color} p-4 rounded-2xl`}><stat.icon size={28} /></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
            <Truck size={32} className="text-blue-600" /> Live Road Tracking
          </h2>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-rose-600 rounded-full shadow-[0_0_10px_rgba(225,29,72,0.4)]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Breakdown</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available</span>
            </div>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <MapView 
            tankers={tankers} 
            suppliers={suppliers} 
            customers={customers} 
            trips={trips} 
            onHover={setHoveredTankerId}
          />
          
          <div className="absolute bottom-8 left-8 z-[1000] pointer-events-none">
             {hoveredTankerId ? (
               <div className="bg-slate-900/90 backdrop-blur text-white p-6 rounded-3xl border border-slate-700 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[280px]">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-lg uppercase tracking-tight">{tankers.find(t => t.id === hoveredTankerId)?.number}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Asset Telemetry Active</p>
                    </div>
                 </div>
                 <div className="space-y-2 border-t border-white/10 pt-4">
                    <div className="flex justify-between">
                       <span className="text-[9px] font-black text-slate-500 uppercase">Status</span>
                       <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
                         {(() => {
                           const tanker = tankers.find(t => t.id === hoveredTankerId);
                           const activeTrip = trips.find(tr => tr.tankerId === hoveredTankerId && BLOCKING_STATUSES.includes(tr.status));
                           return activeTrip ? activeTrip.status.replace(/_/g, ' ') : tanker?.status;
                         })()}
                       </span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-[9px] font-black text-slate-500 uppercase">Load</span>
                       <span className="text-[9px] font-black uppercase">
                         {trips.find(tr => tr.tankerId === hoveredTankerId && BLOCKING_STATUSES.includes(tr.status))?.productId || 'NONE'}
                       </span>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="bg-white/80 backdrop-blur px-6 py-3 rounded-full border border-slate-200 shadow-xl flex items-center gap-4">
                  <Radar size={16} className="text-blue-600" />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Syncing Fleet Positions...</span>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};