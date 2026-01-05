
export type UserRole = 'ADMIN' | 'OPERATOR';

export type User = {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
};

export const Product = {
  LN2: 'Liquid Nitrogen (LN₂)',
  LOX: 'Liquid Oxygen (LOX)',
  LAR: 'Liquid Argon (LAR)'
} as const;

export type Product = (typeof Product)[keyof typeof Product];

export type Location = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type Supplier = Location;
export type Customer = Location;

export type Tanker = {
  id: string;
  number: string;
  compatibleProducts: Product[];
  capacityMT: number;
  dieselAvgKmPerL: number;
  currentLocationId: string;
  status: 'AVAILABLE' | 'ON_TRIP';
};

export const TripStatus = {
  PLANNED: 'PLANNED',
  TENTATIVE: 'TENTATIVE',
  LOADED_AT_SUPPLIER: 'LOADED_AT_SUPPLIER',
  IN_TRANSIT: 'IN_TRANSIT',
  // Fixed syntax error: changed = to :
  PARTIALLY_UNLOADED: 'PARTIALLY_UNLOADED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
} as const;

export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

export const BLOCKING_STATUSES: TripStatus[] = [
  'LOADED_AT_SUPPLIER',
  'IN_TRANSIT',
  'PARTIALLY_UNLOADED'
];

export type RouteData = {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][]; // Array of [lat, lng]
  summary: string;
};

export type UnloadStop = {
  customerId: string;
  quantityMT: number;
  unloadedAt?: string;
  selectedRoute?: RouteData;
};

export type Trip = {
  id: string;
  tankerId: string;
  productId: Product;
  supplierId: string;
  plannedStartDate: string;
  actualEndDate?: string;
  status: TripStatus;
  
  emptyRoute?: RouteData;
  unloads: UnloadStop[];
  totalLoadedMT: number;
  
  dieselIssuedL: number;
  dieselUsedL: number;
  emptyDistanceKm: number;
  loadedDistanceKm: number;
  totalDistanceKm: number;
  
  manualDistanceOverride?: boolean;
  manualDieselOverride?: boolean;
  
  remarks: string;
  createdBy: string;
};