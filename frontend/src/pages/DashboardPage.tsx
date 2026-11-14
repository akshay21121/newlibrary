import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  Search,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api.js';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [expirations, setExpirations] = useState<any[]>([]);
  const [recent, setRecent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Drilldown Modal State
  const [drilldownType, setDrilldownType] = useState<
    | 'PENDING_DUES'
    | 'SHIFT_BOOKED'
    | 'SHIFT_AVAILABLE'
    | 'TODAY_COLLECTIONS'
    | 'EXPIRATIONS'
    | 'RECENT_ADMISSIONS'
    | 'RECENT_COLLECTIONS'
    | null
  >(null);
  const [drilldownShift, setDrilldownShift] = useState<any>(null);
  const [drilldownData, setDrilldownData] = useState<any>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [drilldownPage, setDrilldownPage] = useState(1);

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

  // Open drill-down data modal
  const openDrillDown = async (
    type:
      | 'PENDING_DUES'
      | 'SHIFT_BOOKED'
      | 'SHIFT_AVAILABLE'
      | 'TODAY_COLLECTIONS'
      | 'EXPIRATIONS'
      | 'RECENT_ADMISSIONS'
      | 'RECENT_COLLECTIONS',
    param?: any
  ) => {
    setDrilldownType(type);
    setDrilldownShift(param || null);
    setDrilldownLoading(true);
    setDrilldownSearch('');
    setDrilldownPage(1);

    try {
      let endpoint = '';
      if (type === 'PENDING_DUES') {
        endpoint = '/dashboard/drilldown/pending-dues';
      } else if (type === 'SHIFT_BOOKED') {
        endpoint = `/dashboard/drilldown/shift-occupancy/${param.shiftId}?type=BOOKED`;
      } else if (type === 'SHIFT_AVAILABLE') {
        endpoint = `/dashboard/drilldown/shift-occupancy/${param.shiftId}?type=AVAILABLE`;
      } else if (type === 'TODAY_COLLECTIONS') {
        endpoint = '/dashboard/drilldown/today-collections';
      } else if (type === 'EXPIRATIONS') {
        endpoint = '/dashboard/drilldown/expirations?days=15';
      } else if (type === 'RECENT_ADMISSIONS') {
        endpoint = '/dashboard/drilldown/recent-admissions';
      } else if (type === 'RECENT_COLLECTIONS') {
        endpoint = '/dashboard/drilldown/recent-collections';
      }

      const res = await api.get(endpoint);
      setDrilldownData(res.data);
    } catch (err) {
      console.error('Failed to load drilldown data', err);
    } finally {
      setDrilldownLoading(false);
    }
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

  // Drilldown Filter & Pagination
  const rawRecords = drilldownData?.records || [];
  const filteredRecords = rawRecords.filter((item: any) => {
    if (!drilldownSearch.trim()) return true;
    const q = drilldownSearch.toLowerCase();
    return (
      (item.studentName && item.studentName.toLowerCase().includes(q)) ||
      (item.fullName && item.fullName.toLowerCase().includes(q)) ||
      (item.admissionNumber && item.admissionNumber.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.seatNumber && item.seatNumber.toString().toLowerCase().includes(q)) ||
      (item.planName && item.planName.toLowerCase().includes(q)) ||
      (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
      (item.receiptNumber && item.receiptNumber.toLowerCase().includes(q)) ||
      (item.roomName && item.roomName.toLowerCase().includes(q))
    );
  });

  const pageSize = 10;
  const paginatedRecords = filteredRecords.slice((drilldownPage - 1) * pageSize, drilldownPage * pageSize);

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
        <div
          onClick={() => navigate('/students')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer transition group"
          title="Click to view all registered students"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition">
              Students
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900 group-hover:text-blue-700 transition">
              {metrics?.students?.total || 0}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/students?status=ACTIVE');
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition cursor-pointer"
                title="Filter active students"
              >
                {metrics?.students?.active || 0} Active
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/students?status=INACTIVE');
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition cursor-pointer"
                title="Filter inactive students"
              >
                {metrics?.students?.inactive || 0} Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Total Seats */}
        <div
          onClick={() => navigate('/floors')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-400 cursor-pointer transition group"
          title="Click to open Floor Plan & Seats"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition">
              Total Seats
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
              <Armchair className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-slate-900 group-hover:text-emerald-700 transition">
              {metrics?.seats?.total || 0}
            </p>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>3 Shifts per seat</span>
              <span className="text-emerald-600 font-medium group-hover:underline inline-flex items-center">
                Visual Plan &rarr;
              </span>
            </div>
          </div>
        </div>

        {/* Today's Collections */}
        <div
          onClick={() => openDrillDown('TODAY_COLLECTIONS')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-500 cursor-pointer transition group"
          title="Click to view today's collections drill-down"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition">
              Today's Collections
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-emerald-600 group-hover:underline">
              ₹{(metrics?.financials?.todayCollections || 0).toLocaleString('en-IN')}
            </p>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span className="font-semibold text-emerald-700">
                {metrics?.financials?.todayPaymentsCount || 0} transactions &rarr;
              </span>
              <span className="text-slate-400">
                Monthly: ₹{(metrics?.financials?.monthlyCollections || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Dues */}
        <div
          onClick={() => openDrillDown('PENDING_DUES')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-rose-400 cursor-pointer transition group"
          title="Click to view pending dues detailed breakdown"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-rose-600 transition">
              Pending Dues
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-rose-600 group-hover:underline">
              ₹{(metrics?.financials?.pendingFees || 0).toLocaleString('en-IN')}
            </p>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
              <span className="font-semibold text-rose-700">
                {metrics?.financials?.pendingInvoicesCount || 0} unpaid invoices &rarr;
              </span>
              <span className="text-rose-600 font-medium">View Breakdown &rarr;</span>
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
                <button
                  type="button"
                  onClick={() => openDrillDown('SHIFT_BOOKED', shift)}
                  className="text-sm font-extrabold text-slate-900 hover:text-emerald-600 cursor-pointer"
                  title="Click to view shift students"
                >
                  {shift.occupancyRate}%
                </button>
              </div>

              {/* Progress bar */}
              <div
                onClick={() => openDrillDown('SHIFT_BOOKED', shift)}
                className="w-full bg-slate-200 h-2.5 rounded-full mt-4 overflow-hidden cursor-pointer"
                title="Click to view occupancy"
              >
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${shift.occupancyRate}%` }}
                />
              </div>

              {/* Clickable Shift Occupancy Stats */}
              <div className="flex items-center justify-between mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => openDrillDown('SHIFT_BOOKED', shift)}
                  className="flex items-center space-x-1.5 text-emerald-700 font-semibold px-2 py-1 rounded-lg hover:bg-emerald-100/70 transition cursor-pointer"
                  title={`Click to view all ${shift.bookedSeats} booked students in ${shift.shiftName}`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="hover:underline">{shift.bookedSeats} Booked (Green)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDrillDown('SHIFT_AVAILABLE', shift)}
                  className="flex items-center space-x-1.5 text-rose-600 font-semibold px-2 py-1 rounded-lg hover:bg-rose-100/70 transition cursor-pointer"
                  title={`Click to view all ${shift.availableSeats} available seats in ${shift.shiftName}`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="hover:underline">{shift.availableSeats} Available (Red)</span>
                </button>
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
              <h2
                onClick={() => openDrillDown('EXPIRATIONS')}
                className="text-base font-bold text-slate-900 cursor-pointer hover:text-emerald-600 transition"
                title="Click to open full expirations drill-down"
              >
                Upcoming Expirations
              </h2>
              <p className="text-xs text-slate-500">Memberships expiring in the next 15 days</p>
            </div>
            <button
              onClick={() => openDrillDown('EXPIRATIONS')}
              className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold cursor-pointer transition"
              title="Click to view all upcoming expirations"
            >
              {expirations.length} Expiring &rarr;
            </button>
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
                  <div
                    key={item.id}
                    onClick={() => openDrillDown('EXPIRATIONS')}
                    className="py-3.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 px-2 rounded-xl transition"
                    title="Click to view detailed expiration drill-down"
                  >
                    <div>
                      <p className="font-bold text-slate-900 hover:text-emerald-600 transition">
                        {item.student.fullName}
                      </p>
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
            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => openDrillDown('RECENT_ADMISSIONS')}
                className="font-semibold text-slate-600 hover:text-emerald-600 hover:underline"
              >
                Admissions
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => openDrillDown('RECENT_COLLECTIONS')}
                className="font-semibold text-emerald-600 hover:underline"
              >
                View All Collections &rarr;
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-slate-100">
            {recent?.recentPayments?.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No recent transactions recorded.</div>
            ) : (
              recent?.recentPayments?.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => openDrillDown('RECENT_COLLECTIONS')}
                  className="py-3 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 px-2 rounded-xl transition"
                  title="Click to view full collections ledger"
                >
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

      {/* DETAILED DRILL-DOWN MODAL */}
      {drilldownType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* DRILLDOWN HEADER */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setDrilldownType(null)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </button>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {drilldownType === 'PENDING_DUES' && 'Pending Dues Breakdown'}
                      {drilldownType === 'SHIFT_BOOKED' && `${drilldownShift?.shiftName || 'Shift'} – Booked Students`}
                      {drilldownType === 'SHIFT_AVAILABLE' && `${drilldownShift?.shiftName || 'Shift'} – Available Seats`}
                      {drilldownType === 'TODAY_COLLECTIONS' && "Today's Payment Collections"}
                      {drilldownType === 'EXPIRATIONS' && 'Upcoming Membership Expirations'}
                      {drilldownType === 'RECENT_ADMISSIONS' && 'Complete Student Admissions'}
                      {drilldownType === 'RECENT_COLLECTIONS' && 'Complete Payment Collections Ledger'}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      Live Drill-Down
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {drilldownType === 'PENDING_DUES' && 'List of students with outstanding unpaid invoice balances'}
                    {drilldownType === 'SHIFT_BOOKED' && `Occupied seats and enrolled students in ${drilldownShift?.timing || ''}`}
                    {drilldownType === 'SHIFT_AVAILABLE' && `Vacant seats ready for admission in ${drilldownShift?.timing || ''}`}
                    {drilldownType === 'TODAY_COLLECTIONS' && 'Successful payment transactions received today'}
                    {drilldownType === 'EXPIRATIONS' && 'Memberships expiring in the next 15 days'}
                    {drilldownType === 'RECENT_ADMISSIONS' && 'All admitted students in reverse chronological order'}
                    {drilldownType === 'RECENT_COLLECTIONS' && 'All recorded payment transactions across all dates'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDrilldownType(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SUMMARY STATS BANNER */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
              {drilldownType === 'PENDING_DUES' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Pending Dues</span>
                    <span className="text-lg font-black text-rose-600">
                      ₹{(drilldownData?.totalPendingAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Students With Dues</span>
                    <span className="text-lg font-black text-slate-800">
                      {drilldownData?.totalStudents || 0} Students
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Unpaid Invoices</span>
                    <span className="text-lg font-black text-slate-800">
                      {drilldownData?.totalInvoices || 0} Invoices
                    </span>
                  </div>
                </div>
              )}

              {drilldownType === 'SHIFT_BOOKED' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Shift Occupancy</span>
                    <span className="text-lg font-black text-emerald-600">
                      {drilldownData?.totalBooked || 0} Booked Seats
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Unique Students</span>
                    <span className="text-lg font-black text-slate-800">
                      {drilldownData?.uniqueStudentsCount || 0} Students
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Slot Timing</span>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {drilldownShift?.timing}
                    </span>
                  </div>
                </div>
              )}

              {drilldownType === 'SHIFT_AVAILABLE' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Available Seats</span>
                    <span className="text-lg font-black text-rose-600">
                      {drilldownData?.totalAvailable || 0} Free Seats
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Shift Slot</span>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {drilldownShift?.shiftName} ({drilldownShift?.timing})
                    </span>
                  </div>
                </div>
              )}

              {drilldownType === 'TODAY_COLLECTIONS' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Today's Total Revenue</span>
                    <span className="text-lg font-black text-emerald-600">
                      ₹{(drilldownData?.totalAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Transactions Received</span>
                    <span className="text-lg font-black text-slate-800">
                      {drilldownData?.totalCount || 0} Payments
                    </span>
                  </div>
                </div>
              )}

              {drilldownType === 'EXPIRATIONS' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Expiring Memberships</span>
                    <span className="text-lg font-black text-amber-600">
                      {drilldownData?.totalCount || 0} Students
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Window</span>
                    <span className="text-xs font-bold text-slate-700">Next 15 Days</span>
                  </div>
                </div>
              )}

              {drilldownType === 'RECENT_ADMISSIONS' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Registered</span>
                    <span className="text-lg font-black text-slate-800">
                      {drilldownData?.totalCount || 0} Admissions
                    </span>
                  </div>
                </div>
              )}

              {drilldownType === 'RECENT_COLLECTIONS' && (
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Recorded Collections</span>
                    <span className="text-lg font-black text-emerald-600">
                      ₹{(drilldownData?.totalAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Receipts</span>
                    <span className="text-lg font-black text-slate-800">
                      {drilldownData?.totalCount || 0} Transactions
                    </span>
                  </div>
                </div>
              )}

              {/* SEARCH BOX */}
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={drilldownSearch}
                  onChange={(e) => {
                    setDrilldownSearch(e.target.value);
                    setDrilldownPage(1);
                  }}
                  placeholder="Filter records..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* TABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-6">
              {drilldownLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No matching records found.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    {/* TABLE HEADERS */}
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      {drilldownType === 'PENDING_DUES' && (
                        <tr>
                          <th className="py-3 px-3.5">Student Name</th>
                          <th className="py-3 px-3">Student ID</th>
                          <th className="py-3 px-3">Mobile No</th>
                          <th className="py-3 px-3">Seat No</th>
                          <th className="py-3 px-3">Membership Plan</th>
                          <th className="py-3 px-3 text-right">Total Fee</th>
                          <th className="py-3 px-3 text-right">Amount Paid</th>
                          <th className="py-3 px-3 text-right">Remaining Pending</th>
                          <th className="py-3 px-3">Invoice No</th>
                          <th className="py-3 px-3">Due Date</th>
                        </tr>
                      )}

                      {drilldownType === 'SHIFT_BOOKED' && (
                        <tr>
                          <th className="py-3 px-3.5">Student Name</th>
                          <th className="py-3 px-3">Student ID</th>
                          <th className="py-3 px-3">Seat No</th>
                          <th className="py-3 px-3">Access / Plan</th>
                          <th className="py-3 px-3">Admission Date</th>
                          <th className="py-3 px-3">Expiry Date</th>
                          <th className="py-3 px-3">Payment Status</th>
                          <th className="py-3 px-3 text-right">Pending Amount</th>
                        </tr>
                      )}

                      {drilldownType === 'SHIFT_AVAILABLE' && (
                        <tr>
                          <th className="py-3 px-3.5">Seat Number</th>
                          <th className="py-3 px-3">Room</th>
                          <th className="py-3 px-3">Floor</th>
                          <th className="py-3 px-3">Seat Type</th>
                          <th className="py-3 px-3">Shift Status</th>
                          <th className="py-3 px-3 text-right">Action</th>
                        </tr>
                      )}

                      {drilldownType === 'TODAY_COLLECTIONS' && (
                        <tr>
                          <th className="py-3 px-3.5">Student Name</th>
                          <th className="py-3 px-3">Student ID</th>
                          <th className="py-3 px-3">Amount Received</th>
                          <th className="py-3 px-3">Payment Method</th>
                          <th className="py-3 px-3">Date & Time</th>
                          <th className="py-3 px-3">Invoice Number</th>
                          <th className="py-3 px-3">Receipt Number</th>
                        </tr>
                      )}

                      {drilldownType === 'EXPIRATIONS' && (
                        <tr>
                          <th className="py-3 px-3.5">Student Name</th>
                          <th className="py-3 px-3">Admission No</th>
                          <th className="py-3 px-3">Mobile Number</th>
                          <th className="py-3 px-3">Seat No</th>
                          <th className="py-3 px-3">Plan</th>
                          <th className="py-3 px-3">Expiry Date</th>
                          <th className="py-3 px-3">Payment Status</th>
                          <th className="py-3 px-3 text-right">Action</th>
                        </tr>
                      )}

                      {drilldownType === 'RECENT_ADMISSIONS' && (
                        <tr>
                          <th className="py-3 px-3.5">Student Name</th>
                          <th className="py-3 px-3">Admission No</th>
                          <th className="py-3 px-3">Mobile No</th>
                          <th className="py-3 px-3">Seat No</th>
                          <th className="py-3 px-3">Shift</th>
                          <th className="py-3 px-3">Plan</th>
                          <th className="py-3 px-3">Admission Date</th>
                          <th className="py-3 px-3">Status</th>
                        </tr>
                      )}

                      {drilldownType === 'RECENT_COLLECTIONS' && (
                        <tr>
                          <th className="py-3 px-3.5">Student Name</th>
                          <th className="py-3 px-3">Student ID</th>
                          <th className="py-3 px-3">Amount Received</th>
                          <th className="py-3 px-3">Payment Mode</th>
                          <th className="py-3 px-3">Payment Date</th>
                          <th className="py-3 px-3">Invoice No</th>
                          <th className="py-3 px-3">Receipt No</th>
                        </tr>
                      )}
                    </thead>

                    {/* TABLE ROWS */}
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {drilldownType === 'PENDING_DUES' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.invoiceId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5 font-bold text-slate-900">{r.studentName}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.admissionNumber}</td>
                            <td className="py-3 px-3 text-slate-600">{r.phone}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-800">#{r.seatNumber}</td>
                            <td className="py-3 px-3 text-slate-700">{r.planName}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">₹{r.totalFee}</td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-600 font-semibold">₹{r.paidAmount}</td>
                            <td className="py-3 px-3 text-right font-mono text-rose-600 font-black">₹{r.pendingAmount}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.invoiceNumber}</td>
                            <td className="py-3 px-3 text-slate-600">
                              {new Date(r.dueDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                          </tr>
                        ))}

                      {drilldownType === 'SHIFT_BOOKED' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.bookingId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5">
                              <span className="font-bold text-slate-900 block">{r.studentName}</span>
                              <span className="text-[10px] text-slate-400">{r.phone}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.admissionNumber}</td>
                            <td className="py-3 px-3 font-mono font-extrabold text-slate-900">#{r.seatNumber}</td>
                            <td className="py-3 px-3">
                              <span className="text-slate-800 block font-semibold">{r.planName}</span>
                              {r.isFullDay && (
                                <span className="inline-block px-1.5 py-0.2 bg-purple-100 text-purple-700 text-[9px] font-black rounded mt-0.5">
                                  FULL-DAY ({r.accessType === 'FULL_DAY_DEDICATED' ? 'DEDICATED' : 'FLEXIBLE'})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {new Date(r.admissionDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {new Date(r.endDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : r.paymentStatus === 'PARTIALLY_PAID'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {r.paymentStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                              {r.pendingAmount > 0 ? `₹${r.pendingAmount}` : '₹0'}
                            </td>
                          </tr>
                        ))}

                      {drilldownType === 'SHIFT_AVAILABLE' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.seatId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5 font-mono font-extrabold text-slate-900 text-sm">#{r.seatNumber}</td>
                            <td className="py-3 px-3 text-slate-700">{r.roomName}</td>
                            <td className="py-3 px-3 text-slate-600">{r.floorName}</td>
                            <td className="py-3 px-3 text-slate-600 text-[11px] font-bold">{r.type}</td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
                                AVAILABLE (RED)
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Link
                                to="/students?action=new"
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 text-[11px] transition inline-block"
                              >
                                Assign Seat &rarr;
                              </Link>
                            </td>
                          </tr>
                        ))}

                      {drilldownType === 'TODAY_COLLECTIONS' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.paymentId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5">
                              <span className="font-bold text-slate-900 block">{r.studentName}</span>
                              <span className="text-[10px] text-slate-400">{r.phone}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.admissionNumber}</td>
                            <td className="py-3 px-3 font-mono font-black text-emerald-600 text-sm">
                              ₹{r.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-[10px]">
                                {r.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {new Date(r.paymentDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.invoiceNumber}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-800">{r.receiptNumber}</td>
                          </tr>
                        ))}

                      {drilldownType === 'EXPIRATIONS' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.bookingId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5 font-bold text-slate-900">{r.studentName}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.admissionNumber}</td>
                            <td className="py-3 px-3 text-slate-600">{r.phone}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              #{r.seatNumber} ({r.shiftName})
                            </td>
                            <td className="py-3 px-3 text-slate-700">{r.planName}</td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 block">
                                {new Date(r.endDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="text-[10px] text-amber-600 font-bold">
                                {r.daysLeft <= 0 ? 'Expires Today' : `${r.daysLeft} days left`}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {r.paymentStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Link
                                to={`/students/${r.studentId}`}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 text-[11px] transition inline-block"
                              >
                                Renew &rarr;
                              </Link>
                            </td>
                          </tr>
                        ))}

                      {drilldownType === 'RECENT_ADMISSIONS' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.studentId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5 font-bold text-slate-900">{r.fullName}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.admissionNumber}</td>
                            <td className="py-3 px-3 text-slate-600">{r.phone}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">#{r.seatNumber}</td>
                            <td className="py-3 px-3 text-slate-700">{r.shiftName}</td>
                            <td className="py-3 px-3 text-slate-700">{r.planName}</td>
                            <td className="py-3 px-3 text-slate-600">
                              {new Date(r.admissionDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}

                      {drilldownType === 'RECENT_COLLECTIONS' &&
                        paginatedRecords.map((r: any) => (
                          <tr key={r.paymentId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3.5">
                              <span className="font-bold text-slate-900 block">{r.studentName}</span>
                              <span className="text-[10px] text-slate-400">{r.phone}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.admissionNumber}</td>
                            <td className="py-3 px-3 font-mono font-black text-emerald-600">
                              ₹{r.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-[10px]">
                                {r.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {new Date(r.paymentDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{r.invoiceNumber}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-800">{r.receiptNumber}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* DRILLDOWN FOOTER WITH PAGINATION */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {Math.min(filteredRecords.length, (drilldownPage - 1) * pageSize + 1)} to{' '}
                {Math.min(filteredRecords.length, drilldownPage * pageSize)} of {filteredRecords.length} records
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDrilldownPage(Math.max(1, drilldownPage - 1))}
                  disabled={drilldownPage === 1}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold"
                >
                  Previous
                </button>
                <span className="font-bold text-slate-800">
                  Page {drilldownPage} of {Math.max(1, Math.ceil(filteredRecords.length / pageSize))}
                </span>
                <button
                  onClick={() =>
                    setDrilldownPage(
                      Math.min(Math.ceil(filteredRecords.length / pageSize), drilldownPage + 1)
                    )
                  }
                  disabled={drilldownPage >= Math.ceil(filteredRecords.length / pageSize)}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
