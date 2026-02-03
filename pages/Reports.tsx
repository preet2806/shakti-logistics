
import React, { useState, useMemo } from 'react';
import { 
  FileText, Download, Calendar, Filter, 
  ChevronRight, BarChart3, Truck, Fuel, AlertCircle, CheckCircle2, ListFilter
} from 'lucide-react';
import { useGlobalStore } from '../store.tsx';
import { TripStatus, Trip, Tanker } from '../types.ts';
import { formatMT, formatKm, formatLiters } from '../utils/helpers.ts';

export const Reports: React.FC = () => {
  const { trips, tankers, suppliers, customers, getTripExpenses } = useGlobalStore();

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const [statusFilter, setStatusFilter] = useState<TripStatus>(TripStatus.CLOSED);

  const filteredTripsByDate = useMemo(() => {
    return trips.filter(t => {
      const tripDate = t.plannedStartDate;
      const afterFrom = !dateRange.from || tripDate >= dateRange.from;
      const beforeTo = !dateRange.to || tripDate <= dateRange.to;
      return afterFrom && beforeTo;
    });
  }, [trips, dateRange]);

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

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const handleTripReport = (filteredByStatus?: TripStatus) => {
    const reportData: any[] = [];

    const tripsToProcess = filteredByStatus
      ? filteredTripsByDate.filter(t => t.status === filteredByStatus)
      : filteredTripsByDate;

    tripsToProcess.forEach(t => {
      const tanker = tankers.find(v => v.id === t.tankerId);
      const loadingPoint = suppliers.find(s => s.id === t.supplierId);
      const tripExpenseTotal = getTripExpenses(t);

      if (t.unloads.length === 0) {
        const row: any = {
          'Date': t.plannedStartDate,
          'Tanker No': tanker?.number || 'Deleted',
          'Product': t.productId,
          'Loading Point': loadingPoint?.name || 'Unknown',
          'Unloading Point': 'N/A',
          'Planned Quantity (MT)': 0,
          'Actual Quantity (MT)': '',
          'Difference (MT)': '',
          'Challan Number': '',
          'Leg Expense (Est)': tripExpenseTotal
        };
        if (!filteredByStatus) row['Trip Status'] = t.status.replace(/_/g, ' ');
        row['Remarks'] = t.remarks || '';
        reportData.push(row);
        return;
      }

      t.unloads.forEach((u, index) => {
        const cust = customers.find(c => c.id === u.customerId);
        const isFirst = index === 0;

        const planned = Number(u.quantityMT || 0);
        const actual = u.actualQuantityMT !== undefined ? Number(u.actualQuantityMT) : null;
        const diff = actual !== null ? (planned - actual).toFixed(2) : '';

        const row: any = {
          'Date': isFirst ? t.plannedStartDate : '',
          'Tanker No': isFirst ? (tanker?.number || 'Deleted') : '',
          'Product': isFirst ? t.productId : '',
          'Loading Point': isFirst ? (loadingPoint?.name || 'Unknown') : '',
          'Unloading Point': cust?.name || 'Unknown',
          'Planned Quantity (MT)': planned,
          'Actual Quantity (MT)': actual !== null ? actual : '',
          'Difference (MT)': diff,
          'Challan Number': u.challanNumber || '',
          'Total Trip Expense (Est)': isFirst ? tripExpenseTotal : ''
        };

        if (!filteredByStatus) {
          row['Trip Status'] = isFirst ? t.status.replace(/_/g, ' ') : '';
        }

        row['Remarks'] = isFirst ? (t.remarks || '') : '';
        reportData.push(row);
      });
    });

    const filename = filteredByStatus
      ? `Filtered_Trip_Report_${filteredByStatus}`
      : 'Expanded_Trip_Intelligence_Report';

    exportCSV(reportData, filename);
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
      // Logic fix: Only include CLOSED trips for fuel efficiency analysis
      const tankerTrips = filteredTripsByDate.filter(t => t.tankerId === tanker.id && t.status === TripStatus.CLOSED);

      const totalDist = tankerTrips.reduce((a, b) => a + Number(b.totalDistanceKm || 0), 0);
      const totalEx = tankerTrips.reduce((a, b) => a + getTripExpenses(b), 0);
      const estimatedTotalDiesel = tankerTrips.reduce((a, b) => {
        const efficiency = Number(tanker.dieselAvgKmPerL || 3.5);
        const distance = Number(b.totalDistanceKm || 0);
        return a + (distance > 0 ? Math.round(distance / efficiency) : 0);
      }, 0);

      const remarks = tankerTrips.map(t => t.remarks).filter(r => !!r).join('; ');

      return {
        'Tanker': tanker.number,
        'Completed Trips': tankerTrips.length,
        'Total Distance (KM)': totalDist.toFixed(1),
        'Total Expense (Standard)': totalEx,
        'Estimated Diesel (L)': estimatedTotalDiesel,
        'Actual Diesel (L)': '',
        'Base Efficiency (KM/L)': tanker.dieselAvgKmPerL,
        'Remarks': remarks
      };
    });
    exportCSV(reportData, 'Diesel_Efficiency_Report');
  };

  const reportCards = [
    {
      id: 'trip-report',
      title: 'Strategic Trip Report',
      desc: 'Includes Challan No, Actuals, and Variance analysis. Row-expanded.',
      icon: Truck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      action: () => handleTripReport(),
      count: filteredTripsByDate.length
    },
    {
      id: 'filtered-trip-report',
      title: `Status-Specific Report`,
      desc: `Deep dive into ${statusFilter.replace(/_/g, ' ')} operational records.`,
      icon: ListFilter,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      action: () => handleTripReport(statusFilter),
      count: filteredTripsByDate.filter(t => t.status === statusFilter).length
    },
    {
      id: 'tanker-status',
      title: 'Asset Matrix',
      desc: 'Live snapshot of all tankers and their current deployment positions.',
      icon: BarChart3,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      action: handleDailyStatusReport,
      count: tankers.length
    },
    {
      id: 'diesel-log',
      title: 'Fuel Intelligence',
      desc: 'Audits fuel utilization and expenses for completed (CLOSED) trips.',
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
          <p className="text-slate-500 font-medium text-sm uppercase tracking-wider">Precision Logistics Data Export</p>
        </div>
        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest leading-tight">
            Variance Analysis Engine Active (Planned vs Actual)
          </p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-end gap-8">
        <div className="flex-1 space-y-4">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <Calendar size={14} className="text-blue-500" /> Start Date
           </label>
           <input
             type="date"
             value={dateRange.from}
             onChange={e => setDateRange({...dateRange, from: e.target.value})}
             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-blue-600/5 transition-all shadow-sm"
           />
        </div>
        <div className="flex-1 space-y-4">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <Calendar size={14} className="text-blue-500" /> End Date
           </label>
           <input
             type="date"
             value={dateRange.to}
             onChange={e => setDateRange({...dateRange, to: e.target.value})}
             className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-blue-600/5 transition-all shadow-sm"
           />
        </div>
        <div className="flex-1 space-y-4">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
             <ListFilter size={14} className="text-indigo-500" /> Pre-Download Status Filter
           </label>
           <select
             value={statusFilter}
             onChange={e => setStatusFilter(e.target.value as TripStatus)}
             className="w-full bg-indigo-50/50 border border-indigo-200 rounded-2xl px-6 py-4 outline-none font-black text-slate-700 focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-sm appearance-none cursor-pointer"
           >
             {Object.values(TripStatus).map(s => (
               <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
             ))}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {reportCards.map((card) => (
          <div key={card.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group flex flex-col justify-between min-h-[350px]">
            <div>
              <div className={`${card.bg} ${card.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm`}>
                <card.icon size={32} />
              </div>
              <h3 className="font-black text-slate-900 text-xl tracking-tighter mb-2 leading-none">{card.title}</h3>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">{card.desc}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50">
              <div className="flex items-center justify-between mb-4 px-1">
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">In Range</span>
                 <span className="text-xs font-black text-slate-700">{card.count} Matches</span>
              </div>
              <button
                onClick={card.action}
                className={`flex items-center justify-between w-full font-black text-[10px] tracking-[0.2em] transition-all px-8 py-5 rounded-[1.5rem] uppercase shadow-sm active:scale-95 ${card.color} ${card.bg} border-2 border-transparent hover:border-current`}
              >
                <div className="flex items-center gap-3">
                   <Download size={18} /> Export CSV
                </div>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
