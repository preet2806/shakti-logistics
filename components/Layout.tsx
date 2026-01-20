
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Truck, 
  MapPin, 
  Users, 
  FileText, 
  Settings,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  BookOpen,
  UserCog,
  Receipt
} from 'lucide-react';
import { User } from '../types';
import { useGlobalStore } from '../store.tsx';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

export const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const location = useLocation();
  const { logout } = useGlobalStore();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Trips', path: '/trips', icon: Truck },
    { label: 'Tankers', path: '/masters/tankers', icon: Settings },
    { label: 'Locations', path: '/masters/locations', icon: MapPin },
    { label: 'Expenses', path: '/masters/expenses', icon: Receipt },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Profile', path: '/profile', icon: UserCog }
  ];

  if (user.role === 'ADMIN') {
    navItems.push({ label: 'Users', path: '/users', icon: Users });
  }

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out flex flex-col shrink-0 relative z-20`}
      >
        <div className="h-20 flex items-center justify-between px-6 bg-slate-950/50 border-b border-slate-800">
          <div className={`flex items-center gap-4 overflow-hidden ${!isSidebarOpen && 'justify-center w-full'}`}>
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-600/20">
              <Truck size={24} />
            </div>
            {isSidebarOpen && <span className="font-black text-white text-xl tracking-tighter uppercase">Shakti</span>}
          </div>
        </div>

        <nav className="flex-1 mt-8 px-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={22} className="shrink-0" />
              {isSidebarOpen && <span className="font-black text-[11px] uppercase tracking-widest">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <Link to="/profile" className={`flex items-center gap-4 p-4 bg-slate-800/50 rounded-2xl hover:bg-slate-800 transition-all ${!isSidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 shrink-0 border border-slate-700">
              <UserIcon size={20} />
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user.name}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em]">{user.role}</p>
              </div>
            )}
          </Link>
          
          <button 
            onClick={logout}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut size={22} className="shrink-0" />
            {isSidebarOpen && <span className="font-black text-[11px] uppercase tracking-widest">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-3 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fleet Status</span>
               <span className="text-xs font-black text-emerald-600 uppercase">Operational Green</span>
            </div>
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          {children}
        </div>
      </main>
    </div>
  );
};
