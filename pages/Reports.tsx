
import React, { useState, useMemo } from 'react';
import { 
  FileText, Download, Calendar, Filter, 
  ChevronRight, BarChart3, Truck, Fuel, AlertCircle, CheckCircle2
} from 'lucide-react';
// Corrected import path to include extension
import { useGlobalStore } from '../store.tsx';
import { TripStatus, Trip, Tanker } from '../types.ts';
import { formatMT, formatKm, formatLiters } from '../utils/helpers.ts';

export const Reports: React.FC = () => {
  const { trips, tankers, suppliers, customers } = useGlobalStore();
  
  // Set default date range to last 7 days
  const [dateRange, setDateRange] = useState({ 
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });

  // Derived state to show user how many trips are selected before download
  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const tripDate = t.plannedStartDate;
      // String comparison works for YYYY-MM-DD format
      const afterFrom = !dateRange.from || tripDate >= dateRange.from;
      const beforeTo = !dateRange.to || tripDate <= dateRange.to;
      return afterFrom && beforeTo;
    });
  }, [trips, dateRange]);

  // Helper to get actual diesel OR calculated estimate for the report
  const getReportableDiesel = (trip: Trip) => {
    if (trip.dieselIssuedL && trip.dieselIssuedL > 0) return Number(trip.dieselIssuedL);
    
    // Fallback: Calculate requirement if issued is 0 (likely a planned trip)
    const tanker = tankers.find(v => v.id === trip.tankerId);
    const efficiency = Number(tanker?.dieselAvgKmPerL || 3.5);
    const distance = Number(trip.totalDistanceKm || 0);
    return distance > 0 ? Math.round(distance / efficiency) : 0;
  };

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert("No data found for the selected criteria.");
      return;
    }
    
    const csvRows = [];
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));
    
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header];
        // Escape double quotes and wrap in quotes for CSV safety
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const handleTripReport = () => {
    const reportData = filteredTrips.map(t => {
      const tanker = tankers.find(v => v.id === t.tankerId);
      const loadingPoint = suppliers.find(s => s.id === t.supplierId);
      
      // Concatenate multiple unload points and quantities
      const unloadingPoints = t.unloads.map(u => {
        const cust = customers.find(c => c.id === u.customerId);
        return cust?.name || 'Unknown';
      }).join('; ');

      const unloadingQuantities = t.unloads.map(u => `${u.quantityMT}`).join('; ');

      return {
        'Date': t.plannedStartDate,
        'Tanker No': tanker?.number || 'Deleted',
        'Product': t.productId,
        'Loading Point': loadingPoint?.name || 'Unknown',
        'Unloading Points': unloadingPoints,
        'Unloading Quantities (MT)': unloadingQuantities,
        'Challan Number': '', // Blank column as requested for post-download entry
        'Total Distance (KM)': t.totalDistanceKm,
        'Diesel Value (L)': getReportableDiesel(t),
        'Trip Status': t.status.replace(/_/g, ' '),
        'Remarks': t.remarks || ''
      };
    });

    exportCSV(reportData, 'Date_Wise_Trip_Report');
  };

  const handleDailyStatusReport = () => {
    const reportData = tankers.map(t => {
      const loc = [...suppliers, ...customers].find(l => l.id === t.currentLocationId);
      return {
        'Tanker Number': t.number,
        'Current Location': loc?.name || 'Unknown',
        'Address': loc?.address || '',
        'Current Status': t.status,
        'Capacity (MT)': t.capacityMT,
        'Efficiency (KM/L)': t.dieselAvgKmPerL
      };
    });

    exportCSV(reportData, 'Daily_Tanker_Status_Report');
  };

  const handleDieselReport = () => {
    const reportData = tankers.map(tanker => {
      const tankerTrips = trips.filter(t => t.tankerId === tanker.id);
      return {
        'Tanker': tanker.number,
        'Total Trips': tankerTrips.length,
        'Total Distance (KM)': tankerTrips.reduce((a, b) => a + Number(b.totalDistanceKm || 0), 0),
        'Estimated Diesel (L)': tankerTrips.reduce((a, b) => a + getReportableDiesel(b), 0),
        'Base Efficiency (KM/L)': tanker.dieselAvgKmPerL
      };
    });
    exportCSV(reportData, 'Diesel_Efficiency_Report');
  };

  const reportCards = [
    { 
      id: 'trip-report',
      title: 'Date-wise Trip Report', 
      desc: 'Loading/Unloading sites, quantities, and Challan placeholders.',
      icon: Truck, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      action: handleTripReport,
      count: filteredTrips.length
    },
    { 
      id: 'tanker-status',
      title: 'Daily Tanker Status', 
      desc: 'Live snapshot of all tankers and their current locations.',
      icon: BarChart3, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      action: handleDailyStatusReport,
      count: tankers.length
    },
    { 
      id: 'diesel-log',
      title: 'Diesel & Distance Log', 
      desc: 'Fleet-wide fuel metrics and distance utilization tracking.',
      icon: Fuel, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      action: handleDieselReport,
      count: tankers.length
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence & Reports</h1>
          <p className="text-slate-500 font-medium">Export operational data for audit and logistics planning.</p>
        </div>
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
          <AlertCircle size={18} className="text-blue-600 shrink-0" />
          <p className="text-[11px] font-black text-blue-700 uppercase tracking-widest leading-tight">
            Standard CSV format provided 
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-end gap-6">
        <div className="flex-1 space-y-3">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <Calendar size={14} className="text-blue-500" /> Start Date
           </label>
           <input 
             type="date" 
             value={dateRange.from} 
             onChange={e => setDateRange({...dateRange, from: e.target.value})} 
             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm" 
           />
        </div>
        <div className="flex-1 space-y-3">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <Calendar size={14} className="text-blue-500" /> End Date
           </label>
           <input 
             type="date" 
             value={dateRange.to} 
             onChange={e => setDateRange({...dateRange, to: e.target.value})} 
             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm" 
           />
        </div>
        <div className="px-10 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl flex items-center gap-3 uppercase tracking-widest text-xs border border-slate-200 cursor-default">
           <CheckCircle2 size={18} className={filteredTrips.length > 0 ? 'text-emerald-500' : 'text-slate-300'} />
           {filteredTrips.length} Trips Selected
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reportCards.map((card) => (
          <div key={card.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group flex flex-col justify-between min-h-[300px]">
            <div>
              <div className={`${card.bg} ${card.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm`}>
                <card.icon size={28} />
              </div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight mb-2">{card.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{card.desc}</p>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-50">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope</span>
                 <span className="text-xs font-bold text-slate-700">{card.count} Entries</span>
              </div>
              <button 
                onClick={card.action}
                className="flex items-center justify-between w-full text-blue-600 hover:text-blue-800 font-black text-[10px] tracking-[0.15em] transition-all bg-blue-50 px-6 py-4 rounded-xl uppercase shadow-sm active:scale-95"
              >
                <div className="flex items-center gap-3">
                   <Download size={16} /> Download CSV
                </div>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 p-10 opacity-10">
            <FileText size={200} />
         </div>
         <div className="relative z-10 max-w-xl">
            <div className="w-12 h-1 bg-blue-500 mb-6 rounded-full"></div>
            <h2 className="text-3xl font-black mb-4 tracking-tight leading-none">Dispatcher Reports</h2>
            <p className="text-slate-400 text-lg mb-8 font-medium">All reports are calculated in real-time. Use the date range filters above to generate historical trip records.</p>
            <div className="flex flex-wrap gap-4">
              <div className="px-6 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                Excel Compatible
              </div>
              <div className="px-6 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                UTF-8 Encoded
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};
