import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Phone,
  Mail,
  Armchair,
  IndianRupee,
  Calendar,
  AlertTriangle,
  Upload,
  X,
  CheckCircle,
  FileText,
  Clock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Student } from '../types/index.js';

export const StudentsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [shifts, setShifts] = useState<any[]>([]);

  // Modals
  const [showAdmissionModal, setShowAdmissionModal] = useState(searchParams.get('action') === 'new');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Admission Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    gender: 'MALE',
    dateOfBirth: '',
    address: '',
    idProofType: 'AADHAAR',
    idProofNumber: '',
    emergencyContactName: '',
    emergencyContactRelation: 'Parent',
    emergencyContactPhone: '',
    bloodGroup: '',
    targetExam: 'UPSC Civil Services',
    notes: '',
    // Optional Seat & Fee
    seatId: '',
    shiftId: '',
    feePlanId: '',
    initialPaymentAmount: 0,
    paymentMethod: 'CASH',
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Available seats & fee plans for admission
  const [availableSeats, setAvailableSeats] = useState<any[]>([]);
  const [feePlans, setFeePlans] = useState<any[]>([]);

  // Renewal Form State
  const [renewPlanId, setRenewPlanId] = useState('');
  const [renewSeatId, setRenewSeatId] = useState('');
  const [renewShiftId, setRenewShiftId] = useState('');
  const [renewAmount, setRenewAmount] = useState(0);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('CASH');

  useEffect(() => {
    fetchStudents();
    fetchMetadata();
  }, [page, statusFilter, shiftFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/students?page=${page}&limit=15&search=${encodeURIComponent(search)}&status=${statusFilter}&shiftId=${shiftFilter}`
      );
      setStudents(res.data.students);
      setTotal(res.data.pagination.total);
    } catch (err) {
      console.error('Failed to load students', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [shiftsRes, seatsRes, plansRes] = await Promise.all([
        api.get('/settings/shifts'),
        api.get('/seats/matrix'),
        api.get('/fees/plans'),
      ]);
      setShifts(shiftsRes.data.shifts);
      setAvailableSeats(seatsRes.data.matrix);
      setFeePlans(plansRes.data.plans);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  // Submit Admission
  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          data.append(key, String(val));
        }
      });

      if (photoFile) data.append('photo', photoFile);
      if (kycFile) data.append('idProofDocument', kycFile);

      await api.post('/students', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowAdmissionModal(false);
      fetchStudents();
      alert('Student admitted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Admission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Archive Student
  const handleDeleteStudent = async (student: Student) => {
    const confirmMsg =
      'Are you sure you want to delete this student?\n\nNote: If the student has financial invoices or payment receipts, they will be safely ARCHIVED to preserve your accounting records for compliance.';
    if (!confirm(confirmMsg)) return;

    try {
      const res = await api.delete(`/students/${student.id}`);
      fetchStudents();
      alert(res.data.message);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete student');
    }
  };

  // Open Renew Modal
  const openRenewModal = (student: Student) => {
    setSelectedStudent(student);
    const activeBooking = student.bookings?.[0];
    if (activeBooking) {
      setRenewSeatId(activeBooking.seatId);
      setRenewShiftId(activeBooking.shiftId);
      setRenewPlanId(activeBooking.feePlanId || feePlans[0]?.id || '');
      setRenewAmount(activeBooking.monthlyPrice || 900);
    } else {
      setRenewSeatId(availableSeats[0]?.id || '');
      setRenewShiftId(shifts[0]?.id || '');
      setRenewPlanId(feePlans[0]?.id || '');
      setRenewAmount(feePlans[0]?.price || 900);
    }
    setShowRenewModal(true);
  };

  // Submit Renewal
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      await api.post(`/students/${selectedStudent.id}/renew`, {
        seatId: renewSeatId,
        shiftId: renewShiftId,
        feePlanId: renewPlanId,
        amountPaid: Number(renewAmount),
        paymentMethod: renewPaymentMethod,
      });

      setShowRenewModal(false);
      fetchStudents();
      alert('Membership renewed successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Renewal failed');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admissions, KYC records, seat bookings, and membership renewal
          </p>
        </div>

        <button
          onClick={() => setShowAdmissionModal(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm shadow-emerald-700/20 transition self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Student Admission</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, admission number, phone, email..."
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
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <select
            value={shiftFilter}
            onChange={(e) => {
              setShiftFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="">All Shifts</option>
            {shifts.map((sh) => (
              <option key={sh.id} value={sh.id}>
                {sh.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Admission No.</th>
                <th className="py-3.5 px-4">Phone / Contact</th>
                <th className="py-3.5 px-4">Current Desk</th>
                <th className="py-3.5 px-4">Pending Fee</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No students found matching current criteria.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition">
                    {/* Student Info & Photo */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0 overflow-hidden">
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
                        <div>
                          <Link
                            to={`/students/${student.id}`}
                            className="font-bold text-slate-900 hover:text-emerald-600 transition"
                          >
                            {student.fullName}
                          </Link>
                          <p className="text-[10px] text-slate-400">{student.targetExam || 'General Study'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Admission Number */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {student.admissionNumber}
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex items-center space-x-1 font-medium">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{student.phone}</span>
                      </div>
                      {student.email && (
                        <div className="flex items-center space-x-1 text-[11px] text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[140px]">{student.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Current Desk & Shift */}
                    <td className="py-3 px-4">
                      {student.currentSeat ? (
                        <div>
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                            <Armchair className="w-3 h-3" />
                            <span>{student.currentSeat}</span>
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">{student.currentShift}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No Active Desk</span>
                      )}
                    </td>

                    {/* Pending Fee */}
                    <td className="py-3 px-4">
                      {student.pendingBalance && student.pendingBalance > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px]">
                          ₹{student.pendingBalance.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                          Clear
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          student.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : student.status === 'ARCHIVED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/students/${student.id}`}
                          title="View 360° Profile"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openRenewModal(student)}
                          title="Renew Membership"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          title="Delete / Archive Student"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total: <strong>{total}</strong> students registered
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
              disabled={students.length < 15}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: NEW STUDENT ADMISSION */}
      {showAdmissionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">New Student Admission</h3>
                <p className="text-xs text-slate-500">
                  Admission sequence number will be automatically generated (e.g. LIB-2026-XXXX)
                </p>
              </div>
              <button
                onClick={() => setShowAdmissionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdmissionSubmit} className="space-y-4 text-xs">
              {/* Section 1: Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Aditya Sharma"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    placeholder="aditya@example.com"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Exam / Purpose</label>
                  <input
                    type="text"
                    value={formData.targetExam}
                    onChange={(e) => setFormData({ ...formData, targetExam: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    placeholder="UPSC, CA, NEET, GATE, etc."
                  />
                </div>
              </div>

              {/* Section 2: KYC & Identification */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-2">Identification & KYC</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">ID Proof Type</label>
                    <select
                      value={formData.idProofType}
                      onChange={(e) => setFormData({ ...formData, idProofType: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="AADHAAR">Aadhaar Card</option>
                      <option value="PAN">PAN Card</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="COLLEGE_ID">College / Student ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">ID Proof Number</label>
                    <input
                      type="text"
                      value={formData.idProofNumber}
                      onChange={(e) => setFormData({ ...formData, idProofNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      placeholder="e.g. 1234 5678 9012"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Student Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">KYC Document (PDF/Image)</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Emergency Contact & Address */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-2">Emergency Contact & Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Relation</label>
                    <input
                      type="text"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block font-semibold text-slate-600 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    placeholder="House / Flat / Sector / City"
                  />
                </div>
              </div>

              {/* Section 4: Initial Seat Assignment (Optional) */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-800 mb-2">Initial Seat Assignment (Optional)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Seat</label>
                    <select
                      value={formData.seatId}
                      onChange={(e) => setFormData({ ...formData, seatId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">-- Assign Later --</option>
                      {availableSeats.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.seatNumber} ({s.roomName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Shift</label>
                    <select
                      value={formData.shiftId}
                      onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">-- Select Shift --</option>
                      {shifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.name} ({sh.startTime}-{sh.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Fee Plan</label>
                    <select
                      value={formData.feePlanId}
                      onChange={(e) => {
                        const plan = feePlans.find((p) => p.id === e.target.value);
                        setFormData({
                          ...formData,
                          feePlanId: e.target.value,
                          initialPaymentAmount: plan ? plan.price + plan.admissionFee : 0,
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">-- Select Plan --</option>
                      {feePlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (₹{p.price})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.seatId && formData.shiftId && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Amount Paid Today (₹)</label>
                      <input
                        type="number"
                        value={formData.initialPaymentAmount}
                        onChange={(e) => setFormData({ ...formData, initialPaymentAmount: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Payment Mode</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI / QR Code</option>
                        <option value="CARD">Card</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdmissionModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Admitting...' : 'Complete Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RENEW MEMBERSHIP */}
      {showRenewModal && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Renew Membership</h3>
                <p className="text-xs text-slate-500">Student: {selectedStudent.fullName}</p>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fee Plan</label>
                <select
                  required
                  value={renewPlanId}
                  onChange={(e) => {
                    setRenewPlanId(e.target.value);
                    const plan = feePlans.find((p) => p.id === e.target.value);
                    if (plan) setRenewAmount(plan.price);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  {feePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ₹{p.price} ({p.durationDays} days)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Seat</label>
                  <select
                    required
                    value={renewSeatId}
                    onChange={(e) => setRenewSeatId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    {availableSeats.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seatNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift</label>
                  <select
                    required
                    value={renewShiftId}
                    onChange={(e) => setRenewShiftId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    {shifts.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={renewPaymentMethod}
                    onChange={(e) => setRenewPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  Extend & Renew
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

