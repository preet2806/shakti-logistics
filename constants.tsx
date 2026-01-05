
import { Product, Supplier, Customer, Tanker, User } from './types.ts';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Admin User', role: 'ADMIN' },
  { id: 'u2', name: 'Operator One', role: 'OPERATOR' }
];

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'Air Liquide Plant A', address: 'Industrial Zone, North', lat: 28.6139, lng: 77.2090 },
  { id: 's2', name: 'Linde Gas Hub', address: 'Sector 4, East Gate', lat: 19.0760, lng: 72.8777 }
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'City Hospital', address: 'Health Way, Main Road', lat: 28.5355, lng: 77.3910 },
  { id: 'c2', name: 'Industrial Steel Corp', address: 'Plot 45, MIDC', lat: 18.5204, lng: 73.8567 },
  { id: 'c3', name: 'Tech Park Research', address: 'Level 10, Hi-Tech City', lat: 17.3850, lng: 78.4867 }
];

export const MOCK_TANKERS: Tanker[] = [
  { id: 't1', number: 'HR-38-XY-1234', compatibleProducts: [Product.LN2, Product.LOX], capacityMT: 20, dieselAvgKmPerL: 3.5, currentLocationId: 's1', status: 'AVAILABLE' },
  { id: 't2', number: 'DL-1L-AA-5678', compatibleProducts: [Product.LAR, Product.LN2], capacityMT: 18, dieselAvgKmPerL: 4.0, currentLocationId: 'c1', status: 'AVAILABLE' },
  { id: 't3', number: 'MH-12-BB-9999', compatibleProducts: [Product.LOX, Product.LAR], capacityMT: 25, dieselAvgKmPerL: 3.2, currentLocationId: 's2', status: 'AVAILABLE' }
];

export const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  TENTATIVE: 'bg-slate-100 text-slate-700',
  LOADED_AT_SUPPLIER: 'bg-amber-100 text-amber-700 font-bold border border-amber-300',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700 font-bold border border-indigo-300',
  PARTIALLY_UNLOADED: 'bg-purple-100 text-purple-700 font-bold border border-purple-300',
  CLOSED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700'
};
