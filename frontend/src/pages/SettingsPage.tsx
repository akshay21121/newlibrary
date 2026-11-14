import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Clock,
  Database,
  Shield,
  Save,
  Download,
  Upload,
  RefreshCw,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api } from '../services/api.js';
import { LibraryProfile, Shift } from '../types/index.js';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SHIFTS' | 'BACKUP' | 'AUDIT'>('PROFILE');
  const [profile, setProfile] = useState<LibraryProfile | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [formData, setFormData] = useState<any>({});
  const [facilityInput, setFacilityInput] = useState('');

  // Shift edit state
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftEditForm, setShiftEditForm] = useState<any>({});

  useEffect(() => {
    fetchSettingsData();
  }, [activeTab]);

  const fetchSettingsData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'PROFILE') {
        const res = await api.get('/settings/profile');
        setProfile(res.data.profile);
        setFormData(res.data.profile);
      } else if (activeTab === 'SHIFTS') {
        const res = await api.get('/settings/shifts');
        setShifts(res.data.shifts);
      } else if (activeTab === 'BACKUP') {
        const res = await api.get('/system/backups');
        setBackups(res.data.backups);
      } else if (activeTab === 'AUDIT') {
        const res = await api.get('/system/audit-logs');
        setAuditLogs(res.data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/profile', formData);
      alert('Library profile and settings saved successfully!');
      fetchSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleShiftUpdate = async (shiftId: string) => {
    try {
      await api.put(`/settings/shifts/${shiftId}`, shiftEditForm);
      setEditingShiftId(null);
      alert('Shift timings updated successfully!');
      fetchSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update shift');
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await api.post('/system/backup');
      alert(`Backup snapshot created successfully: ${res.data.fileName}`);
      fetchSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Backup creation failed');
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!confirm(`Warning: Restoring from snapshot '${fileName}' will overwrite current database state. Proceed?`)) return;

    try {
      await api.post('/system/restore', { fileName });
      alert('Database restored successfully!');
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Restore failed');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Library Settings & Security</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          General library branding, shifts configuration, database backup snapshots, and audit trail
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-200 text-xs font-bold">
        {[
          { key: 'PROFILE', label: 'Library Profile & Receipts', icon: Building },
          { key: 'SHIFTS', label: '3 Shifts Configuration', icon: Clock },
          { key: 'BACKUP', label: 'Database Backup & Restore', icon: Database },
          { key: 'AUDIT', label: 'Audit Trail', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE */}
      {activeTab === 'PROFILE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl">
          <form onSubmit={handleProfileSubmit} className="space-y-6 text-xs">
            {/* General Info */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900">General Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Library Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Admin Contact Phone</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Physical Address & Tax Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={formData.gstin || ''}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Hours */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Operating Hours</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={formData.openingTime || '06:00'}
                    onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={formData.closingTime || '23:30'}
                    onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Header & Footer */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Receipt Customization</h3>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Header Text</label>
                <textarea
                  rows={2}
                  value={formData.receiptHeader || ''}
                  onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Footer & Disclaimers</label>
                <textarea
                  rows={2}
                  value={formData.receiptFooter || ''}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SHIFTS */}
      {activeTab === 'SHIFTS' && (
        <div className="space-y-4 max-w-4xl">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
            <strong>Three Independent Shifts Architecture:</strong> Each seat independently tracks
            Morning, Afternoon, and Evening reservations. Update timings or names below.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {shifts.map((sh) => (
              <div
                key={sh.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">{sh.code}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>

                  {editingShiftId === sh.id ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-0.5">Name</label>
                        <input
                          type="text"
                          value={shiftEditForm.name || ''}
                          onChange={(e) =>
                            setShiftEditForm({ ...shiftEditForm, name: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-0.5">Start</label>
                          <input
                            type="text"
                            value={shiftEditForm.startTime || ''}
                            onChange={(e) =>
                              setShiftEditForm({ ...shiftEditForm, startTime: e.target.value })
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-0.5">End</label>
                          <input
                            type="text"
                            value={shiftEditForm.endTime || ''}
                            onChange={(e) =>
                              setShiftEditForm({ ...shiftEditForm, endTime: e.target.value })
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <h3 className="font-black text-slate-900 text-base">{sh.name}</h3>
                      <p className="font-mono text-xs text-emerald-600 font-bold mt-1">
                        {sh.startTime} – {sh.endTime}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  {editingShiftId === sh.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingShiftId(null)}
                        className="px-2.5 py-1 text-slate-500 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleShiftUpdate(sh.id)}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingShiftId(sh.id);
                        setShiftEditForm(sh);
                      }}
                      className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Edit Timings
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BACKUP */}
      {activeTab === 'BACKUP' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Database Backup Snapshots</h3>
              <p className="text-xs text-slate-500">
                Create point-in-time snapshots of all library records or restore from previous backup
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm"
            >
              <Database className="w-4 h-4" />
              <span>Create New Backup</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {backups.length === 0 ? (
              <p className="py-8 text-center text-slate-400">No backup snapshots found.</p>
            ) : (
              backups.map((b) => (
                <div key={b.fileName} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-slate-800">{b.fileName}</p>
                    <p className="text-[10px] text-slate-400">
                      Size: {(b.sizeBytes / 1024).toFixed(1)} KB • Created:{' '}
                      {new Date(b.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreBackup(b.fileName)}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-[11px]"
                  >
                    Restore Snapshot
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-800">{log.entityType}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700">{log.action}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(log.createdAt).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

