import React, { useState, useEffect, useRef } from 'react';
import {
  Armchair,
  Plus,
  Save,
  Wand2,
  Trash2,
  RotateCw,
  Eye,
  Edit3,
  Layers,
  LayoutGrid,
  List,
  Sun,
  Sunset,
  Moon,
  Check,
  X,
  UserCheck,
  ArrowRightLeft,
  UserX,
  Filter,
  Search,
  Sparkles,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Floor, Room, Seat, FloorElement } from '../types/index.js';

export const FloorPlanPage: React.FC = () => {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [elements, setElements] = useState<FloorElement[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // View & Mode States
  const [viewMode, setViewMode] = useState<'VISUAL' | 'GRID' | 'LIST'>('VISUAL');
  const [builderMode, setBuilderMode] = useState<'BUILDER' | 'LIVE_SHIFTS'>('LIVE_SHIFTS');
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [selectedElement, setSelectedElement] = useState<FloorElement | null>(null);

  // Modals
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showNewFloorModal, setShowNewFloorModal] = useState(false);

  // Booking Modal State
  const [bookingShiftId, setBookingShiftId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [feePlans, setFeePlans] = useState<any[]>([]);
  const [selectedFeePlanId, setSelectedFeePlanId] = useState('');
  const [bookingStartDate, setBookingStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingPrice, setBookingPrice] = useState(900);
  const [initialPayment, setInitialPayment] = useState(900);
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Transfer Modal State
  const [transferTargetSeatId, setTransferTargetSeatId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [activeBookingId, setActiveBookingId] = useState('');

  // Dragging states on canvas
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragType, setDragType] = useState<'SEAT' | 'ELEMENT' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Wizard state
  const [wizardRows, setWizardRows] = useState(4);
  const [wizardCols, setWizardCols] = useState(6);
  const [wizardPrefix, setWizardPrefix] = useState('');
  const [wizardSpacingX, setWizardSpacingX] = useState(150);
  const [wizardSpacingY, setWizardSpacingY] = useState(130);
  const [wizardPrefixType, setWizardPrefixType] = useState<'LETTERS' | 'NUMBERS'>('LETTERS');

  // Search & Filter in Grid/List View
  const [searchFilter, setSearchFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  useEffect(() => {
    fetchFloors();
    fetchFeePlans();
  }, []);

  const fetchFloors = async () => {
    try {
      const res = await api.get('/floors');
      const loadedFloors = res.data.floors;
      setFloors(loadedFloors);

      if (loadedFloors.length > 0) {
        const firstFloor = loadedFloors[0];
        setSelectedFloorId(firstFloor.id);
        if (firstFloor.rooms?.length > 0) {
          const firstRoom = firstFloor.rooms[0];
          setSelectedRoomId(firstRoom.id);
          fetchRoomLayout(firstRoom.id);
        }
      }
    } catch (err) {
      console.error('Failed to load floors', err);
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

  const fetchRoomLayout = async (roomId: string) => {
    setLoading(true);
    try {
      const [layoutRes, matrixRes] = await Promise.all([
        api.get(`/floors/rooms/${roomId}/layout`),
        api.get(`/seats/matrix?roomId=${roomId}`),
      ]);

      setRoomData(layoutRes.data.room);
      setElements(layoutRes.data.elements);
      setShifts(matrixRes.data.shifts);

      // Merge visual coordinates with 3-shift matrix data
      const matrixMap = new Map();
      matrixRes.data.matrix.forEach((m: any) => matrixMap.set(m.id, m));

      const mergedSeats = layoutRes.data.seats.map((seat: any) => {
        const m = matrixMap.get(seat.id);
        return {
          ...seat,
          shifts: m?.shifts || [],
          summaryStatus: m?.summaryStatus || 'AVAILABLE',
          isFullDayOccupied: m?.isFullDayOccupied || false,
          fullDayStudent: m?.fullDayStudent || null,
        };
      });

      setSeats(mergedSeats);
      if (matrixRes.data.stats) {
        setStats(matrixRes.data.stats);
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load room layout', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedSeat(null);
    setSelectedElement(null);
    fetchRoomLayout(roomId);
  };

  // Canvas Drag & Drop handlers
  const handleMouseDownSeat = (e: React.MouseEvent, seat: Seat) => {
    if (builderMode !== 'BUILDER') return;
    e.stopPropagation();
    setSelectedSeat(seat);
    setSelectedElement(null);
    setDraggingId(seat.id);
    setDragType('SEAT');

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: e.clientX - canvasRect.left - seat.x,
        y: e.clientY - canvasRect.top - seat.y,
      });
    }
  };

  const handleMouseDownElement = (e: React.MouseEvent, el: FloorElement) => {
    if (builderMode !== 'BUILDER') return;
    e.stopPropagation();
    setSelectedElement(el);
    setSelectedSeat(null);
    setDraggingId(el.id);
    setDragType('ELEMENT');

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: e.clientX - canvasRect.left - el.x,
        y: e.clientY - canvasRect.top - el.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || builderMode !== 'BUILDER') return;

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const newX = Math.max(10, Math.min(canvasRect.width - 60, e.clientX - canvasRect.left - dragOffset.x));
    const newY = Math.max(10, Math.min(canvasRect.height - 60, e.clientY - canvasRect.top - dragOffset.y));

    // Snap to 10px grid
    const snappedX = Math.round(newX / 10) * 10;
    const snappedY = Math.round(newY / 10) * 10;

    if (dragType === 'SEAT') {
      setSeats((prev) =>
        prev.map((s) => (s.id === draggingId ? { ...s, x: snappedX, y: snappedY } : s))
      );
      setHasUnsavedChanges(true);
    } else if (dragType === 'ELEMENT') {
      setElements((prev) =>
        prev.map((el) => (el.id === draggingId ? { ...el, x: snappedX, y: snappedY } : el))
      );
      setHasUnsavedChanges(true);
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDragType(null);
  };

  // Add new seat
  const handleAddSeat = () => {
    const nextNumber = `S-${(seats.length + 1).toString().padStart(2, '0')}`;
    const newSeat: Seat = {
      id: `temp-${Date.now()}`,
      floorId: selectedFloorId,
      roomId: selectedRoomId,
      seatNumber: nextNumber,
      x: 100,
      y: 100,
      width: 70,
      height: 65,
      rotation: 0,
      type: 'STANDARD',
      isActive: true,
      summaryStatus: 'AVAILABLE',
      shifts: shifts.map((sh) => ({
        shiftId: sh.id,
        shiftCode: sh.code,
        shiftName: sh.name,
        timing: `${sh.startTime} - ${sh.endTime}`,
        isBooked: false,
        statusColor: 'RED',
        booking: null,
      })),
    };

    setSeats([...seats, newSeat]);
    setSelectedSeat(newSeat);
    setHasUnsavedChanges(true);
  };

  // Add floor element (Table, Wall, Door, Partition)
  const handleAddElement = (type: 'TABLE' | 'WALL' | 'DOOR' | 'PARTITION') => {
    const newEl: FloorElement = {
      id: `temp-el-${Date.now()}`,
      floorId: selectedFloorId,
      roomId: selectedRoomId,
      type,
      label: type === 'TABLE' ? 'Study Table' : type === 'WALL' ? 'Wall Partition' : 'Door',
      x: 150,
      y: 150,
      width: type === 'TABLE' ? 200 : type === 'WALL' ? 300 : 50,
      height: type === 'TABLE' ? 50 : type === 'WALL' ? 12 : 50,
      rotation: 0,
    };

    setElements([...elements, newEl]);
    setSelectedElement(newEl);
    setHasUnsavedChanges(true);
  };

  // Delete seat
  const handleDeleteSeat = async (seatId: string) => {
    if (seatId.startsWith('temp-')) {
      setSeats(seats.filter((s) => s.id !== seatId));
      setSelectedSeat(null);
      return;
    }

    if (!confirm('Are you sure you want to delete this seat?')) return;

    try {
      await api.delete(`/floors/seats/${seatId}`);
      setSeats(seats.filter((s) => s.id !== seatId));
      setSelectedSeat(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete seat. Active bookings may exist.');
    }
  };

  // Save full layout
  const handleSaveLayout = async () => {
    if (!selectedRoomId) return;
    setSaving(true);

    try {
      await api.put(`/floors/rooms/${selectedRoomId}/layout`, {
        seats: seats.map((s) => ({
          id: s.id.startsWith('temp-') ? undefined : s.id,
          seatNumber: s.seatNumber,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          rotation: s.rotation,
          type: s.type,
        })),
        elements: elements.map((el) => ({
          type: el.type,
          label: el.label,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          properties: el.properties,
        })),
      });

      setHasUnsavedChanges(false);
      fetchRoomLayout(selectedRoomId);
      alert('Floor plan and seating layout saved successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  // Run Quick Setup Wizard
  const handleRunWizard = async () => {
    if (!selectedRoomId) return;

    try {
      await api.post(`/floors/rooms/${selectedRoomId}/wizard`, {
        rows: Number(wizardRows),
        columns: Number(wizardCols),
        rowPrefixType: wizardPrefixType,
        prefix: wizardPrefix,
        spacingX: Number(wizardSpacingX),
        spacingY: Number(wizardSpacingY),
        clearExistingSeats: false,
      });

      setShowWizardModal(false);
      fetchRoomLayout(selectedRoomId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate layout wizard');
    }
  };

  // Search students for booking modal
  const handleStudentSearch = async (term: string) => {
    setStudentSearch(term);
    if (term.length < 2) {
      setStudentOptions([]);
      return;
    }
    try {
      const res = await api.get(`/students?search=${encodeURIComponent(term)}&limit=8`);
      setStudentOptions(res.data.students);
    } catch (err) {
      console.error(err);
    }
  };

  // Open booking modal for a specific seat & shift
  const openBookingModal = (seat: Seat, shiftId: string) => {
    setSelectedSeat(seat);
    setBookingShiftId(shiftId);
    setSelectedStudentId('');
    setStudentSearch('');
    setStudentOptions([]);

    // Set default fee plan matching shift
    const matchingPlan = feePlans.find((p) => p.shiftId === shiftId) || feePlans[0];
    if (matchingPlan) {
      setSelectedFeePlanId(matchingPlan.id);
      setBookingPrice(matchingPlan.price);
      setInitialPayment(matchingPlan.price);
    }

    setShowBookingModal(true);
  };

  // Confirm Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat || !selectedStudentId || !bookingShiftId) {
      alert('Please select both a student and shift');
      return;
    }

    try {
      await api.post('/bookings', {
        studentId: selectedStudentId,
        seatId: selectedSeat.id,
        shiftId: bookingShiftId,
        feePlanId: selectedFeePlanId || undefined,
        startDate: bookingStartDate,
        monthlyPrice: Number(bookingPrice),
        initialPaymentAmount: Number(initialPayment),
        paymentMethod,
        createInvoice: true,
      });

      setShowBookingModal(false);
      fetchRoomLayout(selectedRoomId);
      alert('Seat assigned and booking confirmed successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Booking failed');
    }
  };

  // Release Seat
  const handleReleaseSeat = async (bookingId: string) => {
    const reason = prompt('Enter reason for releasing seat:', 'Student completed tenure / requested cancellation');
    if (!reason) return;

    try {
      await api.post(`/bookings/${bookingId}/release`, { reason });
      fetchRoomLayout(selectedRoomId);
      setSelectedSeat(null);
      alert('Seat released successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to release seat');
    }
  };

  // Open Transfer Modal
  const openTransferModal = (bookingId: string, seat: Seat) => {
    setActiveBookingId(bookingId);
    setSelectedSeat(seat);
    setTransferTargetSeatId('');
    setTransferReason('');
    setShowTransferModal(true);
  };

  // Confirm Transfer
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBookingId || !transferTargetSeatId || !transferReason) {
      alert('Please select target seat and enter a transfer reason');
      return;
    }

    try {
      await api.post(`/bookings/${activeBookingId}/transfer`, {
        targetSeatId: transferTargetSeatId,
        reason: transferReason,
      });

      setShowTransferModal(false);
      fetchRoomLayout(selectedRoomId);
      alert('Seat transferred successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Transfer failed');
    }
  };

  // Filtered Seats for Grid/List View
  const filteredSeats = seats.filter((s) => {
    const matchesSearch = s.seatNumber.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;

    if (shiftFilter === 'ALL') return true;
    const shiftStatus = s.shifts?.find((sh) => sh.shiftCode === shiftFilter);
    return shiftStatus ? !shiftStatus.isBooked : true;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Floor Plan & Seat Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visual 2D drag-and-drop builder with Three Independent Shifts per seat (Morning, Afternoon, Evening)
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Room Selector */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
            <Layers className="w-4 h-4 text-slate-400" />
            <select
              value={selectedRoomId}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="bg-transparent border-none focus:outline-none cursor-pointer text-slate-800"
            >
              {floors.flatMap((f) =>
                f.rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {f.name} - {r.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Mode Switcher: Live 3-Shift View vs Builder Mode */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setBuilderMode('LIVE_SHIFTS')}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
                builderMode === 'LIVE_SHIFTS'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>3-Shift Live View</span>
            </button>
            <button
              onClick={() => setBuilderMode('BUILDER')}
              className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition ${
                builderMode === 'BUILDER'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Layout Builder</span>
            </button>
          </div>

          {/* Layout View: Visual Canvas vs Grid vs List */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('VISUAL')}
              title="2D Visual Floor Plan"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'VISUAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Armchair className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              title="Grid Card View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              title="Table List View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Builder Action Buttons */}
          {builderMode === 'BUILDER' && (
            <>
              <button
                onClick={handleAddSeat}
                className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Seat</span>
              </button>
              <button
                onClick={() => handleAddElement('TABLE')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                + Table
              </button>
              <button
                onClick={() => handleAddElement('WALL')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                + Partition
              </button>
              <button
                onClick={() => setShowWizardModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Wizard</span>
              </button>
              <button
                onClick={handleSaveLayout}
                disabled={saving}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Layout'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Occupancy Statistics */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Seats</p>
              <p className="text-xl font-black text-slate-900">{stats.totalSeats}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fully Available</p>
              <p className="text-xl font-black text-emerald-600">{stats.fullyAvailableSeats}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partially Occupied</p>
              <p className="text-xl font-black text-amber-600">{stats.partiallyOccupiedSeats}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full-Day Occupied</p>
              <p className="text-xl font-black text-purple-600">{stats.fullDayOccupiedSeats}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupied Shift Slots</p>
              <p className="text-xl font-black text-blue-600">{stats.totalOccupiedShiftSlots}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3-Shift Legend Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-900 text-white rounded-2xl text-xs shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-300">Status Indicator:</span>
          <div className="flex items-center space-x-1.5 font-semibold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Green = Occupied / Booked</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Red = Available</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Yellow = Pending</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span>Grey = Inactive</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-purple-300 pl-2 border-l border-slate-700">
            <span className="px-1.5 py-0.2 bg-purple-500 text-white rounded text-[10px] font-black">FULL DAY</span>
            <span>All 3 Shifts Reserved</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-slate-400 font-mono text-[11px]">
          <span className="flex items-center space-x-1 text-amber-300">
            <Sun className="w-3.5 h-3.5" />
            <span>Morning: 06:00-12:00</span>
          </span>
          <span className="flex items-center space-x-1 text-orange-300">
            <Sunset className="w-3.5 h-3.5" />
            <span>Afternoon: 12:00-18:00</span>
          </span>
          <span className="flex items-center space-x-1 text-indigo-300">
            <Moon className="w-3.5 h-3.5" />
            <span>Evening: 18:00-23:30</span>
          </span>
        </div>
      </div>

      {/* VIEW MODE 1: VISUAL 2D CANVAS */}
      {viewMode === 'VISUAL' && (
        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[700px]">
          {/* Subtle Grid Background */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-[750px] relative overflow-auto bg-slate-50/70 select-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {/* Architectural Elements (Tables, Walls, Partitions) */}
            {elements.map((el) => (
              <div
                key={el.id}
                onMouseDown={(e) => handleMouseDownElement(e, el)}
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  transform: `rotate(${el.rotation}deg)`,
                }}
                className={`absolute rounded flex items-center justify-center text-[10px] font-bold tracking-wider uppercase transition-shadow ${
                  el.type === 'WALL'
                    ? 'bg-slate-700 text-slate-200 border border-slate-900 shadow-sm'
                    : el.type === 'TABLE'
                    ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 shadow-xs'
                    : el.type === 'DOOR'
                    ? 'bg-blue-100 text-blue-800 border-2 border-dashed border-blue-400'
                    : 'bg-slate-300 text-slate-700'
                } ${
                  selectedElement?.id === el.id && builderMode === 'BUILDER'
                    ? 'ring-2 ring-blue-500 shadow-lg cursor-move'
                    : builderMode === 'BUILDER'
                    ? 'cursor-move hover:ring-1 hover:ring-blue-300'
                    : ''
                }`}
              >
                <span className="truncate px-1">{el.label}</span>
              </div>
            ))}

            {/* Seats */}
            {seats.map((seat) => {
              const isSelected = selectedSeat?.id === seat.id;
              return (
                <div
                  key={seat.id}
                  onMouseDown={(e) => handleMouseDownSeat(e, seat)}
                  onClick={() => setSelectedSeat(seat)}
                  style={{
                    left: `${seat.x}px`,
                    top: `${seat.y}px`,
                    width: `${seat.width || 70}px`,
                    height: `${seat.height || 65}px`,
                    transform: `rotate(${seat.rotation || 0}deg)`,
                  }}
                  className={`absolute rounded-xl border flex flex-col justify-between p-1.5 transition-all shadow-xs ${
                    isSelected
                      ? 'border-blue-600 ring-3 ring-blue-500/30 z-20 shadow-md bg-white'
                      : 'border-slate-300 bg-white hover:border-slate-400 hover:shadow-sm z-10'
                  } ${builderMode === 'BUILDER' ? 'cursor-move' : 'cursor-pointer'}`}
                >
                  {/* Seat Number Top Bar */}
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-800 leading-none">
                    <span className="font-mono">{seat.seatNumber}</span>
                    {seat.isFullDayOccupied ? (
                      <span className="px-1 py-0.2 bg-purple-600 text-white rounded text-[8px] font-black">
                        FULL DAY
                      </span>
                    ) : seat.type === 'PREMIUM' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Premium Desk" />
                    ) : null}
                  </div>

                  {/* Three Independent Shift Sections Per Seat */}
                  {builderMode === 'LIVE_SHIFTS' ? (
                    <div className="flex flex-col gap-1 mt-1">
                      {seat.isFullDayOccupied ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSeat(seat);
                          }}
                          className="h-10 rounded bg-emerald-600 text-white flex flex-col justify-center items-center px-1 text-[8px] font-black shadow-xs cursor-pointer hover:bg-emerald-700 transition"
                          title={`Full-Day Dedicated Occupant: ${seat.fullDayStudent?.fullName || 'Member'}`}
                        >
                          <span className="truncate max-w-[65px] font-bold">
                            {seat.fullDayStudent?.fullName?.split(' ')[0] || 'FULL DAY'}
                          </span>
                          <span className="text-[7px] text-emerald-100 font-mono">
                            {seat.fullDayStudent?.admissionNumber || 'ALL 3 SHIFTS'}
                          </span>
                        </div>
                      ) : (
                        seat.shifts?.map((shift) => (
                          <div
                            key={shift.shiftId}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (shift.isBooked) {
                                setSelectedSeat(seat);
                              } else {
                                openBookingModal(seat, shift.shiftId);
                              }
                            }}
                            title={
                              shift.isBooked
                                ? `Booked by: ${shift.booking?.studentName} (${shift.booking?.admissionNumber})`
                                : `Available for ${shift.shiftName}. Click to Book!`
                            }
                            className={`h-3 rounded flex items-center justify-between px-1 text-[8px] font-bold tracking-tight transition cursor-pointer ${
                              shift.isBooked
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-rose-500 text-white hover:bg-rose-600'
                            }`}
                          >
                            <span className="truncate">
                              {shift.shiftCode.charAt(0)}: {shift.isBooked ? shift.booking?.studentName?.split(' ')[0] : 'FREE'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      <Armchair className="w-5 h-5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Seat / Element Inspector Floating Panel */}
          {selectedSeat && (
            <div className="absolute right-4 top-4 w-80 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-xl z-30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {selectedSeat.seatNumber}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Seat Details</h3>
                    <p className="text-[11px] text-slate-400 capitalize">{selectedSeat.type.toLowerCase()} Desk</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSeat(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full-Day Dedicated Banner if Applicable */}
              {selectedSeat.isFullDayOccupied && selectedSeat.fullDayStudent && (
                <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white font-black text-[9px] flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>FULL-DAY DEDICATED</span>
                    </span>
                    <span className="text-[10px] font-bold text-purple-700">All 3 Shifts Reserved</span>
                  </div>
                  <p className="font-extrabold text-slate-900 text-xs">{selectedSeat.fullDayStudent.fullName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Admission: {selectedSeat.fullDayStudent.admissionNumber}</p>
                  {selectedSeat.fullDayStudent.phone && (
                    <p className="text-[10px] text-slate-500">Contact: {selectedSeat.fullDayStudent.phone}</p>
                  )}
                </div>
              )}

              {/* Three Shifts Status Breakdown */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Three Shifts Occupancy
                </h4>

                {selectedSeat.shifts?.map((sh) => (
                  <div
                    key={sh.shiftId}
                    className={`p-3 rounded-xl border text-xs ${
                      sh.isBooked
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-rose-200 bg-rose-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center space-x-1">
                        <span>{sh.shiftName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({sh.timing})</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          sh.isBooked ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {sh.isBooked ? 'Booked (Green)' : 'Available (Red)'}
                      </span>
                    </div>

                    {sh.isBooked && sh.booking ? (
                      <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] space-y-1">
                        <p className="font-bold text-slate-900">
                          {sh.booking.studentName}{' '}
                          <span className="text-slate-500 font-normal">({sh.booking.admissionNumber})</span>
                        </p>
                        <p className="text-slate-500 text-[10px]">Phone: {sh.booking.phone}</p>
                        <p className="text-slate-500 text-[10px]">
                          Booked until:{' '}
                          {new Date(sh.booking.endDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>

                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => openTransferModal(sh.booking!.bookingId, selectedSeat)}
                            className="flex-1 py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold flex items-center justify-center space-x-1"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Transfer</span>
                          </button>
                          <button
                            onClick={() => handleReleaseSeat(sh.booking!.bookingId)}
                            className="flex-1 py-1 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold flex items-center justify-center space-x-1"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Release</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <button
                          onClick={() => openBookingModal(selectedSeat, sh.shiftId)}
                          className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center space-x-1 shadow-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Assign & Book Shift</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Builder Controls for Selected Seat */}
              {builderMode === 'BUILDER' && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteSeat(selectedSeat.id)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Seat</span>
                  </button>
                  <span className="text-[10px] text-slate-400">
                    X: {selectedSeat.x}, Y: {selectedSeat.y}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: RESPONSIVE GRID CARD VIEW */}
      {viewMode === 'GRID' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by seat number..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">All Shifts</option>
                <option value="MORNING">Available in Morning</option>
                <option value="AFTERNOON">Available in Afternoon</option>
                <option value="EVENING">Available in Evening</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSeats.map((seat) => (
              <div
                key={seat.id}
                onClick={() => setSelectedSeat(seat)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-extrabold flex items-center justify-center text-sm">
                      {seat.seatNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{seat.type}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      seat.summaryStatus === 'AVAILABLE'
                        ? 'bg-rose-50 text-rose-700'
                        : seat.summaryStatus === 'FULLY_BOOKED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {seat.summaryStatus?.replace('_', ' ')}
                  </span>
                </div>

                {/* 3 Shifts List */}
                <div className="py-3 space-y-2">
                  {seat.shifts?.map((sh) => (
                    <div
                      key={sh.shiftId}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50"
                    >
                      <span className="font-semibold text-slate-700">{sh.shiftName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sh.isBooked ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {sh.isBooked ? sh.booking?.studentName : 'Available'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: TABLE LIST VIEW */}
      {viewMode === 'LIST' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Seat Number</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Morning Shift (06:00-12:00)</th>
                <th className="py-3.5 px-4">Afternoon Shift (12:00-18:00)</th>
                <th className="py-3.5 px-4">Evening Shift (18:00-23:30)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSeats.map((seat) => {
                const morning = seat.shifts?.find((sh) => sh.shiftCode === 'MORNING');
                const afternoon = seat.shifts?.find((sh) => sh.shiftCode === 'AFTERNOON');
                const evening = seat.shifts?.find((sh) => sh.shiftCode === 'EVENING');

                return (
                  <tr key={seat.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono text-sm">
                      {seat.seatNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{seat.type}</td>

                    {/* Morning */}
                    <td className="py-3 px-4">
                      {morning?.isBooked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                          {morning.booking?.studentName}
                        </span>
                      ) : (
                        <button
                          onClick={() => openBookingModal(seat, morning?.shiftId || '')}
                          className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold text-[11px]"
                        >
                          + Available
                        </button>
                      )}
                    </td>

                    {/* Afternoon */}
                    <td className="py-3 px-4">
                      {afternoon?.isBooked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                          {afternoon.booking?.studentName}
                        </span>
                      ) : (
                        <button
                          onClick={() => openBookingModal(seat, afternoon?.shiftId || '')}
                          className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold text-[11px]"
                        >
                          + Available
                        </button>
                      )}
                    </td>

                    {/* Evening */}
                    <td className="py-3 px-4">
                      {evening?.isBooked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                          {evening.booking?.studentName}
                        </span>
                      ) : (
                        <button
                          onClick={() => openBookingModal(seat, evening?.shiftId || '')}
                          className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold text-[11px]"
                        >
                          + Available
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedSeat(seat)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: QUICK SETUP WIZARD */}
      {showWizardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-purple-600 font-bold">
                <Wand2 className="w-5 h-5" />
                <h3 className="text-base text-slate-900">Quick Setup Layout Wizard</h3>
              </div>
              <button onClick={() => setShowWizardModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Automatically generate an organized grid of seats with custom prefixes and row labels.
            </p>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rows</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={wizardRows}
                  onChange={(e) => setWizardRows(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Columns</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={wizardCols}
                  onChange={(e) => setWizardCols(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Prefix Scheme</label>
                <select
                  value={wizardPrefixType}
                  onChange={(e: any) => setWizardPrefixType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="LETTERS">Letters (A-01, B-01)</option>
                  <option value="NUMBERS">Sequential (S-01, S-02)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Custom Prefix (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. HALL-A"
                  value={wizardPrefix}
                  onChange={(e) => setWizardPrefix(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl text-purple-800 text-xs">
              Will generate <strong>{wizardRows * wizardCols}</strong> organized seats into Room.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowWizardModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRunWizard}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
              >
                Generate Seats Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEAT BOOKING MODAL */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Book Seat {selectedSeat?.seatNumber}</h3>
                <p className="text-xs text-slate-500">
                  Assign student to Shift:{' '}
                  <strong>{shifts.find((s) => s.id === bookingShiftId)?.name}</strong>
                </p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4 text-xs">
              {/* Search Student */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Student</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type name, phone, or admission number..."
                    value={studentSearch}
                    onChange={(e) => handleStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Dropdown Options */}
                {studentOptions.length > 0 && (
                  <div className="mt-1 bg-white border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 shadow-lg">
                    {studentOptions.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSelectedStudentId(st.id);
                          setStudentSearch(`${st.fullName} (${st.admissionNumber})`);
                          setStudentOptions([]);
                        }}
                        className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-900">{st.fullName}</span>
                        <span className="text-[11px] text-slate-500">{st.admissionNumber}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fee Plan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fee Plan</label>
                <select
                  value={selectedFeePlanId}
                  onChange={(e) => {
                    setSelectedFeePlanId(e.target.value);
                    const plan = feePlans.find((p) => p.id === e.target.value);
                    if (plan) {
                      setBookingPrice(plan.price);
                      setInitialPayment(plan.price);
                    }
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

              {/* Pricing & Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={bookingStartDate}
                    onChange={(e) => setBookingStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Fee Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={bookingPrice}
                    onChange={(e) => setBookingPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount Paid Today (₹)</label>
                  <input
                    type="number"
                    value={initialPayment}
                    onChange={(e) => setInitialPayment(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CARD">Card</option>
                    <option value="NET_BANKING">Net Banking</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  Confirm & Reserve Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SEAT TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Transfer Seat</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Seat</label>
                <select
                  required
                  value={transferTargetSeatId}
                  onChange={(e) => setTransferTargetSeatId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="">-- Choose Target Seat --</option>
                  {seats
                    .filter((s) => s.id !== selectedSeat?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seatNumber} ({s.type})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Transfer</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Student requested corner desk with window light"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
