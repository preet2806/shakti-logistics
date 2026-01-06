
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  CheckCircle2, Clock, AlertTriangle, MapPin, 
  Navigation, Droplets
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { BLOCKING_STATUSES, Tanker, Supplier, Customer, Trip, TripStatus } from '../types.ts';

// Enhanced Cryogenic Tanker SVG
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
}

const MapView: React.FC<MapViewProps> = ({ tankers, suppliers, customers, trips }) => {
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

    const createTankerIcon = (color: string, number: string, statusText: string, isEnroute: boolean, isBreakdown: boolean) => L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative flex flex-col items-center group">
          ${isEnroute ? `<div class="absolute inset-0 bg-${color}-500/20 rounded-full animate-ping -z-10" style="background-color: ${color}33; width: 40px; height: 40px; margin: auto;"></div>` : ''}
          
          <div class="relative flex items-center justify-center bg-white p-1 rounded-xl shadow-xl border-2 transition-transform hover:scale-110" style="border-color: ${color}">
            <div style="width: 36px; height: 36px; color: ${color};">${TANKER_SVG}</div>
            ${isBreakdown ? `<div class="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border-2 border-white"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg></div>` : ''}
          </div>
          
          <div class="mt-1 flex flex-col items-center">
            <div class="bg-slate-900 px-2 py-0.5 rounded-md shadow-lg border border-slate-700">
               <span class="text-[9px] font-black text-white uppercase tracking-tighter whitespace-nowrap">${number}</span>
            </div>
            ${statusText ? `<div class="mt-0.5 px-1.5 py-0.5 rounded-full shadow-sm" style="background-color: ${color}; border: 1px solid white;">
              <span class="text-[7px] font-black text-white uppercase tracking-widest whitespace-nowrap">${statusText}</span>
            </div>` : ''}
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
            <div class="w-4 h-4 rounded-full border-2 border-white shadow-md flex items-center justify-center" style="background-color: ${color}">
               <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    };

    suppliers.forEach(s => {
      const pos: L.LatLngExpression = [s.lat, s.lng];
      bounds.push(pos);
      L.marker(pos, { icon: createSiteIcon('PLANT', s.name) }).addTo(markerLayer).bindTooltip(`Plant: ${s.name}`, { direction: 'top', offset: [0, -10] });
    });

    customers.forEach(c => {
      const pos: L.LatLngExpression = [c.lat, c.lng];
      bounds.push(pos);
      L.marker(pos, { icon: createSiteIcon('SITE', c.name) }).addTo(markerLayer).bindTooltip(`Site: ${c.name}`, { direction: 'top', offset: [0, -10] });
    });

    tankers.forEach(t => {
      const activeTrip = trips.find(tr => tr.tankerId === t.id && BLOCKING_STATUSES.includes(tr.status));
      const currentLoc = [...suppliers, ...customers].find(l => l.id === t.currentLocationId);
      
      let color = '#10b981'; // Available
      let statusText = 'READY';
      let isEnroute = false;
      let isBreakdown = t.status === 'BREAKDOWN';

      if (isBreakdown) {
        color = '#e11d48'; // Rose-600
        statusText = 'BREAKDOWN';
      } else if (activeTrip) {
        isEnroute = true;
        if (activeTrip.status === TripStatus.LOADED_AT_SUPPLIER) {
          color = '#f59e0b';
          statusText = 'LOADED';
        } else if (activeTrip.status === TripStatus.IN_TRANSIT) {
          color = '#2563eb';
          statusText = 'TRANSIT';
        } else if (activeTrip.status === TripStatus.PARTIALLY_UNLOADED) {
          color = '#a855f7';
          statusText = 'DELIVERING';
        }

        if (activeTrip.emptyRoute?.geometry) {
           L.polyline(activeTrip.emptyRoute.geometry, { color: '#64748b', weight: 2, dashArray: '8, 12', opacity: 0.3 }).addTo(markerLayer);
        }
        activeTrip.unloads.forEach(stop => {
          if (stop.selectedRoute?.geometry) {
            L.polyline(stop.selectedRoute.geometry, { color, weight: 4, opacity: 0.5, lineCap: 'round' }).addTo(markerLayer);
          }
        });

        const nextStop = activeTrip.unloads.find(u => !u.unloadedAt);
        if (nextStop?.selectedRoute?.geometry) {
          const geo = nextStop.selectedRoute.geometry;
          const posIdx = Math.floor(geo.length * 0.7);
          const pos = geo[posIdx];
          bounds.push(pos);
          L.marker(pos, { icon: createTankerIcon(color, t.number, statusText, true, false), zIndexOffset: 2000 })
            .addTo(markerLayer);
        } else if (currentLoc) {
          const pos: L.LatLngExpression = [currentLoc.lat, currentLoc.lng];
          bounds.push(pos);
          L.marker(pos, { icon: createTankerIcon(color, t.number, statusText, false, false), zIndexOffset: 2000 }).addTo(markerLayer);
        }
      } else if (currentLoc) {
        const pos: L.LatLngExpression = [currentLoc.lat, currentLoc.lng];
        bounds.push(pos);
        L.marker(pos, { icon: createTankerIcon(color, t.number, statusText, false, isBreakdown), zIndexOffset: 1000 }).addTo(markerLayer);
      }
    });

    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds), { padding: [80, 80] });
  }, [tankers, trips]);

  return <div className="w-full h-full relative bg-slate-100 overflow-hidden rounded-[2rem] border border-slate-200 shadow-inner"><div ref={mapContainerRef} className="w-full h-full z-0" /></div>;
};

export const Dashboard: React.FC = () => {
  const { trips, tankers, customers, suppliers } = useGlobalStore();
  const activeTrips = trips.filter(t => BLOCKING_STATUSES.includes(t.status));
  const availableTankers = tankers.filter(t => t.status === 'AVAILABLE').length;
  const breakdownCount = tankers.filter(t => t.status === 'BREAKDOWN').length;

  const totalDiesel = trips.reduce((acc, t) => acc + (Number(t.dieselIssuedL) || 0), 0);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Command Intelligence</h1>
          <p className="text-slate-500 font-medium text-sm">Real-time road tracking and fleet operations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Live Operations', value: activeTrips.length, icon: Navigation, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Ready for Duty', value: availableTankers, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Diesel Utilized', value: `${Math.round(totalDiesel)}L`, icon: Droplets, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Breakdown Alerts', value: breakdownCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat) => (
          <div key={stat.label} className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 hover:border-blue-200 transition-all hover:shadow-md ${stat.label === 'Breakdown Alerts' && breakdownCount > 0 ? 'border-rose-300 ring-4 ring-rose-500/5' : ''}`}>
            <div className={`${stat.bg} ${stat.color} p-4 rounded-2xl`}><stat.icon size={24} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[650px]">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
            <h2 className="font-black text-slate-900 uppercase text-xs tracking-widest flex items-center gap-3"><MapPin size={20} className="text-blue-600" /> Live Road Tracking</h2>
            <div className="flex items-center gap-6">
               <span className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> Transit</span>
               <span className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> Breakdown</span>
               <span className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Available</span>
            </div>
          </div>
          <div className="flex-1 relative">
            <MapView tankers={tankers} suppliers={suppliers} customers={customers} trips={trips} />
          </div>
        </div>
      </div>
    </div>
  );
};
