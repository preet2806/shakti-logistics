
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useGlobalStore } from './store.tsx';
import { Dashboard } from './pages/Dashboard';
import { TripList } from './pages/TripList';
import { TripForm } from './pages/TripForm';
import { Reports } from './pages/Reports';
import { TankerMaster } from './pages/TankerMaster';
import { LocationMaster } from './pages/LocationMaster';
import { ExpenseMaster } from './pages/ExpenseMaster';
import { UserMaster } from './pages/UserMaster';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';

const App: React.FC = () => {
  const { currentUser, isAuthenticated, loading } = useGlobalStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto shadow-2xl shadow-blue-600/20"></div>
          <div>
            <p className="font-black tracking-[0.3em] uppercase text-xs">Synchronizing</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Fleet Intelligence Network</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Login />;
  }

  return (
    <HashRouter>
      <Layout user={currentUser}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trips" element={<TripList />} />
          <Route path="/trips/new" element={<TripForm />} />
          <Route path="/trips/:id" element={<TripForm />} />
          <Route path="/masters/tankers" element={<TankerMaster />} />
          <Route path="/masters/locations" element={<LocationMaster />} />
          <Route path="/masters/expenses" element={<ExpenseMaster />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin Protected Route */}
          {currentUser.role === 'ADMIN' ? (
            <Route path="/users" element={<UserMaster />} />
          ) : (
            <Route path="/users" element={<Navigate to="/" replace />} />
          )}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
