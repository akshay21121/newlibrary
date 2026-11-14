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
} from 'lucide-react';
import { api } from '../services/api.js';
import { Invoice, Payment, FeePlan } from '../types/index.js';

export const FeesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'PLANS'>('INVOICES');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

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

  // New Fee Plan Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    planType: 'SHIFT_BASED',
    durationDays: 30,
    price: 900,
    admissionFee: 200,
    description: '',
  });

  useEffect(() => {
    fetchInvoices();
    fetchFeePlans();
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

  // Save new plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/fees/plans', {
        name: planForm.name,
        planType: planForm.planType,
        durationDays: Number(planForm.durationDays),
        price: Number(planForm.price),
        admissionFee: Number(planForm.admissionFee),
        description: planForm.description,
      });

      setShowPlanModal(false);
      fetchFeePlans();
      alert('Fee plan created successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create plan');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fees, Invoices & Receipts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic invoice generation, payment settlement, reversals with audit logs, and printable receipts
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'PLANS' && (
            <button
              onClick={() => setShowPlanModal(true)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {feePlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {plan.planType}
                  </span>
                  <span className="text-xs text-slate-400">{plan.durationDays} Days</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-2">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-slate-900">₹{plan.price}</p>
                  {plan.admissionFee > 0 && (
                    <p className="text-[10px] text-slate-400">+₹{plan.admissionFee} Admission Fee</p>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
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

      {/* MODAL 3: NEW FEE PLAN */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Create Fee Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Shift Monthly"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    required
                    value={planForm.durationDays}
                    onChange={(e) => setPlanForm({ ...planForm, durationDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plan Fee (₹)</label>
                  <input
                    type="number"
                    required
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admission Fee (₹)</label>
                <input
                  type="number"
                  value={planForm.admissionFee}
                  onChange={(e) => setPlanForm({ ...planForm, admissionFee: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 06:00 to 12:00 morning shift with dedicated desk"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

