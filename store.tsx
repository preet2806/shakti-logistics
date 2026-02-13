
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trip, Tanker, Supplier, Customer, User, Product, BLOCKING_STATUSES, TripStatus, Location, RouteExpense } from './types.ts';
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
      const [sRes, cRes, tRes, trRes, uRes, usrRes, exRes] = await Promise.all([
        supabase.from('suppliers').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('tankers').select('*'),
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('unloads').select('*').order('sort_order', { ascending: true }),
        supabase.from('users').select('*'),
        supabase.from('route_expenses').select('*')
      ]);

      if (sRes.data) setSuppliers(sRes.data.map(s => ({ ...s, isOperational: s.is_operational !== false })));
      if (cRes.data) setCustomers(cRes.data.map(c => ({ ...c, isOperational: c.is_operational !== false })));
      if (usrRes.data) setUsers(usrRes.data);
      if (exRes.data) setExpenses(exRes.data.map(e => ({
        id: e.id,
        startLocationId: e.start_location_id,
        endLocationId: e.end_location_id,
        items: e.items || [],
        totalAmount: e.total_amount || 0
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

  const recalculatePlannedTripsInBackground = async (tankerId: string, newLocationId: string, currentSuppliers: Supplier[], currentCustomers: Customer[]) => {
    const allLocs = [...currentSuppliers, ...currentCustomers];
    const newLoc = allLocs.find(l => l.id === newLocationId);
    if (!newLoc) return;

    const { data: plannedTrips } = await supabase
      .from('trips')
      .select('*')
      .eq('tanker_id', tankerId)
      .eq('status', TripStatus.PLANNED);

    if (!plannedTrips || plannedTrips.length === 0) return;

    for (const trip of plannedTrips) {
      const plant = currentSuppliers.find(s => s.id === trip.supplier_id);
      if (plant) {
        const routes = await fetchRoutes(newLoc.lat, newLoc.lng, plant.lat, plant.lng);
        if (routes.length > 0) {
          const optimal = routes[0];
          await supabase.from('trips').update({
            empty_route: optimal,
            empty_distance: optimal.distanceKm,
            total_distance: Number((optimal.distanceKm + Number(trip.loaded_distance || 0)).toFixed(1))
          }).eq('id', trip.id);
        }
      }
    }
    await fetchData();
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('cryo_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
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
    const { data, error } = await supabase.from('users').select('*').eq('name', name).eq('password', password).single();
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
    // 1. Update Trip Record
    const { error: tripError } = await supabase.from('trips').update({
      status: updatedTrip.status,
      diesel_issued: updatedTrip.dieselIssuedL,
      diesel_used: updatedTrip.dieselUsedL,
      remarks: updatedTrip.remarks
    }).eq('id', updatedTrip.id);

    if (tripError) throw tripError;

    // 2. Sync Unloads
    await supabase.from('unloads').delete().eq('trip_id', updatedTrip.id);
    if (updatedTrip.unloads.length > 0) {
      await supabase.from('unloads').insert(updatedTrip.unloads.map((u, idx) => ({
        trip_id: updatedTrip.id,
        customer_id: u.customerId,
        quantity_mt: u.quantityMT,
        unloaded_at: u.unloadedAt,
        challan_number: u.challanNumber,
        actual_quantity_mt: u.actualQuantityMT,
        sort_order: idx
      })));
    }

    // 3. Update Tanker Asset position
    const tanker = tankers.find(t => t.id === updatedTrip.tankerId);
    let newLocId = tanker?.currentLocationId;
    let newStatus = updatedTrip.status === TripStatus.CLOSED ? 'AVAILABLE' : 'ON_TRIP';

    if (updatedTrip.status === TripStatus.LOADED_AT_SUPPLIER) newLocId = updatedTrip.supplierId;
    else if (updatedTrip.status === TripStatus.PARTIALLY_UNLOADED) {
        const last = [...updatedTrip.unloads].reverse().find(u => !!u.unloadedAt);
        if (last) newLocId = last.customerId;
    } else if (updatedTrip.status === TripStatus.CLOSED) {
        const last = updatedTrip.unloads[updatedTrip.unloads.length - 1];
        if (last) newLocId = last.customerId;
    }

    if (tanker) {
      await supabase.from('tankers').update({
        current_location_id: newLocId,
        status: newStatus
      }).eq('id', tanker.id);

      if (newLocId !== tanker.currentLocationId) {
        recalculatePlannedTripsInBackground(tanker.id, newLocId!, suppliers, customers);
      }
    }

    // 4. Instant State Update
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
    if (tanker) {
      setTankers(prev => prev.map(t => t.id === tanker.id ? { ...t, currentLocationId: newLocId!, status: newStatus as any } : t));
    }
  };

  const getTripExpenses = (trip: Trip) => {
    const tanker = tankers.find(t => t.id === trip.tankerId);
    if (!tanker) return 0;

    let total = 0;
    const findRate = (start: string, end: string) => {
      const ex = expenses.find(e => e.startLocationId === start && e.endLocationId === end);
      return ex?.totalAmount || 0;
    };

    total += findRate(tanker.currentLocationId, trip.supplierId);
    let prevId = trip.supplierId;
    trip.unloads.forEach(u => {
      if (u.customerId) {
        total += findRate(prevId, u.customerId);
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
  const addExpense = async (e: RouteExpense) => { await supabase.from('route_expenses').insert([{ ...e }]); await fetchData(); };
  const updateExpense = async (e: RouteExpense) => { await supabase.from('route_expenses').update({ ...e }).eq('id', e.id); await fetchData(); };
  const deleteExpense = async (id: string) => { await supabase.from('route_expenses').delete().eq('id', id); await fetchData(); };
  const getActiveTripForTanker = (tankerId: string) => trips.find(t => t.tankerId === tankerId && BLOCKING_STATUSES.includes(t.status));

  return (
    <StoreContext.Provider value={{
      tankers, trips, suppliers, customers, users, currentUser, isAuthenticated, loading, expenses,
      login, logout, fetchData, addTrip, updateTrip, addTanker, updateTanker, deleteTanker,
      addSupplier, updateSupplier, deleteSupplier, addCustomer, updateCustomer, deleteCustomer,
      addUser, updateUser, deleteUser, addExpense, updateExpense, deleteExpense,
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
