
export const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  TRANSIT_TO_SUPPLIER: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  LOADED_AT_SUPPLIER: 'bg-amber-100 text-amber-700 font-bold border border-amber-300',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700 font-bold border border-indigo-300',
  PARTIALLY_UNLOADED: 'bg-purple-100 text-purple-700 font-bold border border-purple-300',
  CLOSED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700'
};
