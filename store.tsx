
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trip, Tanker, Supplier, Customer, User, Product, BLOCKING_STATUSES, TripStatus, Location, RouteExpense, ExpenseHistoryEntry } from './types.ts';
import { fetchRoutes } from './utils/helpers.ts';

const supabaseUrl = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || 'https://jtjxeacpveaiflutxgok.supabase.co';
const supabaseKey = (typeof process !== 'undefined' && process.env.SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0anhlYWNwdmVhaWZsdXR4Z29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MzYwNzMsImV4cCI6MjA4MzAxMjA3M30.1G2tGxn6i991cajuzYgVFf9LTisXgsqwP3qOU1qejhw';
const supabase = createClient(supabaseUrl, supabaseKey);

type StoreContextType = {
  tankers: Tanker[];
  trips: Trip[];
  suppliers: Supplier[];
  customers: Customer[];
  users: User[];
  expenses: RouteExpense[];
  currentUser: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (name: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchData: () => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (trip: Trip) => Promise<void>;
  addTanker: (t: Tanker) => Promise<void>;
  updateTanker: (t: Tanker) => Promise<void>;
  deleteTanker: (id: string) => Promise<void>;
  addSupplier: (s: Supplier) => Promise<void>;
  updateSupplier: (s: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addCustomer: (c: Customer) => Promise<void>;
  updateCustomer: (c: Customer) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addUser: (u: User) => Promise<void>;
  updateUser: (u: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addExpense: (e: RouteExpense) => Promise<void>;
  updateExpense: (e: RouteExpense) => Promise<void>;
  approveExpense: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getActiveTripForTanker: (tankerId: string) => Trip | undefined;
  getTripExpenses: (trip: Trip) => number;
};

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tankers, setTankers] = useState<Tanker[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<RouteExpense[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Optimized: Explicit column selection to reduce egress usage
      const [sRes, cRes, tRes, trRes, uRes, usrRes, exRes] = await Promise.all([
        supabase.from('suppliers').select('id, name, address, lat, lng, is_operational'),
        supabase.from('customers').select('id, name, address, lat, lng, is_operational'),
        supabase.from('tankers').select('id, number, compatible_products, capacity_mt, diesel_avg, current_location_id, status'),
        supabase.from('trips').select('id, tanker_id, product_id, supplier_id, planned_start_date, status, empty_route, diesel_issued, diesel_used, empty_distance, loaded_distance, total_distance, remarks, created_by').order('created_at', { ascending: false }),
        supabase.from('unloads').select('trip_id, customer_id, quantity_mt, unloaded_at, selected_route, challan_number, actual_quantity_mt, sort_order').order('sort_order', { ascending: true }),
        supabase.from('users').select('id, name, role'),
        supabase.from('route_expenses').select('id, start_location_id, end_location_id, items, total_amount, status, history')
      ]);

      if (sRes.data) setSuppliers(sRes.data.map(s => ({
        id: s.id, name: s.name, address: s.address, lat: s.lat, lng: s.lng, isOperational: s.is_operational !== false
      })));

      if (cRes.data) setCustomers(cRes.data.map(c => ({
        id: c.id, name: c.name, address: c.address, lat: c.lat, lng: c.lng, isOperational: c.is_operational !== false
      })));

      if (usrRes.data) setUsers(usrRes.data);

      if (exRes.data) setExpenses(exRes.data.map(e => ({
        id: e.id,
        startLocationId: e.start_location_id,
        endLocationId: e.end_location_id,
        items: e.items || [],
        totalAmount: e.total_amount || 0,
        status: e.status || 'PENDING',
        history: e.history || []
      })));

      if (tRes.data) {
        setTankers(tRes.data.map(t => ({
          id: t.id,
          number: t.number,
          compatibleProducts: t.compatible_products || [],
          capacityMT: t.capacity_mt,
          dieselAvgKmPerL: Number(t.diesel_avg || 3.5),
          currentLocationId: t.current_location_id,
          status: t.status
        })));
      }

      if (trRes.data) {
        setTrips(trRes.data.map(tr => {
          const tripUnloads = (uRes.data || [])
            .filter(u => u.trip_id === tr.id)
            .map(u => ({
              customerId: u.customer_id,
              quantityMT: Number(u.quantity_mt),
              unloadedAt: u.unloaded_at,
              selectedRoute: u.selected_route,
              challanNumber: u.challan_number,
              actualQuantityMT: u.actual_quantity_mt !== null ? Number(u.actual_quantity_mt) : undefined
            }));

          return {
            id: tr.id,
            tankerId: tr.tanker_id,
            productId: tr.product_id,
            supplierId: tr.supplier_id,
            plannedStartDate: tr.planned_start_date,
            status: tr.status,
            emptyRoute: tr.empty_route,
            unloads: tripUnloads,
            totalLoadedMT: tripUnloads.reduce((acc, u) => acc + u.quantityMT, 0),
            dieselIssuedL: Number(tr.diesel_issued || 0),
            dieselUsedL: Number(tr.diesel_used || 0),
            emptyDistanceKm: Number(tr.empty_distance || 0),
            loadedDistanceKm: Number(tr.loaded_distance || 0),
            totalDistanceKm: Number(tr.total_distance || 0),
            remarks: tr.remarks || '',
            createdBy: tr.created_by
          };
        }));
      }
    } catch (error) {
      console.error('Data Fetch Error:', error);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('cryo_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          // Optimized: Explicit column selection for auth check
          const { data, error } = await supabase.from('users').select('id, name, role').eq('id', user.id).single();
          if (data && !error) {
            setCurrentUser(data);
            setIsAuthenticated(true);
            await fetchData();
          } else {
            localStorage.removeItem('cryo_user');
          }
        } catch (e) {
          localStorage.removeItem('cryo_user');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [fetchData]);

  const login = async (name: string, password: string): Promise<boolean> => {
    // Optimized: Explicit column selection for login verification
    const { data, error } = await supabase.from('users').select('id, name, role').eq('name', name).eq('password', password).single();
    if (error || !data) return false;
    localStorage.setItem('cryo_user', JSON.stringify(data));
    setCurrentUser(data);
    setIsAuthenticated(true);
    await fetchData();
    return true;
  };

  const logout = () => {
    localStorage.removeItem('cryo_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const approveExpense = async (id: string) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;

    const newHistoryEntry: ExpenseHistoryEntry = {
      amount: exp.totalAmount,
      items: exp.items,
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.name
    };

    const updatedHistory = [...exp.history, newHistoryEntry];

    const { error } = await supabase.from('route_expenses').update({
      status: 'APPROVED',
      history: updatedHistory,
      approved_at: newHistoryEntry.approvedAt,
      approved_by: newHistoryEntry.approvedBy
    }).eq('id', id);

    if (!error) await fetchData();
  };

  const addTrip = async (trip: Trip) => {
    await supabase.from('trips').insert([{
      id: trip.id,
      tanker_id: trip.tankerId,
      product_id: trip.productId,
      supplier_id: trip.supplierId,
      planned_start_date: trip.plannedStartDate,
      status: trip.status,
      empty_route: trip.emptyRoute,
      diesel_issued: trip.dieselIssuedL,
      empty_distance: trip.emptyDistanceKm,
      loaded_distance: trip.loadedDistanceKm,
      total_distance: trip.totalDistanceKm,
      remarks: trip.remarks,
      created_by: trip.createdBy
    }]);

    if (trip.unloads.length > 0) {
      await supabase.from('unloads').insert(trip.unloads.map((u, idx) => ({
        trip_id: trip.id,
        customer_id: u.customerId,
        quantity_mt: u.quantityMT,
        sort_order: idx
      })));
    }
    await fetchData();
  };

  const updateTrip = async (updatedTrip: Trip) => {
    const oldTripState = trips.find(t => t.id === updatedTrip.id);
    const tanker = tankers.find(t => t.id === updatedTrip.tankerId);

    let nextTankerStatus: 'AVAILABLE' | 'ON_TRIP' | 'BREAKDOWN' = tanker?.status || 'AVAILABLE';
    let nextLocId = tanker?.currentLocationId;

    const { error: tripError } = await supabase.from('trips').update({
      status: updatedTrip.status,
      diesel_issued: updatedTrip.dieselIssuedL,
      diesel_used: updatedTrip.dieselUsedL,
      remarks: updatedTrip.remarks
    }).eq('id', updatedTrip.id);

    if (tripError) throw tripError;

    await supabase.from('unloads').delete().eq('trip_id', updatedTrip.id);
    if (updatedTrip.unloads.length > 0) {
      await supabase.from('unloads').insert(updatedTrip.unloads.map((u, idx) => ({
        trip_id: updatedTrip.id,
        customer_id: u.customerId,
        quantity_mt: u.quantityMT,
        unloaded_at: u.unloadedAt,
        challan_number: u.challanNumber,
        actual_quantity_mt: u.actualQuantityMT !== undefined && u.actualQuantityMT !== null ? u.actualQuantityMT : null,
        sort_order: idx
      })));
    }

    if (updatedTrip.status === TripStatus.CLOSED) {
      nextTankerStatus = 'AVAILABLE';
      const lastStop = updatedTrip.unloads[updatedTrip.unloads.length - 1];
      if (lastStop) nextLocId = lastStop.customerId;
    }
    else if (updatedTrip.status === TripStatus.CANCELLED) {
      if (oldTripState && BLOCKING_STATUSES.includes(oldTripState.status)) {
        nextTankerStatus = 'AVAILABLE';
      }
    }
    else if (BLOCKING_STATUSES.includes(updatedTrip.status)) {
      nextTankerStatus = 'ON_TRIP';
      if (updatedTrip.status === TripStatus.LOADED_AT_SUPPLIER) {
        nextLocId = updatedTrip.supplierId;
      } else if (updatedTrip.status === TripStatus.PARTIALLY_UNLOADED) {
        const lastExecuted = [...updatedTrip.unloads].reverse().find(u => !!u.unloadedAt);
        if (lastExecuted) nextLocId = lastExecuted.customerId;
      }
    }

    if (tanker) {
      await supabase.from('tankers').update({
        current_location_id: nextLocId,
        status: nextTankerStatus
      }).eq('id', tanker.id);
    }

    await fetchData();
  };

  const getTripExpenses = (trip: Trip) => {
    const tanker = tankers.find(t => t.id === trip.tankerId);
    if (!tanker) return 0;

    const tripDate = new Date(trip.plannedStartDate).getTime();

    const findApprovedRateAtDate = (start: string, end: string) => {
      const ex = expenses.find(e => e.startLocationId === start && e.endLocationId === end);
      if (!ex || !ex.history || ex.history.length === 0) return 0;

      const validEntries = ex.history
        .filter(h => new Date(h.approvedAt).getTime() <= tripDate)
        .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());

      return validEntries.length > 0 ? validEntries[0].amount : 0;
    };

    let total = 0;
    total += findApprovedRateAtDate(tanker.currentLocationId, trip.supplierId);
    let prevId = trip.supplierId;
    trip.unloads.forEach(u => {
      if (u.customerId) {
        total += findApprovedRateAtDate(prevId, u.customerId);
        prevId = u.customerId;
      }
    });

    return total;
  };

  const addTanker = async (t: Tanker) => { await supabase.from('tankers').insert([t]); await fetchData(); };
  const updateTanker = async (t: Tanker) => { await supabase.from('tankers').update(t).eq('id', t.id); await fetchData(); };
  const deleteTanker = async (id: string) => { await supabase.from('tankers').delete().eq('id', id); await fetchData(); };
  const addSupplier = async (s: Supplier) => { await supabase.from('suppliers').insert([s]); await fetchData(); };
  const updateSupplier = async (s: Supplier) => { await supabase.from('suppliers').update(s).eq('id', s.id); await fetchData(); };
  const deleteSupplier = async (id: string) => { await supabase.from('suppliers').update({ is_operational: false }).eq('id', id); await fetchData(); };
  const addCustomer = async (c: Customer) => { await supabase.from('customers').insert([c]); await fetchData(); };
  const updateCustomer = async (c: Customer) => { await supabase.from('customers').update(c).eq('id', c.id); await fetchData(); };
  const deleteCustomer = async (id: string) => { await supabase.from('customers').update({ is_operational: false }).eq('id', id); await fetchData(); };
  const addUser = async (u: User) => { await supabase.from('users').insert([u]); await fetchData(); };
  const updateUser = async (u: User) => { await supabase.from('users').update(u).eq('id', u.id); await fetchData(); };
  const deleteUser = async (id: string) => { await supabase.from('users').delete().eq('id', id); await fetchData(); };
  const addExpense = async (e: RouteExpense) => { await supabase.from('route_expenses').insert([{ ...e, status: 'PENDING' }]); await fetchData(); };
  const updateExpense = async (e: RouteExpense) => { await supabase.from('route_expenses').update({ ...e, status: 'PENDING' }).eq('id', e.id); await fetchData(); };
  const deleteExpense = async (id: string) => { await supabase.from('route_expenses').delete().eq('id', id); await fetchData(); };
  const getActiveTripForTanker = (tankerId: string) => trips.find(t => t.tankerId === tankerId && BLOCKING_STATUSES.includes(t.status));

  return (
    <StoreContext.Provider value={{
      tankers, trips, suppliers, customers, users, currentUser, isAuthenticated, loading, expenses,
      login, logout, fetchData, addTrip, updateTrip, addTanker, updateTanker, deleteTanker,
      addSupplier, updateSupplier, deleteSupplier, addCustomer, updateCustomer, deleteCustomer,
      addUser, updateUser, deleteUser, addExpense, updateExpense, approveExpense, deleteExpense,
      getActiveTripForTanker, getTripExpenses
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useGlobalStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useGlobalStore must be used within a StoreProvider');
  return context;
};
