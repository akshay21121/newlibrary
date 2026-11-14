import React, { useState, useEffect, useRef } from 'react';
import {
  Armchair,
  Plus,
  Save,
  Wand2,
  Trash2,
  RotateCw,
  Eye,
  EyeOff,
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
  Copy,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Magnet,
  Hash,
  Palette,
  Type,
  Maximize,
  Sliders,
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

  // Canvas Viewport Controls
  const [zoom, setZoom] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<{ seats: Seat[]; elements: FloorElement[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Modals
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showRenumberModal, setShowRenumberModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddElementDropdown, setShowAddElementDropdown] = useState(false);

  // Renumber State
  const [renumberStart, setRenumberStart] = useState<number>(1);
  const [renumberSort, setRenumberSort] = useState<'POSITION' | 'CURRENT'>('POSITION');

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
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMovedFarEnough, setHasMovedFarEnough] = useState(false);
  const [dragType, setDragType] = useState<'SEAT' | 'ELEMENT' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Wizard state
  const [wizardRows, setWizardRows] = useState(4);
  const [wizardCols, setWizardCols] = useState(6);
  const [wizardStartNum, setWizardStartNum] = useState(1);
  const [wizardPrefix, setWizardPrefix] = useState('');
  const [wizardSpacingX, setWizardSpacingX] = useState(140);
  const [wizardSpacingY, setWizardSpacingY] = useState(130);
  const [wizardNumberingPattern, setWizardNumberingPattern] = useState<'NUMERIC' | 'ALPHA_ROW'>('NUMERIC');

  // Search & Filter in Grid/List View
  const [searchFilter, setSearchFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [healingNumbers, setHealingNumbers] = useState(false);

  // Analysis of numbering gaps, prefixes, and duplicates
  const numberingAnalysis = React.useMemo(() => {
    const nums = new Set<number>();
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    let hasPrefixes = false;

    seats.forEach((s) => {
      const raw = (s.seatNumber || '').trim();
      if (seen.has(raw)) duplicates.add(raw);
      seen.add(raw);
      if (/[^0-9]/.test(raw)) hasPrefixes = true;
      const n = parseInt(raw.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > 0) nums.add(n);
    });

    const max = nums.size > 0 ? Math.max(...Array.from(nums)) : 0;
    const missingGaps: number[] = [];
    for (let i = 1; i < max; i++) {
      if (!nums.has(i)) missingGaps.push(i);
    }

    let nextSmallest = 1;
    while (nums.has(nextSmallest)) nextSmallest++;

    return {
      max,
      missingGaps,
      duplicates: Array.from(duplicates),
      nextAvailable: nextSmallest.toString(),
      hasPrefixes,
      hasIssues: hasPrefixes || duplicates.size > 0,
    };
  }, [seats]);

  const handleAutoHealNumbers = async () => {
    if (!selectedRoomId) return;
    if (!window.confirm('Do you want to automatically resolve non-numeric prefixes (e.g. S-46) and duplicate seat numbers by assigning the smallest missing numbers? All bookings and student records will remain preserved.')) {
      return;
    }
    setHealingNumbers(true);
    try {
      const res: any = await api.post(`/floors/rooms/${selectedRoomId}/auto-heal-numbers`);
      alert(res.data?.message || 'Seat numbers healed and standardized successfully.');
      await fetchRoomLayout(selectedRoomId);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to auto-heal seat numbers');
    } finally {
      setHealingNumbers(false);
    }
  };

  useEffect(() => {
    fetchFloors();
    fetchFeePlans();
  }, []);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const recordSnapshot = (newSeats: Seat[], newElements: FloorElement[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({
      seats: JSON.parse(JSON.stringify(newSeats)),
      elements: JSON.parse(JSON.stringify(newElements)),
    });
    // Keep max 25 history states
    const trimmed = nextHistory.slice(-25);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSeats(JSON.parse(JSON.stringify(prev.seats)));
      setElements(JSON.parse(JSON.stringify(prev.elements)));
      setHistoryIndex(historyIndex - 1);
      setHasUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setSeats(JSON.parse(JSON.stringify(next.seats)));
      setElements(JSON.parse(JSON.stringify(next.elements)));
      setHistoryIndex(historyIndex + 1);
      setHasUnsavedChanges(true);
    }
  };

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

      const parsedElements = (layoutRes.data.elements || []).map((el: any) => {
        let props = el.properties;
        if (typeof props === 'string') {
          try {
            props = JSON.parse(props);
          } catch {
            props = {};
          }
        }
        return {
          ...el,
          isHidden: el.isHidden || false,
          properties: props || {},
        };
      });
      setElements(parsedElements);
      setShifts(matrixRes.data.shifts);

      // Merge visual coordinates with 3-shift matrix data
      const matrixMap = new Map();
      matrixRes.data.matrix.forEach((m: any) => matrixMap.set(m.id, m));

      const mergedSeats = layoutRes.data.seats.map((seat: any) => {
        const m = matrixMap.get(seat.id);
        let props = seat.properties;
        if (typeof props === 'string') {
          try {
            props = JSON.parse(props);
          } catch {
            props = {};
          }
        }
        return {
          ...seat,
          properties: props || {},
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

      // Initialize history stack
      setHistory([
        {
          seats: JSON.parse(JSON.stringify(mergedSeats)),
          elements: JSON.parse(JSON.stringify(parsedElements)),
        },
      ]);
      setHistoryIndex(0);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load room layout', err);
    } finally {
      setLoading(false);
    }
  };

  // Fit room layout to visible canvas viewport
  const handleFitToScreen = () => {
    if (!canvasRef.current) return;
    const padding = 60;
    const containerW = canvasRef.current.clientWidth - padding;
    const containerH = canvasRef.current.clientHeight - padding;
    const roomW = roomData?.width || 1400;
    const roomH = roomData?.height || 900;
    if (containerW <= 0 || containerH <= 0) return;
    const scale = Math.min(containerW / roomW, containerH / roomH);
    const clampedScale = Math.min(1.2, Math.max(0.4, Number(scale.toFixed(2))));
    setZoom(clampedScale);
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedSeat(null);
    setSelectedElement(null);
    fetchRoomLayout(roomId);
  };

  // Canvas Drag & Drop handlers with accidental click movement threshold (4px)
  const handleMouseDownSeat = (e: React.MouseEvent, seat: Seat) => {
    if (builderMode !== 'BUILDER') return;
    e.stopPropagation();
    setSelectedSeat(seat);
    setSelectedElement(null);
    setDraggingId(seat.id);
    setDragType('SEAT');
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setHasMovedFarEnough(false);

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: (e.clientX - canvasRect.left) / zoom - seat.x,
        y: (e.clientY - canvasRect.top) / zoom - seat.y,
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
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setHasMovedFarEnough(false);

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: (e.clientX - canvasRect.left) / zoom - el.x,
        y: (e.clientY - canvasRect.top) / zoom - el.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || builderMode !== 'BUILDER') return;

    // Movement threshold check to prevent tiny unintended displacements on click
    if (!hasMovedFarEnough) {
      const dist = Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y);
      if (dist < 4) return;
      setHasMovedFarEnough(true);
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const rawX = (e.clientX - canvasRect.left) / zoom - dragOffset.x;
    const rawY = (e.clientY - canvasRect.top) / zoom - dragOffset.y;

    const boundedX = Math.max(10, Math.min(2400, rawX));
    const boundedY = Math.max(10, Math.min(1800, rawY));

    // Snap to 10px grid if enabled
    const finalX = snapToGrid ? Math.round(boundedX / 10) * 10 : Math.round(boundedX);
    const finalY = snapToGrid ? Math.round(boundedY / 10) * 10 : Math.round(boundedY);

    if (dragType === 'SEAT') {
      setSeats((prev) =>
        prev.map((s) => (s.id === draggingId ? { ...s, x: finalX, y: finalY } : s))
      );
      if (selectedSeat && selectedSeat.id === draggingId) {
        setSelectedSeat((prev) => (prev ? { ...prev, x: finalX, y: finalY } : null));
      }
      setHasUnsavedChanges(true);
    } else if (dragType === 'ELEMENT') {
      setElements((prev) =>
        prev.map((el) => (el.id === draggingId ? { ...el, x: finalX, y: finalY } : el))
      );
      if (selectedElement && selectedElement.id === draggingId) {
        setSelectedElement((prev) => (prev ? { ...prev, x: finalX, y: finalY } : null));
      }
      setHasUnsavedChanges(true);
    }
  };

  const handleMouseUp = () => {
    if (draggingId && hasMovedFarEnough) {
      recordSnapshot(seats, elements);
    }
    setDraggingId(null);
    setDragType(null);
    setHasMovedFarEnough(false);
  };

  // Helper: Find smallest available missing number in seats
  const getSmallestAvailableSeatNumber = (seatList: Seat[]): string => {
    const existing = new Set<number>();
    for (const s of seatList) {
      const parsed = parseInt((s.seatNumber || '').replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) existing.add(parsed);
    }
    let candidate = 1;
    while (existing.has(candidate)) {
      candidate++;
    }
    return candidate.toString();
  };

  // Add new seat with Smallest Available Missing Number (1, 2, 3... filling any gaps)
  const handleAddSeat = () => {
    const nextNumber = getSmallestAvailableSeatNumber(seats);

    const newSeat: Seat = {
      id: `temp-${Date.now()}`,
      floorId: selectedFloorId,
      roomId: selectedRoomId,
      seatNumber: nextNumber,
      x: 100,
      y: 100,
      width: 72,
      height: 68,
      rotation: 0,
      type: 'STANDARD',
      isActive: true,
      summaryStatus: 'AVAILABLE',
      properties: {
        fontSize: 13,
        shiftFontSize: 8,
        studentFontSize: 8,
        indicatorHeight: 12,
        borderRadius: 12,
        bgColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        textColor: '#0f172a',
      },
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

    const updatedSeats = [...seats, newSeat];
    setSeats(updatedSeats);
    setSelectedSeat(newSeat);
    setSelectedElement(null);
    setHasUnsavedChanges(true);
    recordSnapshot(updatedSeats, elements);
  };

  // Duplicate Seat with Smallest Available Missing Number
  const handleDuplicateSeat = (seat: Seat) => {
    const nextNumber = getSmallestAvailableSeatNumber(seats);

    const duplicatedSeat: Seat = {
      ...JSON.parse(JSON.stringify(seat)),
      id: `temp-${Date.now()}`,
      seatNumber: nextNumber,
      x: seat.x + 20,
      y: seat.y + 20,
      width: 72,
      height: 68,
      summaryStatus: 'AVAILABLE',
      isFullDayOccupied: false,
      fullDayStudent: null,
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

    const updatedSeats = [...seats, duplicatedSeat];
    setSeats(updatedSeats);
    setSelectedSeat(duplicatedSeat);
    setHasUnsavedChanges(true);
    recordSnapshot(updatedSeats, elements);
  };

  // Add floor element (Table, Wall, Partition, Reception Desk, Door, Custom)
  const handleAddElement = (
    type: 'TABLE' | 'WALL' | 'DOOR' | 'PARTITION' | 'RECEPTION' | 'CUSTOM'
  ) => {
    setShowAddElementDropdown(false);
    let label = 'Table';
    let width = 200;
    let height = 50;
    let bgColor = '#fef3c7';
    let borderColor = '#f59e0b';
    let textColor = '#78350f';
    let borderWidth = 2;
    let borderRadius = 8;
    let fontSize = 11;
    let fontWeight = 'bold';

    if (type === 'RECEPTION') {
      label = 'Admin / Reception Desk';
      width = 240;
      height = 55;
      bgColor = '#e0f2fe';
      borderColor = '#0284c7';
      textColor = '#0369a1';
      borderWidth = 2;
      borderRadius = 10;
    } else if (type === 'PARTITION') {
      label = 'Acoustic Glass Partition';
      width = 300;
      height = 16;
      bgColor = '#f1f5f9';
      borderColor = '#94a3b8';
      textColor = '#475569';
      borderWidth = 1;
      borderRadius = 4;
    } else if (type === 'WALL') {
      label = 'Main Wall';
      width = 350;
      height = 20;
      bgColor = '#334155';
      borderColor = '#0f172a';
      textColor = '#f8fafc';
      borderWidth = 1;
      borderRadius = 4;
    } else if (type === 'DOOR') {
      label = 'Entry / Exit Door';
      width = 70;
      height = 50;
      bgColor = '#ecfdf5';
      borderColor = '#10b981';
      textColor = '#065f46';
      borderWidth = 2;
      borderRadius = 6;
    } else if (type === 'CUSTOM') {
      label = 'Custom Area';
      width = 160;
      height = 80;
      bgColor = '#faf5ff';
      borderColor = '#a855f7';
      textColor = '#6b21a8';
      borderWidth = 2;
      borderRadius = 8;
    }

    const newEl: FloorElement = {
      id: `temp-el-${Date.now()}`,
      floorId: selectedFloorId,
      roomId: selectedRoomId,
      type,
      label,
      x: 120,
      y: 120,
      width,
      height,
      rotation: 0,
      isHidden: false,
      properties: {
        bgColor,
        borderColor,
        textColor,
        borderWidth,
        borderRadius,
        fontSize,
        fontWeight,
        textAlign: 'center',
      },
    };

    const updated = [...elements, newEl];
    setElements(updated);
    setSelectedElement(newEl);
    setSelectedSeat(null);
    setHasUnsavedChanges(true);
    recordSnapshot(seats, updated);
  };

  // Duplicate Element
  const handleDuplicateElement = (el: FloorElement) => {
    const duplicated: FloorElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: `temp-el-${Date.now()}`,
      x: el.x + 20,
      y: el.y + 20,
    };

    const updated = [...elements, duplicated];
    setElements(updated);
    setSelectedElement(duplicated);
    setHasUnsavedChanges(true);
    recordSnapshot(seats, updated);
  };

  // Toggle Hide / Show Element
  const handleToggleHideElement = (el: FloorElement) => {
    const updated = elements.map((item) =>
      item.id === el.id ? { ...item, isHidden: !item.isHidden } : item
    );
    setElements(updated);
    if (selectedElement?.id === el.id) {
      setSelectedElement({ ...selectedElement, isHidden: !selectedElement.isHidden });
    }
    setHasUnsavedChanges(true);
    recordSnapshot(seats, updated);
  };

  // Delete Element with Confirmation
  const handleDeleteElement = (el: FloorElement) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete the object "${el.label || el.type}"?\n\nThis will remove it from the floor plan.`
    );
    if (!confirmDelete) return;

    const updated = elements.filter((item) => item.id !== el.id);
    setElements(updated);
    setSelectedElement(null);
    setHasUnsavedChanges(true);
    recordSnapshot(seats, updated);
  };

  // Update Element Properties in Inspector
  const handleUpdateElement = (updates: Partial<FloorElement> | { properties: any }) => {
    if (!selectedElement) return;

    const updatedEl: FloorElement = {
      ...selectedElement,
      ...updates,
      properties: {
        ...(selectedElement.properties || {}),
        ...((updates as any).properties || {}),
      },
    };

    const updatedList = elements.map((item) =>
      item.id === selectedElement.id ? updatedEl : item
    );
    setElements(updatedList);
    setSelectedElement(updatedEl);
    setHasUnsavedChanges(true);
  };

  // Update Seat Properties in Inspector
  const handleUpdateSeat = (updates: Partial<Seat> | { properties: any }) => {
    if (!selectedSeat) return;

    const updatedSeat: Seat = {
      ...selectedSeat,
      ...updates,
      properties: {
        ...(selectedSeat.properties || {}),
        ...((updates as any).properties || {}),
      },
    };

    const updatedList = seats.map((item) =>
      item.id === selectedSeat.id ? updatedSeat : item
    );
    setSeats(updatedList);
    setSelectedSeat(updatedSeat);
    setHasUnsavedChanges(true);
  };

  // Delete seat with confirmation & safety check
  const handleDeleteSeat = async (seatId: string) => {
    const targetSeat = seats.find((s) => s.id === seatId);
    const hasBookings =
      targetSeat?.isFullDayOccupied || targetSeat?.shifts?.some((sh) => sh.isBooked);

    if (hasBookings) {
      alert(
        `Cannot delete Seat ${targetSeat?.seatNumber} because it currently has active student bookings. Please release or transfer the student bookings first.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete Seat ${targetSeat?.seatNumber || ''}?`)) {
      return;
    }

    if (seatId.startsWith('temp-')) {
      const updated = seats.filter((s) => s.id !== seatId);
      setSeats(updated);
      setSelectedSeat(null);
      recordSnapshot(updated, elements);
      setHasUnsavedChanges(true);
      return;
    }

    try {
      await api.delete(`/floors/seats/${seatId}`);
      const updated = seats.filter((s) => s.id !== seatId);
      setSeats(updated);
      setSelectedSeat(null);
      recordSnapshot(updated, elements);
      alert('Seat deleted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete seat.');
    }
  };

  // Save full layout (seats with properties, elements with isHidden and properties)
  const handleSaveLayout = async () => {
    if (!selectedRoomId) return;

    // Check for duplicate seat numbers before sending
    const trimmedNumbers = seats.map((s) => s.seatNumber.trim());
    const duplicate = trimmedNumbers.find((num, idx) => trimmedNumbers.indexOf(num) !== idx);
    if (duplicate) {
      alert(`Duplicate seat number detected: Seat "${duplicate}". Every seat must have a unique numeric number.`);
      return;
    }

    setSaving(true);

    try {
      await api.put(`/floors/rooms/${selectedRoomId}/layout`, {
        seats: seats.map((s) => ({
          id: s.id.startsWith('temp-') ? undefined : s.id,
          seatNumber: s.seatNumber.trim(),
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          rotation: s.rotation,
          type: s.type,
          properties: JSON.stringify(s.properties || {}),
        })),
        elements: elements.map((el) => ({
          type: el.type,
          label: el.label,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          isHidden: el.isHidden || false,
          properties: JSON.stringify(el.properties || {}),
        })),
      });

      setHasUnsavedChanges(false);
      await fetchRoomLayout(selectedRoomId);
      alert('Floor plan layout and all customizations saved successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  // Renumber Seats Tool
  const handleExecuteRenumber = async () => {
    if (!selectedRoomId) return;
    try {
      await api.post(`/floors/rooms/${selectedRoomId}/renumber`, {
        startNumber: Number(renumberStart) || 1,
        sortMode: renumberSort,
      });
      setShowRenumberModal(false);
      await fetchRoomLayout(selectedRoomId);
      alert(`Seats renumbered sequentially starting from ${renumberStart}!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to renumber seats');
    }
  };

  // Run Quick Setup Wizard with pure numeric option
  const handleRunWizard = async () => {
    if (!selectedRoomId) return;

    try {
      await api.post(`/floors/rooms/${selectedRoomId}/wizard`, {
        rows: Number(wizardRows),
        columns: Number(wizardCols),
        startNumber: Number(wizardStartNum) || 1,
        numberingPattern: wizardNumberingPattern,
        prefix: wizardPrefix.trim(),
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
    <div className="p-4 md:p-8 space-y-6 max-w-[1680px] mx-auto select-none">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Floor Plan & Seat Management</h1>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Visual 2D Builder with pure numeric seat numbering (1, 2, 3...) and Three Independent Shifts (Morning, Afternoon, Evening)
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
              onClick={() => {
                setBuilderMode('LIVE_SHIFTS');
                setSelectedElement(null);
              }}
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

          {/* Builder Action Toolbar */}
          {builderMode === 'BUILDER' && (
            <div className="flex items-center gap-1.5">
              {/* Undo / Redo */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  title="Undo (Ctrl+Z)"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-40 transition"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  title="Redo (Ctrl+Y)"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-40 transition"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add Seat */}
              <button
                onClick={handleAddSeat}
                className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Seat</span>
              </button>
              <span
                title={
                  numberingAnalysis.missingGaps.length > 0
                    ? `Gap detected! Next seat will fill deleted gap #${numberingAnalysis.nextAvailable}`
                    : `Next sequential seat: #${numberingAnalysis.nextAvailable}`
                }
                className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 hidden sm:inline-block"
              >
                Next: #{numberingAnalysis.nextAvailable}
              </span>

              {/* Add Floor Object Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAddElementDropdown(!showAddElementDropdown)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Object</span>
                </button>
                {showAddElementDropdown && (
                  <div className="absolute left-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs">
                    <button
                      onClick={() => handleAddElement('TABLE')}
                      className="w-full text-left px-3.5 py-2 hover:bg-amber-50 hover:text-amber-800 font-medium transition flex items-center justify-between"
                    >
                      <span>Study Table</span>
                      <span className="text-[10px] text-slate-400">Desk</span>
                    </button>
                    <button
                      onClick={() => handleAddElement('RECEPTION')}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-800 font-medium transition flex items-center justify-between"
                    >
                      <span>Admin / Reception Desk</span>
                      <span className="text-[10px] text-slate-400">Front</span>
                    </button>
                    <button
                      onClick={() => handleAddElement('PARTITION')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 font-medium transition flex items-center justify-between"
                    >
                      <span>Acoustic Partition</span>
                      <span className="text-[10px] text-slate-400">Glass</span>
                    </button>
                    <button
                      onClick={() => handleAddElement('WALL')}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 font-medium transition flex items-center justify-between"
                    >
                      <span>Main Wall</span>
                      <span className="text-[10px] text-slate-400">Divider</span>
                    </button>
                    <button
                      onClick={() => handleAddElement('DOOR')}
                      className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-800 font-medium transition flex items-center justify-between"
                    >
                      <span>Entry / Exit Door</span>
                      <span className="text-[10px] text-slate-400">Door</span>
                    </button>
                    <button
                      onClick={() => handleAddElement('CUSTOM')}
                      className="w-full text-left px-3.5 py-2 hover:bg-purple-50 hover:text-purple-800 font-medium transition flex items-center justify-between"
                    >
                      <span>Custom Object</span>
                      <span className="text-[10px] text-slate-400">Box</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Renumber Seats Tool */}
              <button
                onClick={() => setShowRenumberModal(true)}
                title="Renumber seats sequentially (1, 2, 3...)"
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Renumber</span>
              </button>

              {/* Wizard */}
              <button
                onClick={() => setShowWizardModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-semibold flex items-center space-x-1 transition"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Wizard</span>
              </button>

              {/* Save Layout */}
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
            </div>
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

      {/* Auto-Heal & Gap Analysis Notification Banner */}
      {numberingAnalysis.hasIssues && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center space-x-2.5 text-amber-900">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-extrabold text-amber-900">Numbering Inconsistencies Detected in Room</p>
              <p className="text-[11px] text-amber-700">
                {numberingAnalysis.hasPrefixes && 'Prefixed labels (e.g. S-46, A1) are present. '}
                {numberingAnalysis.duplicates.length > 0 && `Duplicate seat numbers (${numberingAnalysis.duplicates.join(', ')}) detected. `}
                {numberingAnalysis.missingGaps.length > 0 && `Missing gaps in sequence: ${numberingAnalysis.missingGaps.join(', ')}.`}
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoHealNumbers}
            disabled={healingNumbers}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{healingNumbers ? 'Resolving & Standardizing...' : 'Auto-Heal & Standardize Numbers'}</span>
          </button>
        </div>
      )}

      {/* 3-Shift Legend Badge & Canvas Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-900 text-white rounded-2xl text-xs shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-300">Status:</span>
          <div className="flex items-center space-x-1.5 font-semibold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Green = Booked</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Red = Available</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-purple-300 pl-2 border-l border-slate-700">
            <span className="px-1.5 py-0.2 bg-purple-500 text-white rounded text-[10px] font-black">FULL DAY</span>
            <span>All 3 Shifts Reserved</span>
          </div>
        </div>

        {/* Viewport & Canvas Controls: Zoom, Grid, Snap */}
        <div className="flex items-center space-x-3 text-slate-300 text-xs">
          {/* Zoom Controls with Fit to Screen */}
          <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setZoom((prev) => Math.max(0.3, Number((prev - 0.1).toFixed(1))))}
              title="Zoom Out (-10%)"
              className="p-1 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] w-10 text-center font-bold text-white">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((prev) => Math.min(1.8, Number((prev + 0.1).toFixed(1))))}
              title="Zoom In (+10%)"
              className="p-1 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitToScreen}
              title="Fit Full Room to Screen"
              className="px-2 py-0.5 rounded text-[11px] font-bold text-emerald-400 hover:text-white bg-slate-700/70 border border-slate-600 flex items-center space-x-1 transition ml-1"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit Screen</span>
            </button>
            <button
              onClick={() => setZoom(1)}
              title="Reset Zoom to 100%"
              className="px-1.5 py-0.5 text-slate-400 hover:text-white text-[10px] font-mono border-l border-slate-700 ml-1"
            >
              1:1
            </button>
          </div>

          {/* Grid Visibility Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-xl border flex items-center space-x-1 transition ${
              showGrid
                ? 'bg-slate-800 text-emerald-400 border-slate-700'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
            title="Toggle Canvas Grid"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[11px]">Grid</span>
          </button>

          {/* Snap-to-Grid Toggle */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`p-1.5 rounded-xl border flex items-center space-x-1 transition ${
              snapToGrid
                ? 'bg-slate-800 text-blue-400 border-slate-700'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
            title="Toggle Snap to Grid (10px)"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="text-[11px]">Snap</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: VISUAL 2D CANVAS */}
      {viewMode === 'VISUAL' && (
        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[750px]">
          {/* Scrollable Canvas Viewport */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => {
              // Click outside deselects
              setSelectedSeat(null);
              setSelectedElement(null);
              setShowAddElementDropdown(false);
            }}
            className="w-full h-[780px] relative overflow-auto bg-slate-50/70 select-none cursor-default"
          >
            {/* Transform Canvas Layer for Zooming */}
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: `${Math.max(roomData?.width || 1400, 1500)}px`,
                height: `${Math.max(roomData?.height || 900, 950)}px`,
                position: 'relative',
                backgroundImage: showGrid
                  ? 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)'
                  : 'none',
                backgroundSize: '20px 20px',
              }}
            >
              {/* Floor Objects / Elements (Tables, Reception, Partitions, Walls, Doors) */}
              {elements.map((el) => {
                // If element is hidden and we are in Live Shifts mode, do NOT render it
                if (el.isHidden && builderMode === 'LIVE_SHIFTS') return null;

                const isSelected = selectedElement?.id === el.id && builderMode === 'BUILDER';
                const props = el.properties || {};

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleMouseDownElement(e, el)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (builderMode === 'BUILDER') {
                        setSelectedElement(el);
                        setSelectedSeat(null);
                      }
                    }}
                    style={{
                      left: `${el.x}px`,
                      top: `${el.y}px`,
                      width: `${el.width}px`,
                      height: `${el.height}px`,
                      transform: `rotate(${el.rotation}deg)`,
                      backgroundColor: props.bgColor || (el.type === 'TABLE' ? '#fef3c7' : el.type === 'WALL' ? '#334155' : el.type === 'RECEPTION' ? '#e0f2fe' : '#f1f5f9'),
                      borderColor: props.borderColor || (el.type === 'TABLE' ? '#f59e0b' : el.type === 'WALL' ? '#0f172a' : el.type === 'RECEPTION' ? '#0284c7' : '#94a3b8'),
                      borderWidth: `${props.borderWidth ?? (el.type === 'TABLE' ? 2 : 1)}px`,
                      borderStyle: el.type === 'DOOR' ? 'dashed' : 'solid',
                      borderRadius: `${props.borderRadius ?? 6}px`,
                      color: props.textColor || (el.type === 'WALL' ? '#f8fafc' : '#1e293b'),
                      fontSize: `${props.fontSize || 11}px`,
                      fontWeight: (props.fontWeight as any) || 'bold',
                      textAlign: (props.textAlign as any) || 'center',
                      opacity: el.isHidden ? 0.35 : 1,
                    }}
                    className={`absolute flex items-center justify-center tracking-wider transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-500 shadow-xl cursor-move z-30'
                        : builderMode === 'BUILDER'
                        ? 'cursor-move hover:ring-1 hover:ring-blue-300 z-10'
                        : 'z-10'
                    }`}
                  >
                    <span className="truncate px-1.5 flex items-center space-x-1">
                      {el.isHidden && <EyeOff className="w-3 h-3 text-slate-400 inline" />}
                      <span>{el.label}</span>
                      {el.isHidden && <span className="text-[9px] text-slate-400 font-normal">(Hidden)</span>}
                    </span>
                  </div>
                );
              })}

              {/* Seats with Simple Numeric Numbering (1, 2, 3...) */}
              {seats.map((seat) => {
                const isSelected = selectedSeat?.id === seat.id;
                const props = seat.properties || {};

                return (
                  <div
                    key={seat.id}
                    onMouseDown={(e) => handleMouseDownSeat(e, seat)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSeat(seat);
                      setSelectedElement(null);
                    }}
                    style={{
                      left: `${seat.x}px`,
                      top: `${seat.y}px`,
                      width: `${seat.width || 72}px`,
                      height: `${seat.height || 68}px`,
                      transform: `rotate(${seat.rotation || 0}deg)`,
                      borderRadius: `${props.borderRadius ?? 12}px`,
                      backgroundColor: props.bgColor || '#ffffff',
                      borderColor: props.borderColor || (isSelected ? '#2563eb' : '#cbd5e1'),
                      borderWidth: `${props.borderWidth ?? 1}px`,
                      color: props.textColor || '#0f172a',
                    }}
                    className={`absolute flex flex-col justify-between p-1.5 transition-all shadow-xs ${
                      isSelected
                        ? 'border-blue-600 ring-3 ring-blue-500/30 z-20 shadow-md'
                        : 'hover:border-slate-400 hover:shadow-sm z-10'
                    } ${builderMode === 'BUILDER' ? 'cursor-move' : 'cursor-pointer'}`}
                  >
                    {/* Simple Numeric Seat Number Top Bar */}
                    <div className="flex items-center justify-between leading-none">
                      <span
                        className="font-mono font-black"
                        style={{ fontSize: `${props.fontSize ?? 12}px` }}
                      >
                        {seat.seatNumber}
                      </span>
                      {seat.isFullDayOccupied ? (
                        <span className="px-1 py-0.2 bg-purple-600 text-white rounded text-[7px] font-black">
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
                            className="rounded bg-emerald-600 text-white flex flex-col justify-center items-center px-1 shadow-xs cursor-pointer hover:bg-emerald-700 transition"
                            style={{ height: `${(props.indicatorHeight ?? 12) * 2.8}px` }}
                            title={`Full-Day Dedicated: ${seat.fullDayStudent?.fullName || 'Member'}`}
                          >
                            <span
                              className="truncate max-w-[65px] font-bold"
                              style={{ fontSize: `${props.studentFontSize ?? 8}px` }}
                            >
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
                              style={{
                                height: `${props.indicatorHeight ?? 12}px`,
                                fontSize: `${props.shiftFontSize ?? 8}px`,
                              }}
                              className={`rounded flex items-center justify-between px-1 font-bold tracking-tight transition cursor-pointer ${
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
                        <Armchair className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* INSPECTOR PANEL 1: FLOOR ELEMENT INSPECTOR */}
          {selectedElement && builderMode === 'BUILDER' && (
            <div className="absolute right-4 top-4 w-84 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-2xl z-30 space-y-4 max-h-[720px] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Object Settings</h3>
                    <p className="text-[11px] text-slate-400 capitalize">{selectedElement.type.toLowerCase()}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedElement(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Label */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Object Label</label>
                <input
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) => handleUpdateElement({ label: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Size Controls: Width & Height */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">Object Size (px)</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Width */}
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Width</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleUpdateElement({ width: Math.max(30, selectedElement.width - 10) })}
                        className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="20"
                        max="800"
                        value={selectedElement.width}
                        onChange={(e) => handleUpdateElement({ width: Number(e.target.value) })}
                        className="w-full text-center bg-white border border-slate-200 rounded py-0.5 font-mono font-bold"
                      />
                      <button
                        onClick={() => handleUpdateElement({ width: Math.min(800, selectedElement.width + 10) })}
                        className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Height */}
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1">Height</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleUpdateElement({ height: Math.max(10, selectedElement.height - 10) })}
                        className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="10"
                        max="800"
                        value={selectedElement.height}
                        onChange={(e) => handleUpdateElement({ height: Number(e.target.value) })}
                        className="w-full text-center bg-white border border-slate-200 rounded py-0.5 font-mono font-bold"
                      />
                      <button
                        onClick={() => handleUpdateElement({ height: Math.min(800, selectedElement.height + 10) })}
                        className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Size Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleUpdateElement({ width: 140, height: 40 })}
                    className="flex-1 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700"
                  >
                    Small
                  </button>
                  <button
                    onClick={() => handleUpdateElement({ width: 220, height: 50 })}
                    className="flex-1 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700"
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => handleUpdateElement({ width: 340, height: 65 })}
                    className="flex-1 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700"
                  >
                    Large
                  </button>
                </div>
              </div>

              {/* Font Size & Alignment */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">Text Typography</label>
                <div className="flex items-center gap-1.5">
                  {[9, 11, 13, 16].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => handleUpdateElement({ properties: { fontSize: sz } })}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold border transition ${
                        (selectedElement.properties?.fontSize || 11) === sz
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {sz}px
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {/* Font Weight */}
                  <button
                    onClick={() =>
                      handleUpdateElement({
                        properties: {
                          fontWeight: selectedElement.properties?.fontWeight === 'bold' ? 'normal' : 'bold',
                        },
                      })
                    }
                    className={`flex-1 py-1 rounded-lg text-xs font-bold border transition ${
                      selectedElement.properties?.fontWeight === 'bold'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Bold Text
                  </button>

                  {/* Text Align */}
                  {['left', 'center', 'right'].map((align) => (
                    <button
                      key={align}
                      onClick={() => handleUpdateElement({ properties: { textAlign: align } })}
                      className={`flex-1 py-1 rounded-lg text-[10px] uppercase font-bold border transition ${
                        (selectedElement.properties?.textAlign || 'center') === align
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Swatches */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700">Color Palette</label>
                <div className="flex items-center gap-2">
                  {[
                    { bg: '#fef3c7', border: '#f59e0b', text: '#78350f', name: 'Amber' },
                    { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1', name: 'Blue' },
                    { bg: '#ecfdf5', border: '#10b981', text: '#065f46', name: 'Green' },
                    { bg: '#faf5ff', border: '#a855f7', text: '#6b21a8', name: 'Purple' },
                    { bg: '#334155', border: '#0f172a', text: '#f8fafc', name: 'Slate' },
                    { bg: '#ffffff', border: '#cbd5e1', text: '#0f172a', name: 'White' },
                  ].map((c) => (
                    <button
                      key={c.name}
                      onClick={() =>
                        handleUpdateElement({
                          properties: {
                            bgColor: c.bg,
                            borderColor: c.border,
                            textColor: c.text,
                          },
                        })
                      }
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                      className="w-7 h-7 rounded-lg border-2 shadow-xs hover:scale-110 transition"
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Hide / Show Object */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Visibility:</span>
                <button
                  onClick={() => handleToggleHideElement(selectedElement)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition ${
                    selectedElement.isHidden
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {selectedElement.isHidden ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hidden (Click to Show)</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visible (Click to Hide)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Actions: Duplicate & Delete */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleDuplicateElement(selectedElement)}
                  className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center space-x-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={() => handleDeleteElement(selectedElement)}
                  className="flex-1 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center justify-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Object</span>
                </button>
              </div>
            </div>
          )}

          {/* INSPECTOR PANEL 2: SEAT INSPECTOR (Live View OR Builder Mode) */}
          {selectedSeat && (
            <div className="absolute right-4 top-4 w-84 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-5 shadow-2xl z-30 space-y-4 max-h-[720px] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
                    {selectedSeat.seatNumber}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Seat {selectedSeat.seatNumber}</h3>
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

              {/* BUILDER MODE CONTROLS FOR SEAT */}
              {builderMode === 'BUILDER' && (
                <div className="space-y-3.5 pb-3 border-b border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Seat Customization
                  </h4>

                  {/* Seat Number (Simple Numeric) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Seat Number (Simple Numeric)
                    </label>
                    <input
                      type="text"
                      value={selectedSeat.seatNumber}
                      onChange={(e) => handleUpdateSeat({ seatNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 1, 2, 3"
                    />
                  </div>

                  {/* Seat Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Seat Type</label>
                    <select
                      value={selectedSeat.type}
                      onChange={(e) => handleUpdateSeat({ type: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="STANDARD">Standard Desk</option>
                      <option value="PREMIUM">Premium Desk</option>
                      <option value="CABIN">Private Cabin</option>
                      <option value="CORNER">Corner Desk</option>
                    </select>
                  </div>

                  {/* Seat Size */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-semibold block mb-1">Width</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleUpdateSeat({ width: Math.max(50, (selectedSeat.width || 72) - 5) })}
                          className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <span className="w-full text-center font-mono font-bold">{selectedSeat.width || 72}px</span>
                        <button
                          onClick={() => handleUpdateSeat({ width: Math.min(140, (selectedSeat.width || 72) + 5) })}
                          className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-semibold block mb-1">Height</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleUpdateSeat({ height: Math.max(45, (selectedSeat.height || 68) - 5) })}
                          className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <span className="w-full text-center font-mono font-bold">{selectedSeat.height || 68}px</span>
                        <button
                          onClick={() => handleUpdateSeat({ height: Math.min(140, (selectedSeat.height || 68) + 5) })}
                          className="w-6 h-6 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Seat Font Size */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Number Font Size</label>
                    <div className="flex items-center gap-1.5">
                      {[11, 13, 15, 18].map((fs) => (
                        <button
                          key={fs}
                          onClick={() => handleUpdateSeat({ properties: { fontSize: fs } })}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold border transition ${
                            (selectedSeat.properties?.fontSize || 13) === fs
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {fs}px
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate & Delete Seat */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleDuplicateSeat(selectedSeat)}
                      className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center space-x-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSeat(selectedSeat.id)}
                      className="flex-1 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center justify-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Seat</span>
                    </button>
                  </div>
                </div>
              )}

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
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: RESPONSIVE GRID CARD VIEW */}
      {viewMode === 'GRID' && (
        <div className="space-y-4">
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
                    <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-extrabold flex items-center justify-center text-sm font-mono">
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

      {/* MODAL 1: RENUMBER SEATS MODAL */}
      {showRenumberModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-blue-600 font-bold">
                <Hash className="w-5 h-5" />
                <h3 className="text-base text-slate-900">Renumber Seats</h3>
              </div>
              <button onClick={() => setShowRenumberModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Renumber all seats in this room sequentially (1, 2, 3...) starting from your chosen number.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Starting Number</label>
                <input
                  type="number"
                  min="1"
                  value={renumberStart}
                  onChange={(e) => setRenumberStart(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ordering Mode</label>
                <select
                  value={renumberSort}
                  onChange={(e: any) => setRenumberSort(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="POSITION">By Position (Row-by-Row, Top to Bottom)</option>
                  <option value="CURRENT">Keep Current Numeric Sequence</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl text-blue-800 text-xs">
              Will sequentially update <strong>{seats.length}</strong> seats starting at <strong>{renumberStart}</strong>.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowRenumberModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRenumber}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
              >
                Renumber Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK SETUP WIZARD */}
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
              Automatically generate an organized grid of seats with pure numeric numbering (1, 2, 3...).
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Starting Number</label>
                <input
                  type="number"
                  min="1"
                  value={wizardStartNum}
                  onChange={(e) => setWizardStartNum(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Numbering Style</label>
                <select
                  value={wizardNumberingPattern}
                  onChange={(e: any) => setWizardNumberingPattern(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="NUMERIC">Pure Numeric (1, 2, 3...)</option>
                  <option value="ALPHA_ROW">Alphabetical Rows (A1, B1...)</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl text-purple-800 text-xs">
              Will generate <strong>{wizardRows * wizardCols}</strong> organized seats (from {wizardStartNum} to{' '}
              {wizardStartNum + wizardRows * wizardCols - 1}) into this room.
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

      {/* MODAL 3: SEAT BOOKING MODAL */}
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

      {/* MODAL 4: SEAT TRANSFER MODAL */}
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
                        Seat {s.seatNumber} ({s.type})
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
