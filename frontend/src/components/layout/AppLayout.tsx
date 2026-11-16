import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Armchair,
  Users,
  CreditCard,
  BellRing,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const AppLayout: React.FC = () => {
  const { admin, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/floors', label: 'Floor Plan & Seats', icon: Armchair },
    { to: '/students', label: 'Students', icon: Users },
    { to: '/fees', label: 'Fees & Invoices', icon: CreditCard },
    { to: '/reminders', label: 'Reminders', icon: BellRing },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Library Settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar - 100% Fixed to Viewport */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 shrink-0 select-none fixed top-0 bottom-0 left-0 h-screen z-40">
        {/* Brand Header - Fixed at Top */}
        <div className="h-16 shrink-0 flex items-center px-5 border-b border-slate-800 space-x-3 bg-slate-950">
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 border border-slate-700 shadow-md shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950 shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="truncate">
            <h1 className="font-bold text-base tracking-tight text-white leading-tight truncate">
              {profile?.projectDisplayName || profile?.name || 'Apex Library'}
            </h1>
            <p className="text-[11px] text-emerald-400 font-medium truncate">
              {profile?.tagline || 'Single-Admin Portal'}
            </p>
          </div>
        </div>

        {/* Navigation Links - Independently Scrollable */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Admin Profile & Logout - Fixed at Bottom */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              {admin?.avatarUrl ? (
                <img
                  src={admin.avatarUrl}
                  alt={admin.name}
                  className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-emerald-400 font-semibold text-sm">
                  {admin?.name?.charAt(0) || 'A'}
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{admin?.name || 'Administrator'}</p>
                <p className="text-[11px] text-slate-400 truncate">{admin?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header - Sticky */}
      <div className="md:hidden sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-4 h-16 shrink-0">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="truncate">
            <h1 className="font-bold text-sm text-white leading-tight truncate">
              {profile?.projectDisplayName || profile?.name || 'Apex Library'}
            </h1>
            <p className="text-[10px] text-emerald-400 truncate">
              {profile?.tagline || 'Admin Portal'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">{admin?.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-rose-400 flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - Pushed by 64 (256px) on desktop to prevent overlap */}
      <main className="flex-1 min-h-screen md:pl-64 overflow-x-hidden w-full max-w-full">
        <Outlet />
      </main>
    </div>
  );
};

