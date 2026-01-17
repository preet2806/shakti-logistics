import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trip, Tanker, Supplier, Customer, User, Product, BLOCKING_STATUSES, TripStatus, Location } from './types.ts';
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
  getActiveTripForTanker: (tankerId: string) => Trip | undefined;
};

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tankers, setTankers] = useState<Tanker[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes, tRes, trRes, uRes, usrRes] = await Promise.all([
        supabase.from('suppliers').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('tankers').select('*'),
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('unloads').select('*').order('sort_order', { ascending: true }),
        supabase.from('users').select('*')
      ]);

      if (sRes.data) setSuppliers(sRes.data.map(s => ({ ...s, isOperational: s.is_operational !== false })));
      if (cRes.data) setCustomers(cRes.data.map(c => ({ ...c, isOperational: c.is_operational !== false })));
      if (usrRes.data) setUsers(usrRes.data);
      
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
        const mappedTrips: Trip[] = trRes.data.map(tr => {
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
        });
        setTrips(mappedTrips);
      }
    } catch (error) {
      console.error('Data Fetch Error:', error);
    }
  }, []);

  const recalculatePlannedTrips = async (tankerId: string, newLocationId: string, currentSuppliers: Supplier[], currentCustomers: Customer[]) => {
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
          const loadedDist = Number(trip.loaded_distance || 0);
          const totalDist = Number((optimal.distanceKm + loadedDist).toFixed(1));

          await supabase.from('trips').update({
            empty_route: optimal,
            empty_distance: optimal.distanceKm,
            total_distance: totalDist
          }).eq('id', trip.id);
        }
      }
    }
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
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', name)
        .eq('password', password)
        .single();

      if (error || !data) return false;

      localStorage.setItem('cryo_user', JSON.stringify(data));
      setCurrentUser(data);
      setIsAuthenticated(true);
      await fetchData();
      return true;
    } catch (e) {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('cryo_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setTankers([]);
    setTrips([]);
    setSuppliers([]);
    setCustomers([]);
  };

  const addTrip = async (trip: Trip) => {
    const tripId = trip.id;
    const { error: tripError } = await supabase.from('trips').insert([{
      id: tripId,
      tanker_id: trip.tankerId,
      product_id: trip.productId,
      supplier_id: trip.supplierId,
      planned_start_date: trip.plannedStartDate,
      status: trip.status,
      empty_route: trip.emptyRoute,
      diesel_issued: trip.dieselIssuedL,
      diesel_used: trip.dieselUsedL,
      empty_distance: trip.emptyDistanceKm,
      loaded_distance: trip.loadedDistanceKm,
      total_distance: trip.totalDistanceKm,
      remarks: trip.remarks,
      created_by: trip.createdBy
    }]);

    if (!tripError && trip.unloads.length > 0) {
      const unloadRecords = trip.unloads.map((u, idx) => ({
        trip_id: tripId,
        customer_id: u.customerId,
        quantity_mt: u.quantityMT,
        unloaded_at: u.unloadedAt,
        selected_route: u.selectedRoute, // Corrected to snake_case for DB
        sort_order: idx,
        challan_number: u.challanNumber,
        actual_quantity_mt: u.actualQuantityMT
      }));
      await supabase.from('unloads').insert(unloadRecords);
    }
    await fetchData();
  };

  const updateTrip = async (updatedTrip: Trip) => {
    const { error } = await supabase.from('trips').update({
      tanker_id: updatedTrip.tankerId,
      status: updatedTrip.status,
      empty_route: updatedTrip.emptyRoute,
      diesel_issued: updatedTrip.dieselIssuedL,
      diesel_used: updatedTrip.dieselUsedL,
      empty_distance: updatedTrip.emptyDistanceKm,
      loaded_distance: updatedTrip.loadedDistanceKm || 0,
      total_distance: updatedTrip.totalDistanceKm,
      remarks: updatedTrip.remarks
    }).eq('id', updatedTrip.id);

    if (!error) {
      await supabase.from('unloads').delete().eq('trip_id', updatedTrip.id);
      if (updatedTrip.unloads.length > 0) {
        const unloadRecords = updatedTrip.unloads.map((u, idx) => ({
          trip_id: updatedTrip.id,
          customer_id: u.customerId,
          quantity_mt: u.quantityMT,
          unloaded_at: u.unloadedAt,
          selected_route: u.selectedRoute, // Corrected to snake_case for DB
          sort_order: idx,
          challan_number: u.challanNumber,
          actual_quantity_mt: u.actualQuantityMT
        }));
        await supabase.from('unloads').insert(unloadRecords);
      }

      const tanker = tankers.find(t => t.id === updatedTrip.tankerId);
      if (tanker) {
        let newLocId = tanker.currentLocationId;
        let newStatus = tanker.status;

        if (updatedTrip.status === TripStatus.TRANSIT_TO_SUPPLIER) {
          newStatus = 'ON_TRIP';
        } else if (updatedTrip.status === TripStatus.LOADED_AT_SUPPLIER) {
          newLocId = updatedTrip.supplierId;
          newStatus = 'ON_TRIP';
        } else if (updatedTrip.status === TripStatus.PARTIALLY_UNLOADED) {
          const lastUnloaded = [...updatedTrip.unloads].reverse().find(u => !!u.unloadedAt);
          if (lastUnloaded) newLocId = lastUnloaded.customerId;
          newStatus = 'ON_TRIP';
        } else if (updatedTrip.status === TripStatus.CLOSED) {
          const last = updatedTrip.unloads[updatedTrip.unloads.length - 1];
          if (last) newLocId = last.customerId;
          newStatus = 'AVAILABLE';
        } else if (updatedTrip.status === TripStatus.CANCELLED) {
          newStatus = 'AVAILABLE';
        }

        if (newLocId !== tanker.currentLocationId || newStatus !== tanker.status) {
          await supabase.from('tankers').update({ 
            current_location_id: newLocId, 
            status: newStatus 
          }).eq('id', tanker.id);
          
          await recalculatePlannedTrips(tanker.id, newLocId, suppliers, customers);
        }
      }
    }
    await fetchData();
  };

  const addTanker = async (t: Tanker) => {
    const { error } = await supabase.from('tankers').insert([{
      number: t.number,
      compatible_products: t.compatibleProducts,
      capacity_mt: t.capacityMT,
      diesel_avg: t.dieselAvgKmPerL,
      current_location_id: t.currentLocationId,
      status: t.status
    }]);
    
    if (error) {
      console.error("Supabase Error Adding Tanker:", error.message);
      alert(`Database Error: ${error.message}`);
    }
    await fetchData();
  };

  const updateTanker = async (t: Tanker) => {
    const oldTanker = tankers.find(o => o.id === t.id);
    const { error } = await supabase.from('tankers').update({
      number: t.number,
      compatible_products: t.compatibleProducts,
      capacity_mt: t.capacityMT,
      diesel_avg: t.dieselAvgKmPerL,
      current_location_id: t.currentLocationId,
      status: t.status
    }).eq('id', t.id);

    if (error) {
      console.error("Supabase Error Updating Tanker:", error.message);
      alert(`Database Status Update Failed: ${error.message}. Please check if 'BREAKDOWN' is allowed in your database CHECK constraint.`);
      return;
    }

    if (t.status === 'BREAKDOWN') {
      const activeTrip = trips.find(tr => tr.tankerId === t.id && (BLOCKING_STATUSES as any[]).includes(tr.status));
      if (activeTrip) {
        const autoRemark = activeTrip.remarks 
          ? `${activeTrip.remarks} | AUTO-CANCELLED: Asset reported BREAKDOWN.` 
          : 'AUTO-CANCELLED: Asset reported BREAKDOWN.';
        await supabase.from('trips').update({ 
          status: TripStatus.CANCELLED,
          remarks: autoRemark
        }).eq('id', activeTrip.id);
      }
    }

    if (oldTanker && oldTanker.currentLocationId !== t.currentLocationId) {
      await recalculatePlannedTrips(t.id, t.currentLocationId, suppliers, customers);
    }

    await fetchData();
  };

  const deleteTanker = async (id: string) => {
    await supabase.from('tankers').delete().eq('id', id);
    await fetchData();
  };

  const addSupplier = async (s: Supplier) => {
    await supabase.from('suppliers').insert([{ name: s.name, address: s.address, lat: s.lat, lng: s.lng, is_operational: true }]);
    await fetchData();
  };

  const updateSupplier = async (s: Supplier) => {
    await supabase.from('suppliers').update({ 
      name: s.name, 
      address: s.address, 
      lat: s.lat, 
      lng: s.lng,
      is_operational: s.isOperational 
    }).eq('id', s.id);
    await fetchData();
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from('suppliers').update({ is_operational: false }).eq('id', id);
    await fetchData();
  };

  const addCustomer = async (c: Customer) => {
    await supabase.from('customers').insert([{ name: c.name, address: c.address, lat: c.lat, lng: c.lng, is_operational: true }]);
    await fetchData();
  };

  const updateCustomer = async (c: Customer) => {
    await supabase.from('customers').update({ 
      name: c.name, 
      address: c.address, 
      lat: c.lat, 
      lng: c.lng,
      is_operational: c.isOperational 
    }).eq('id', c.id);
    await fetchData();
  };

  const deleteCustomer = async (id: string) => {
    await supabase.from('customers').update({ is_operational: false }).eq('id', id);
    await fetchData();
  };

  const addUser = async (u: User) => {
    await supabase.from('users').insert([{ name: u.name, role: u.role, password: u.password }]);
    await fetchData();
  };

  const updateUser = async (u: User) => {
    await supabase.from('users').update({ name: u.name, role: u.role, password: u.password }).eq('id', u.id);
    await fetchData();
  };

  const deleteUser = async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
    await fetchData();
  };

  const getActiveTripForTanker = (tankerId: string) => {
    return trips.find(t => t.tankerId === tankerId && (BLOCKING_STATUSES as any[]).includes(t.status));
  };

  return (
    <StoreContext.Provider value={{
      tankers, trips, suppliers, customers, users, currentUser, isAuthenticated, loading,
      login, logout, fetchData, addTrip, updateTrip, addTanker, updateTanker, deleteTanker,
      addSupplier, updateSupplier, deleteSupplier, addCustomer, updateCustomer, deleteCustomer,
      addUser, updateUser, deleteUser, getActiveTripForTanker
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