import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Armchair,
  IndianRupee,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
  Bell,
  RefreshCw,
  PlusCircle,
  FileText,
} from 'lucide-react';
import { api } from '../services/api.js';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [expirations, setExpirations] = useState<any[]>([]);
  const [recent, setRecent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, expirationsRes, recentRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/dashboard/expirations?days=15'),
        api.get('/dashboard/recent'),
      ]);

      setMetrics(metricsRes.data);
      setExpirations(expirationsRes.data.expirations);
      setRecent(recentRes.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getShiftIcon = (code: string) => {
    switch (code) {
      case 'MORNING':
        return <Sun className="w-5 h-5 text-amber-500" />;
      case 'AFTERNOON':
        return <Sunset className="w-5 h-5 text-orange-500" />;
      case 'EVENING':
        return <Moon className="w-5 h-5 text-indigo-400" />;
      default:
        return <Clock className="w-5 h-5 text-emerald-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Library Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time occupancy, fee collections, and student alerts</p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 shadow-sm transition disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/students?action=new"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Admission</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Students</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{metrics?.students?.total || 0}</p>
            <div className="flex items-center space-x-2 mt-2 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                {metrics?.students?.active || 0} Active
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {metrics?.students?.inactive || 0} Inactive
              </span>
            </div>
          </div>
        </div>

        {/* Total Seats */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Seats</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Armchair className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900">{metrics?.seats?.total || 0}</p>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>3 Shifts per seat</span>
              <Link to="/floors" className="text-emerald-600 font-medium hover:underline inline-flex items-center">
                Visual Plan &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Today's Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Collections</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-emerald-600">
              ₹{(metrics?.financials?.todayCollections || 0).toLocaleString('en-IN')}
            </p>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>{metrics?.financials?.todayPaymentsCount || 0} transactions</span>
              <span className="text-slate-400">
                Monthly: ₹{(metrics?.financials?.monthlyCollections || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Dues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Dues</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-rose-600">
              ₹{(metrics?.financials?.pendingFees || 0).toLocaleString('en-IN')}
            </p>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span>{metrics?.financials?.pendingInvoicesCount || 0} unpaid invoices</span>
              <Link to="/reminders" className="text-rose-600 font-medium hover:underline">
                Send Reminders &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Independent Shifts Occupancy Overview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Three Independent Shifts Status</h2>
            <p className="text-xs text-slate-500">Live seat utilization across Morning, Afternoon, and Evening slots</p>
          </div>
          <Link
            to="/floors"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center space-x-1"
          >
            <span>Open Interactive Floor Plan</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {metrics?.seats?.shiftWise?.map((shift: any) => (
            <div
              key={shift.shiftId}
              className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                    {getShiftIcon(shift.shiftCode)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{shift.shiftName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{shift.timing}</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-slate-900">{shift.occupancyRate}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${shift.occupancyRate}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-3 text-xs">
                <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{shift.bookedSeats} Booked (Green)</span>
                </div>
                <div className="flex items-center space-x-1.5 text-rose-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>{shift.availableSeats} Available (Red)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Upcoming Expirations & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Expirations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Upcoming Expirations</h2>
              <p className="text-xs text-slate-500">Memberships expiring in the next 15 days</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
              {expirations.length} Expiring
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-slate-100">
            {expirations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
                No memberships expiring in the next 15 days.
              </div>
            ) : (
              expirations.map((item) => {
                const daysLeft = Math.ceil(
                  (new Date(item.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={item.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <Link
                        to={`/students/${item.student.id}`}
                        className="font-bold text-slate-900 hover:text-emerald-600 transition"
                      >
                        {item.student.fullName}
                      </Link>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Seat: <span className="font-semibold text-slate-700">{item.seat.seatNumber}</span> ({item.shift.name})
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          daysLeft <= 3
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {daysLeft <= 0 ? 'Expires Today' : `${daysLeft} days left`}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(item.endDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity: Admissions & Payments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Collections & Admissions</h2>
              <p className="text-xs text-slate-500">Live operational ledger stream</p>
            </div>
            <Link to="/fees" className="text-xs font-semibold text-emerald-600 hover:underline">
              View All &rarr;
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-slate-100">
            {recent?.recentPayments?.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No recent transactions recorded.</div>
            ) : (
              recent?.recentPayments?.map((p: any) => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      ₹
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{p.student?.fullName}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.paymentMethod} • Ref: {p.receiptNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-emerald-600">
                      +₹{p.amount.toLocaleString('en-IN')}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

