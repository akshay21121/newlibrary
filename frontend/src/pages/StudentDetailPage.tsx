import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  Armchair,
  IndianRupee,
  Clock,
  History,
  FileText,
  Bell,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2,
  Download,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Student } from '../types/index.js';

export const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'BOOKINGS' | 'INVOICES' | 'PAYMENTS' | 'REMINDERS'>('BOOKINGS');

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchStudentDetails(id);
  }, [id]);

  const fetchStudentDetails = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/students/${studentId}`);
      setStudent(res.data.student);
      setEditForm(res.data.student);
    } catch (err) {
      console.error('Failed to load student details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);

    try {
      const res = await api.put(`/students/${id}`, {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
        alternatePhone: editForm.alternatePhone,
        address: editForm.address,
        idProofType: editForm.idProofType,
        idProofNumber: editForm.idProofNumber,
        emergencyContactName: editForm.emergencyContactName,
        emergencyContactRelation: editForm.emergencyContactRelation,
        emergencyContactPhone: editForm.emergencyContactPhone,
        bloodGroup: editForm.bloodGroup,
        targetExam: editForm.targetExam,
        notes: editForm.notes,
        status: editForm.status,
      });

      setStudent((prev) => ({ ...prev!, ...res.data.student }));
      setIsEditing(false);
      alert('Student profile updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!student || !id) return;
    if (!confirm('Are you sure you want to delete/archive this student profile?')) return;

    try {
      const res = await api.delete(`/students/${id}`);
      alert(res.data.message);
      navigate('/students');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete student');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8 text-center text-slate-500">
        Student profile not found.
      </div>
    );
  }

  const activeBooking = student.bookings?.find((b) => b.status === 'ACTIVE');

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Back Nav & Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Link
          to="/students"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Students Directory</span>
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1 shadow-xs transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center space-x-1 shadow-xs transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete / Archive</span>
          </button>
        </div>
      </div>

      {/* Main Student Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {isEditing ? (
          <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900">Edit Student Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName || ''}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Exam</label>
                <input
                  type="text"
                  value={editForm.targetExam || ''}
                  onChange={(e) => setEditForm({ ...editForm, targetExam: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={editForm.status || 'ACTIVE'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center space-x-5">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center font-bold text-2xl text-slate-600 shrink-0 overflow-hidden shadow-inner">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  student.fullName.charAt(0)
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-extrabold text-slate-900">{student.fullName}</h1>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {student.admissionNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      student.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {student.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{student.phone}</span>
                  </span>
                  {student.email && (
                    <span className="flex items-center space-x-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{student.email}</span>
                    </span>
                  )}
                  {student.address && (
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{student.address}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-emerald-700 font-semibold pt-1">
                  Target Exam: {student.targetExam || 'General Studies'} • Admitted on{' '}
                  {new Date(student.admissionDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Current Active Desk Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-w-[240px] text-xs">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                Current Assigned Desk
              </span>
              {activeBooking ? (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 font-black text-base text-slate-900">
                    <Armchair className="w-5 h-5 text-emerald-600" />
                    <span>{activeBooking.seat?.seatNumber}</span>
                    <span className="text-xs font-semibold text-emerald-600">
                      ({activeBooking.shift?.name})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Valid until{' '}
                    <strong>
                      {new Date(activeBooking.endDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 italic">No seat currently reserved</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('BOOKINGS')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'BOOKINGS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Armchair className="w-4 h-4" />
          <span>Seat Bookings & History ({student.bookings?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'INVOICES'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoices & Dues ({student.invoices?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'PAYMENTS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Receipts ({student.payments?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('REMINDERS')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'REMINDERS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notification Logs ({student.reminderLogs?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: BOOKINGS */}
      {activeTab === 'BOOKINGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Seat Booking Ledger</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {student.bookings?.map((b) => (
              <div key={b.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-slate-900 text-sm">
                    Seat {b.seat?.seatNumber} • {b.shift?.name}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {new Date(b.startDate).toLocaleDateString('en-IN')} &rarr;{' '}
                    {new Date(b.endDate).toLocaleDateString('en-IN')} • Fee: ₹{b.monthlyPrice}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                    b.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Invoices & Fees Due</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {student.invoices?.map((inv) => (
              <div key={inv.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 font-mono">{inv.invoiceNumber}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')} • Total: ₹
                    {inv.totalAmount} • Paid: ₹{inv.paidAmount}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {inv.status} (Balance: ₹{inv.balanceAmount})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Settled Payments</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {student.payments?.map((pay) => (
              <div key={pay.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 font-mono">{pay.receiptNumber}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Mode: {pay.paymentMethod} • Date:{' '}
                    {new Date(pay.paymentDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-emerald-600 text-sm">
                    +₹{pay.amount.toLocaleString('en-IN')}
                  </p>
                  <span
                    className={`text-[10px] font-semibold ${
                      pay.status === 'SUCCESS' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {pay.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: REMINDER LOGS */}
      {activeTab === 'REMINDERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Communication & Reminder Trail</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {student.reminderLogs?.map((log) => (
              <div key={log.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{log.channel} Notification</span>
                  <div className="flex items-center space-x-1.5">
                    {log.simulated && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                        SIMULATION
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.sentAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <p className="text-slate-600 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {log.messageContent}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

