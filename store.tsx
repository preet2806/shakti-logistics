
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Trip, Tanker, Supplier, Customer, User, Product, BLOCKING_STATUSES, TripStatus } from './types.ts';

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

      if (sRes.data) setSuppliers(sRes.data);
      if (cRes.data) setCustomers(cRes.data);
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
              selectedRoute: u.selected_route
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
        // Fixed: Use quantityMT instead of quantity_mt to match UnloadStop type
        quantity_mt: u.quantityMT,
        unloaded_at: u.unloadedAt,
        // Fixed: Use selectedRoute instead of selected_route to match UnloadStop type
        selected_route: u.selectedRoute,
        sort_order: idx
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
      loaded_distance: updatedTrip.loadedDistanceKm,
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
          // Fixed: Use selectedRoute instead of selected_route to match UnloadStop type
          selected_route: u.selectedRoute,
          sort_order: idx
        }));
        await supabase.from('unloads').insert(unloadRecords);
      }

      const tanker = tankers.find(t => t.id === updatedTrip.tankerId);
      if (tanker) {
        let newLoc = tanker.currentLocationId;
        let newStatus = tanker.status;

        if (updatedTrip.status === TripStatus.LOADED_AT_SUPPLIER) {
          newLoc = updatedTrip.supplierId;
          newStatus = 'ON_TRIP';
        } else if (updatedTrip.status === TripStatus.PARTIALLY_UNLOADED) {
          const last = updatedTrip.unloads.filter(u => u.unloadedAt).pop();
          if (last) newLoc = last.customerId;
        } else if (updatedTrip.status === TripStatus.CLOSED) {
          const last = updatedTrip.unloads[updatedTrip.unloads.length - 1];
          if (last) newLoc = last.customerId;
          newStatus = 'AVAILABLE';
        }
        await supabase.from('tankers').update({ current_location_id: newLoc, status: newStatus }).eq('id', tanker.id);
      }
    }
    await fetchData();
  };

  const addTanker = async (t: Tanker) => {
    await supabase.from('tankers').insert([{
      number: t.number,
      compatible_products: t.compatibleProducts,
      capacity_mt: t.capacityMT,
      diesel_avg: t.dieselAvgKmPerL,
      current_location_id: t.currentLocationId,
      status: t.status
    }]);
    await fetchData();
  };

  const updateTanker = async (t: Tanker) => {
    await supabase.from('tankers').update({
      number: t.number,
      compatible_products: t.compatibleProducts,
      capacity_mt: t.capacityMT,
      diesel_avg: t.dieselAvgKmPerL,
      current_location_id: t.currentLocationId,
      status: t.status
    }).eq('id', t.id);
    await fetchData();
  };

  const deleteTanker = async (id: string) => {
    await supabase.from('tankers').delete().eq('id', id);
    await fetchData();
  };

  const addSupplier = async (s: Supplier) => {
    await supabase.from('suppliers').insert([{ name: s.name, address: s.address, lat: s.lat, lng: s.lng }]);
    await fetchData();
  };

  const updateSupplier = async (s: Supplier) => {
    await supabase.from('suppliers').update({ name: s.name, address: s.address, lat: s.lat, lng: s.lng }).eq('id', s.id);
    await fetchData();
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    await fetchData();
  };

  const addCustomer = async (c: Customer) => {
    await supabase.from('customers').insert([{ name: c.name, address: c.address, lat: c.lat, lng: c.lng }]);
    await fetchData();
  };

  const updateCustomer = async (c: Customer) => {
    await supabase.from('customers').update({ name: c.name, address: c.address, lat: c.lat, lng: c.lng }).eq('id', c.id);
    await fetchData();
  };

  const deleteCustomer = async (id: string) => {
    await supabase.from('customers').delete().eq('id', id);
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
