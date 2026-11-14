import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  IndianRupee,
  Calendar,
  AlertTriangle,
  Armchair,
  PieChart,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../services/api.js';

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<
    'COLLECTIONS' | 'MONTHLY' | 'PAYMENT_MODES' | 'DEFAULTERS' | 'OCCUPANCY'
  >('COLLECTIONS');

  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeReport === 'COLLECTIONS') {
        const res = await api.get('/reports/daily-collections?days=30');
        setDailyData(res.data.collections);
      } else if (activeReport === 'MONTHLY') {
        const res = await api.get('/reports/monthly-collections');
        setMonthlyData(res.data.monthly);
      } else if (activeReport === 'PAYMENT_MODES') {
        const res = await api.get('/reports/payment-modes');
        setPaymentModes(res.data.breakdown);
      } else if (activeReport === 'DEFAULTERS') {
        const res = await api.get('/reports/defaulters');
        setDefaulters(res.data.defaulters);
      } else if (activeReport === 'OCCUPANCY') {
        const res = await api.get('/reports/occupancy');
        setOccupancy(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (reportType: string) => {
    const token = localStorage.getItem('library_admin_token');
    const url = `/api/reports/export/${reportType}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Financial auditing, defaulters register, shift occupancy meters, and streamable CSV exports
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              downloadCsv(
                activeReport === 'COLLECTIONS' || activeReport === 'MONTHLY'
                  ? 'collections'
                  : activeReport === 'DEFAULTERS'
                  ? 'defaulters'
                  : 'students'
              )
            }
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold">
        {[
          { key: 'COLLECTIONS', label: 'Daily Collections' },
          { key: 'MONTHLY', label: 'Monthly Growth' },
          { key: 'PAYMENT_MODES', label: 'Payment Modes' },
          { key: 'DEFAULTERS', label: 'Overdue Defaulters' },
          { key: 'OCCUPANCY', label: 'Shift Occupancy' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveReport(tab.key as any)}
            className={`px-3.5 py-2 rounded-xl transition ${
              activeReport === tab.key
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: DAILY COLLECTIONS */}
          {activeReport === 'COLLECTIONS' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Transactions</th>
                    <th className="py-3.5 px-4">Cash Received</th>
                    <th className="py-3.5 px-4">UPI / Digital</th>
                    <th className="py-3.5 px-4 text-right">Daily Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        No transactions recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    dailyData.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">{d.date}</td>
                        <td className="py-3 px-4 text-slate-600">{d.count} payments</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          ₹{(d.byMethod?.CASH || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-emerald-600">
                          ₹{(d.byMethod?.UPI || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 text-right text-sm">
                          ₹{d.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: MONTHLY COLLECTIONS */}
          {activeReport === 'MONTHLY' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Monthly Revenue Trajectory</h3>
              <div className="space-y-4">
                {monthlyData.map((m) => (
                  <div key={m.month} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{m.month}</span>
                      <span>₹{m.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (m.totalAmount / 50000) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{m.count} total payments logged</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT MODES */}
          {activeReport === 'PAYMENT_MODES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paymentModes.map((pm) => (
                <div
                  key={pm.method}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {pm.method}
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">
                      ₹{pm.totalAmount.toLocaleString('en-IN')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{pm.count} total transactions</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl">
                    ₹
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: DEFAULTERS */}
          {activeReport === 'DEFAULTERS' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Admission No.</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Overdue Days</th>
                    <th className="py-3.5 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaulters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        Zero overdue accounts. Outstanding dues are clear!
                      </td>
                    </tr>
                  ) : (
                    defaulters.map((d) => (
                      <tr key={d.invoiceId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{d.studentName}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                          {d.admissionNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{d.phone}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{d.invoiceNumber}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(d.dueDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-bold text-rose-600">{d.daysOverdue} days</td>
                        <td className="py-3 px-4 font-black text-rose-600 text-right text-sm">
                          ₹{d.balanceAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: OCCUPANCY */}
          {activeReport === 'OCCUPANCY' && occupancy && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {occupancy.shiftOccupancy?.map((sh: any) => (
                <div
                  key={sh.shiftId}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{sh.shiftName}</h3>
                      <p className="text-xs text-slate-400">{sh.timing}</p>
                    </div>
                    <span className="text-lg font-black text-emerald-600">
                      {sh.occupancyPercentage}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full"
                      style={{ width: `${sh.occupancyPercentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs pt-2 border-t border-slate-100 font-semibold">
                    <span className="text-emerald-600">{sh.bookedSeats} Booked</span>
                    <span className="text-rose-600">{sh.availableSeats} Available</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

