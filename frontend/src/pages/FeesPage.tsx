import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  PlusCircle,
  IndianRupee,
  Search,
  Filter,
  FileText,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  Eye,
  ShieldCheck,
  Edit2,
  Trash2,
  Tag,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Layers,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Invoice, Payment, FeePlan, Shift } from '../types/index.js';

export const FeesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'PLANS'>('INVOICES');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [page, setPage] = useState(1);

  // Invoices Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Plans Sub-tab & Filters
  const [planCategoryTab, setPlanCategoryTab] = useState<'SHIFT_BASED' | 'FULL_DAY'>('SHIFT_BASED');
  const [planShiftFilter, setPlanShiftFilter] = useState('');
  const [planAccessTypeFilter, setPlanAccessTypeFilter] = useState('');
  const [planDurationFilter, setPlanDurationFilter] = useState('');
  const [planStatusFilter, setPlanStatusFilter] = useState('');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'NET_BANKING'>('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  // Reversal Modal
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Printable Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptFormat, setReceiptFormat] = useState<'STANDARD' | 'THERMAL'>('STANDARD');

  // New / Edit Fee Plan Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    category: 'SHIFT_BASED' as 'SHIFT_BASED' | 'FULL_DAY',
    planType: 'SHIFT_BASED',
    accessType: 'SHIFT' as 'SHIFT' | 'FULL_DAY_DEDICATED' | 'FULL_DAY_FLEXIBLE',
    shiftId: '',
    durationMonths: 1,
    durationDays: 30,
    originalPrice: 1000,
    price: 900,
    hasDiscount: true,
    discountType: 'FIXED' as 'FIXED' | 'PERCENTAGE',
    discountValue: 100,
    discountValidUntil: '',
    admissionFee: 200,
    description: '',
    isActive: true,
  });

  useEffect(() => {
    fetchInvoices();
    fetchFeePlans();
    fetchShifts();
  }, [page, statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/fees/invoices?page=${page}&limit=15&status=${statusFilter}&search=${encodeURIComponent(search)}`
      );
      setInvoices(res.data.invoices);
      setTotalInvoices(res.data.pagination.total);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeePlans = async () => {
    try {
      const res = await api.get('/fees/plans');
      setFeePlans(res.data.plans);
    } catch (err) {
      console.error('Failed to load fee plans', err);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await api.get('/settings/shifts');
      setShifts(res.data.shifts);
    } catch (err) {
      console.error('Failed to load shifts', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  // Open Payment Modal
  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.balanceAmount);
    setTransactionRef('');
    setPaymentRemarks('');
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      const res = await api.post('/fees/payments', {
        invoiceId: selectedInvoice.id,
        amount: Number(paymentAmount),
        paymentMethod,
        transactionRef: transactionRef || undefined,
        remarks: paymentRemarks || undefined,
      });

      setShowPaymentModal(false);
      fetchInvoices();

      // Open printable receipt immediately
      openReceiptModal(res.data.payment.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Payment failed');
    }
  };

  // Open Reversal Modal
  const openReversalModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setReversalReason('');
    setShowReversalModal(true);
  };

  // Submit Reversal
  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    try {
      await api.post(`/fees/payments/${selectedPayment.id}/reverse`, {
        reason: reversalReason,
      });

      setShowReversalModal(false);
      fetchInvoices();
      alert('Payment reversed successfully and invoice balance recalculated.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Reversal failed');
    }
  };

  // Open Receipt Modal
  const openReceiptModal = async (paymentId: string) => {
    try {
      const res = await api.get(`/fees/payments/receipt/${paymentId}`);
      setReceiptData(res.data);
      setShowReceiptModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to fetch receipt');
    }
  };

  // Open Create Plan Modal
  const openCreatePlanModal = () => {
    setEditingPlanId(null);
    setPlanForm({
      name: '',
      category: planCategoryTab,
      planType: planCategoryTab === 'SHIFT_BASED' ? 'SHIFT_BASED' : 'DURATION_BASED',
      accessType: planCategoryTab === 'SHIFT_BASED' ? 'SHIFT' : 'FULL_DAY_DEDICATED',
      shiftId: shifts[0]?.id || '',
      durationMonths: 1,
      durationDays: 30,
      originalPrice: 1000,
      price: 900,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 100,
      discountValidUntil: '',
      admissionFee: 200,
      description: '',
      isActive: true,
    });
    setShowPlanModal(true);
  };

  // Open Edit Plan Modal
  const openEditPlanModal = (plan: FeePlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      category: plan.category || 'SHIFT_BASED',
      planType: plan.planType,
      accessType: plan.accessType || 'SHIFT',
      shiftId: plan.shiftId || '',
      durationMonths: plan.durationMonths || 1,
      durationDays: plan.durationDays || 30,
      originalPrice: plan.originalPrice || plan.price,
      price: plan.price,
      hasDiscount: plan.hasDiscount ?? false,
      discountType: plan.discountType || 'FIXED',
      discountValue: plan.discountValue || 0,
      discountValidUntil: plan.discountValidUntil ? plan.discountValidUntil.substring(0, 10) : '',
      admissionFee: plan.admissionFee || 0,
      description: plan.description || '',
      isActive: plan.isActive,
    });
    setShowPlanModal(true);
  };

  // Toggle Plan Status
  const handleTogglePlanActive = async (plan: FeePlan) => {
    try {
      await api.put(`/fees/plans/${plan.id}`, { isActive: !plan.isActive });
      fetchFeePlans();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update plan status');
    }
  };

  // Delete / Deactivate Plan
  const handleDeletePlan = async (plan: FeePlan) => {
    if (!confirm(`Are you sure you want to remove or deactivate plan "${plan.name}"?`)) return;
    try {
      const res = await api.delete(`/fees/plans/${plan.id}`);
      alert(res.data.message || 'Plan processed successfully');
      fetchFeePlans();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete plan');
    }
  };

  // Save (Create or Update) Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: planForm.name,
        category: planForm.category,
        planType: planForm.planType,
        accessType: planForm.accessType,
        shiftId: planForm.category === 'SHIFT_BASED' ? planForm.shiftId : null,
        durationMonths: Number(planForm.durationMonths),
        durationDays: Number(planForm.durationMonths) * 30,
        originalPrice: Number(planForm.originalPrice),
        price: Number(planForm.price),
        hasDiscount: planForm.hasDiscount,
        discountType: planForm.discountType,
        discountValue: Number(planForm.discountValue),
        discountValidUntil: planForm.discountValidUntil || null,
        admissionFee: Number(planForm.admissionFee),
        description: planForm.description,
        isActive: planForm.isActive,
      };

      if (editingPlanId) {
        await api.put(`/fees/plans/${editingPlanId}`, payload);
        alert('Plan updated successfully!');
      } else {
        await api.post('/fees/plans', payload);
        alert('Plan created successfully!');
      }

      setShowPlanModal(false);
      fetchFeePlans();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save plan');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fees, Invoices & Receipts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Shift-based & Full-day membership plans, flexible pricing, discount management, payments, and receipts
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'PLANS' && (
            <button
              onClick={openCreatePlanModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Fee Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'INVOICES'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoices & Fee Dues</span>
        </button>
        <button
          onClick={() => setActiveTab('PLANS')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'PLANS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Membership Fee Plans ({feePlans.length})</span>
        </button>
      </div>

      {/* TAB 1: INVOICES */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice number, student name, admission number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </form>

            <div className="flex items-center space-x-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">Paid</th>
                    <th className="py-3.5 px-4">Balance Due</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        No invoices found.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{inv.student?.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {inv.student?.admissionNumber}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-emerald-600 font-semibold">
                          ₹{inv.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-bold text-rose-600">
                          ₹{inv.balanceAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.status === 'PARTIALLY_PAID'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {inv.balanceAmount > 0 && (
                              <button
                                onClick={() => openPaymentModal(inv)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-xs"
                              >
                                Pay / Settle
                              </button>
                            )}
                            {inv.payments && inv.payments.length > 0 && (
                              <button
                                onClick={() => openReceiptModal(inv.payments![0].id)}
                                title="Print Official Receipt"
                                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <span>
                Total: <strong>{totalInvoices}</strong> invoices
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="font-semibold text-slate-800">Page {page}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={invoices.length < 15}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FEE PLANS */}
      {activeTab === 'PLANS' && (
        <div className="space-y-6">
          {/* Sub-Tabs: Shift-Based Plans vs Full-Day Plans */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setPlanCategoryTab('SHIFT_BASED');
                  setPlanShiftFilter('');
                  setPlanDurationFilter('');
                }}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-2 transition ${
                  planCategoryTab === 'SHIFT_BASED'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Shift-Based Plans</span>
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full">
                  {feePlans.filter((p) => p.category === 'SHIFT_BASED').length}
                </span>
              </button>

              <button
                onClick={() => {
                  setPlanCategoryTab('FULL_DAY');
                  setPlanAccessTypeFilter('');
                  setPlanDurationFilter('');
                }}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-2 transition ${
                  planCategoryTab === 'FULL_DAY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Full-Day Plans</span>
                <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full">
                  {feePlans.filter((p) => p.category === 'FULL_DAY').length}
                </span>
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {planCategoryTab === 'SHIFT_BASED' ? (
                <select
                  value={planShiftFilter}
                  onChange={(e) => setPlanShiftFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="">All Shifts</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={planAccessTypeFilter}
                  onChange={(e) => setPlanAccessTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="">All Access Types</option>
                  <option value="FULL_DAY_DEDICATED">Dedicated Desk (Reserved Seat)</option>
                  <option value="FULL_DAY_FLEXIBLE">Flexible Seat (Floating)</option>
                </select>
              )}

              <select
                value={planDurationFilter}
                onChange={(e) => setPlanDurationFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none"
              >
                <option value="">All Durations</option>
                <option value="1">1 Month (30 Days)</option>
                <option value="3">3 Months (90 Days)</option>
                <option value="4">4 Months (120 Days)</option>
                <option value="6">6 Months (180 Days)</option>
              </select>

              <select
                value={planStatusFilter}
                onChange={(e) => setPlanStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {feePlans
              .filter((plan) => {
                const matchesCategory =
                  planCategoryTab === 'SHIFT_BASED'
                    ? plan.category === 'SHIFT_BASED' || (!plan.category && plan.planType === 'SHIFT_BASED')
                    : plan.category === 'FULL_DAY';

                const matchesShift = !planShiftFilter || plan.shiftId === planShiftFilter;
                const matchesAccess = !planAccessTypeFilter || plan.accessType === planAccessTypeFilter;
                const matchesDuration = !planDurationFilter || String(plan.durationMonths) === planDurationFilter;
                const matchesStatus =
                  !planStatusFilter ||
                  (planStatusFilter === 'ACTIVE' && plan.isActive) ||
                  (planStatusFilter === 'INACTIVE' && !plan.isActive);

                return matchesCategory && matchesShift && matchesAccess && matchesDuration && matchesStatus;
              })
              .map((plan) => {
                const hasDiscount = (plan.hasDiscount || (plan.originalPrice && plan.originalPrice > plan.price));
                const discountAmt = plan.calculatedDiscountAmount || (plan.originalPrice ? plan.originalPrice - plan.price : 0);
                const discountPct = plan.calculatedDiscountPercent || (plan.originalPrice ? Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100) : 0);
                const totalPayable = plan.price + (plan.admissionFee || 0);

                return (
                  <div
                    key={plan.id}
                    className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                      plan.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 mb-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
                            plan.category === 'FULL_DAY'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {plan.category === 'FULL_DAY' ? (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>{plan.accessType === 'FULL_DAY_DEDICATED' ? 'Dedicated Desk' : 'Flexible Seat'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>{plan.shift?.name || 'Shift Plan'}</span>
                            </>
                          )}
                        </span>

                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {plan.durationMonths ? `${plan.durationMonths} ${plan.durationMonths === 1 ? 'Month' : 'Months'}` : `${plan.durationDays} Days`}
                        </span>
                      </div>

                      {/* Plan Title */}
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                      )}

                      {/* Shift Timing Details if Shift-Based */}
                      {plan.category === 'SHIFT_BASED' && plan.shift && (
                        <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg inline-block">
                          Timing: {plan.shift.startTime} – {plan.shift.endTime}
                        </div>
                      )}

                      {/* Full-Day note */}
                      {plan.category === 'FULL_DAY' && (
                        <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg inline-block">
                          {plan.accessType === 'FULL_DAY_DEDICATED'
                            ? 'All 3 Shifts Reserved (Dedicated)'
                            : 'All 3 Shifts Access (Flexible)'}
                        </div>
                      )}
                    </div>

                    {/* Pricing Box */}
                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          {hasDiscount && plan.originalPrice && (
                            <span className="text-xs text-slate-400 line-through mr-1.5 font-semibold">
                              ₹{plan.originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                          <span className="text-2xl font-black text-slate-900">
                            ₹{plan.price.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {hasDiscount && discountPct > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            {discountPct}% OFF
                          </span>
                        )}
                      </div>

                      {/* Admission Fee & Total */}
                      <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-50">
                        <div className="flex justify-between">
                          <span>Admission Fee:</span>
                          <span className="font-semibold text-slate-700">
                            {plan.admissionFee > 0 ? `+ ₹${plan.admissionFee.toLocaleString('en-IN')}` : '₹0'}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900 pt-0.5">
                          <span>Total Payable:</span>
                          <span className="text-emerald-600 font-extrabold">₹{totalPayable.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                        <button
                          onClick={() => handleTogglePlanActive(plan)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                            plan.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </button>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openEditPlanModal(plan)}
                            title="Edit Plan"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan)}
                            title="Delete / Deactivate Plan"
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD PAYMENT */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Settle Fee Payment</h3>
                <p className="text-xs text-slate-500 font-mono">Invoice: {selectedInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Student:</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.student?.fullName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Due:</span>
                  <span className="font-bold text-rose-600">
                    ₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount to Pay (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.balanceAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / Google Pay / PhonePe / Paytm</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="NET_BANKING">Net Banking / IMPS / NEFT</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction Reference ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-REF-89218291"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Received at reception counter"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  Confirm & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTABLE OFFICIAL RECEIPT (A4 & 80mm THERMAL) */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 no-print">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-slate-900">Fee Receipt</span>
                <div className="flex bg-slate-100 rounded-lg p-0.5 text-[11px] font-bold">
                  <button
                    onClick={() => setReceiptFormat('STANDARD')}
                    className={`px-2 py-0.5 rounded ${
                      receiptFormat === 'STANDARD' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setReceiptFormat('THERMAL')}
                    className={`px-2 py-0.5 rounded ${
                      receiptFormat === 'THERMAL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    80mm Thermal
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div
              className={`print-receipt border border-slate-200 rounded-xl p-5 bg-white text-slate-900 ${
                receiptFormat === 'THERMAL' ? 'max-w-[320px] mx-auto text-xs font-mono' : 'text-xs'
              }`}
            >
              {/* Header */}
              <div className="text-center pb-3 border-b border-slate-300 space-y-1">
                <h2 className="font-black text-sm tracking-tight text-slate-900">
                  {receiptData.library?.name || 'APEX STUDY LIBRARY'}
                </h2>
                <p className="text-[10px] text-slate-500 whitespace-pre-line">
                  {receiptData.library?.receiptHeader || receiptData.library?.address}
                </p>
                {receiptData.library?.gstin && (
                  <p className="text-[10px] text-slate-500">GSTIN: {receiptData.library?.gstin}</p>
                )}
              </div>

              {/* Receipt Details */}
              <div className="py-3 border-b border-slate-200 space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span>Receipt No:</span>
                  <span className="font-mono">{receiptData.payment?.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Date:</span>
                  <span>{new Date(receiptData.payment?.paymentDate).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Student Name:</span>
                  <span className="font-bold text-slate-900">
                    {receiptData.payment?.student?.fullName}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Admission No:</span>
                  <span className="font-mono">{receiptData.payment?.student?.admissionNumber}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Payment Mode:</span>
                  <span className="font-bold">{receiptData.payment?.paymentMethod}</span>
                </div>
                {receiptData.payment?.transactionRef && (
                  <div className="flex justify-between text-slate-600">
                    <span>Txn Ref:</span>
                    <span className="font-mono text-[10px]">{receiptData.payment?.transactionRef}</span>
                  </div>
                )}
              </div>

              {/* Amount Settled */}
              <div className="py-3 border-b border-slate-200 space-y-1">
                <div className="flex justify-between text-sm font-black text-slate-900">
                  <span>Amount Paid:</span>
                  <span>₹{receiptData.payment?.amount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Remaining Dues:</span>
                  <span>₹{receiptData.payment?.invoice?.balanceAmount?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1 whitespace-pre-line">
                <p>{receiptData.library?.receiptFooter || 'Fees once paid are strictly non-refundable.'}</p>
                <p className="font-bold pt-1">Authorized Signatory / Digital Seal</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE / EDIT FEE PLAN */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingPlanId ? 'Edit Membership Plan' : 'Create New Membership Plan'}
                </h3>
                <p className="text-xs text-slate-500">Configure independent duration pricing, discounts and admission fees</p>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              {/* Category & Access Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plan Category</label>
                  <select
                    value={planForm.category}
                    onChange={(e: any) => {
                      const cat = e.target.value;
                      setPlanForm({
                        ...planForm,
                        category: cat,
                        planType: cat === 'SHIFT_BASED' ? 'SHIFT_BASED' : 'DURATION_BASED',
                        accessType: cat === 'SHIFT_BASED' ? 'SHIFT' : 'FULL_DAY_DEDICATED',
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
                  >
                    <option value="SHIFT_BASED">Shift-Based Plan</option>
                    <option value="FULL_DAY">Full-Day Plan</option>
                  </select>
                </div>

                <div>
                  {planForm.category === 'SHIFT_BASED' ? (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Assign to Shift</label>
                      <select
                        value={planForm.shiftId}
                        onChange={(e) => setPlanForm({ ...planForm, shiftId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
                      >
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.startTime} - {s.endTime})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full-Day Access Type</label>
                      <select
                        value={planForm.accessType}
                        onChange={(e: any) => setPlanForm({ ...planForm, accessType: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
                      >
                        <option value="FULL_DAY_DEDICATED">Dedicated Desk (Reserved)</option>
                        <option value="FULL_DAY_FLEXIBLE">Flexible Seat (Floating)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Plan Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Shift – 3 Months Special"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                />
              </div>

              {/* Duration in Months */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Months)</label>
                  <select
                    value={planForm.durationMonths}
                    onChange={(e) => {
                      const months = Number(e.target.value);
                      setPlanForm({
                        ...planForm,
                        durationMonths: months,
                        durationDays: months * 30,
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
                  >
                    <option value={1}>1 Month (30 Days)</option>
                    <option value={3}>3 Months (90 Days)</option>
                    <option value={4}>4 Months (120 Days)</option>
                    <option value={6}>6 Months (180 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">One-Time Admission Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={planForm.admissionFee}
                    onChange={(e) => setPlanForm({ ...planForm, admissionFee: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                  />
                </div>
              </div>

              {/* Pricing & Discounts Box */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pricing & Promotional Discounts</span>
                  </span>
                  <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planForm.hasDiscount}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPlanForm({
                          ...planForm,
                          hasDiscount: checked,
                          price: checked
                            ? planForm.discountType === 'PERCENTAGE'
                              ? Math.round(planForm.originalPrice - (planForm.originalPrice * planForm.discountValue) / 100)
                              : Math.max(0, planForm.originalPrice - planForm.discountValue)
                            : planForm.originalPrice,
                        });
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Offer Discount</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Original Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={planForm.originalPrice}
                      onChange={(e) => {
                        const orig = Number(e.target.value);
                        let finalPr = orig;
                        if (planForm.hasDiscount) {
                          if (planForm.discountType === 'PERCENTAGE') {
                            finalPr = Math.round(orig - (orig * planForm.discountValue) / 100);
                          } else {
                            finalPr = Math.max(0, orig - planForm.discountValue);
                          }
                        }
                        setPlanForm({ ...planForm, originalPrice: orig, price: finalPr });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Discounted Selling Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={planForm.price}
                      onChange={(e) => {
                        const pr = Number(e.target.value);
                        setPlanForm({
                          ...planForm,
                          price: pr,
                          discountValue: Math.max(0, planForm.originalPrice - pr),
                          discountType: 'FIXED',
                          hasDiscount: planForm.originalPrice > pr,
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-emerald-600"
                    />
                  </div>
                </div>

                {planForm.hasDiscount && (
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Discount Type</label>
                      <select
                        value={planForm.discountType}
                        onChange={(e: any) => {
                          const dt = e.target.value;
                          const orig = planForm.originalPrice;
                          let finalPr = orig;
                          if (dt === 'PERCENTAGE') {
                            finalPr = Math.round(orig - (orig * planForm.discountValue) / 100);
                          } else {
                            finalPr = Math.max(0, orig - planForm.discountValue);
                          }
                          setPlanForm({ ...planForm, discountType: dt, price: finalPr });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-semibold text-slate-800"
                      >
                        <option value="FIXED">Fixed (₹)</option>
                        <option value="PERCENTAGE">Percent (%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Discount Value</label>
                      <input
                        type="number"
                        min="0"
                        value={planForm.discountValue}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const orig = planForm.originalPrice;
                          let finalPr = orig;
                          if (planForm.discountType === 'PERCENTAGE') {
                            finalPr = Math.round(orig - (orig * val) / 100);
                          } else {
                            finalPr = Math.max(0, orig - val);
                          }
                          setPlanForm({ ...planForm, discountValue: val, price: finalPr });
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1 text-[11px]">Valid Until</label>
                      <input
                        type="date"
                        value={planForm.discountValidUntil}
                        onChange={(e) => setPlanForm({ ...planForm, discountValidUntil: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5"
                      />
                    </div>
                  </div>
                )}

                {/* Live Preview Summary */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Original Price:</span>
                    <span>₹{planForm.originalPrice.toLocaleString('en-IN')}</span>
                  </div>
                  {planForm.hasDiscount && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Discount:</span>
                      <span>
                        - ₹{(planForm.originalPrice - planForm.price).toLocaleString('en-IN')} (
                        {Math.round(((planForm.originalPrice - planForm.price) / (planForm.originalPrice || 1)) * 100)}%)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700">
                    <span>Selling Membership Fee:</span>
                    <span className="font-bold">₹{planForm.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Admission Fee:</span>
                    <span>+ ₹{planForm.admissionFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Total Student Payable:</span>
                    <span className="text-emerald-600 font-black">
                      ₹{(planForm.price + planForm.admissionFee).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Full-day dedicated desk reserved across Morning, Afternoon and Evening shifts with high-speed WiFi and locker."
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="planIsActive"
                  checked={planForm.isActive}
                  onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="planIsActive" className="font-bold text-slate-800 cursor-pointer">
                  Plan is Active (Available for new admissions and renewals)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  {editingPlanId ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

