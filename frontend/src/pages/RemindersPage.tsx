import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Mail,
  Send,
  Settings,
  History,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Zap,
  Phone,
  Search,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import { ReminderLog, ReminderSetting } from '../types/index.js';

export const RemindersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'UNPAID' | 'SETTINGS' | 'LOGS'>('UNPAID');
  const [unpaidList, setUnpaidList] = useState<any[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [settings, setSettings] = useState<ReminderSetting | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL' | 'BOTH'>('BOTH');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoTriggering, setAutoTriggering] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'UNPAID') {
        const res = await api.get('/reminders/unpaid');
        setUnpaidList(res.data.unpaidList);
      } else if (activeTab === 'LOGS') {
        const res = await api.get('/reminders/logs');
        setLogs(res.data.logs);
      } else if (activeTab === 'SETTINGS') {
        const res = await api.get('/settings/reminders');
        setSettings(res.data.settings);
        setSettingsForm(res.data.settings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(unpaidList.map((u) => u.studentId));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleSelect = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Dispatch Manual Reminders
  const handleSendReminders = async () => {
    if (selectedStudentIds.length === 0) return;
    setSending(true);

    try {
      const res = await api.post('/reminders/send', {
        studentIds: selectedStudentIds,
        channel,
      });

      setShowPreviewModal(false);
      setSelectedStudentIds([]);
      alert(res.data.message || 'Reminders dispatched successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to dispatch reminders');
    } finally {
      setSending(false);
    }
  };

  // Trigger Auto-Reminders Manually
  const handleTriggerAutoJob = async () => {
    setAutoTriggering(true);
    try {
      const res = await api.post('/reminders/trigger-auto');
      alert(res.data.message);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to run auto-reminder job');
    } finally {
      setAutoTriggering(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/settings/reminders', settingsForm);
      alert('Reminder configuration updated successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update reminder settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fee Reminders Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta Cloud WhatsApp & Gmail SMTP integration with realistic simulation modes and delivery logs
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleTriggerAutoJob}
            disabled={autoTriggering}
            className="px-3.5 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition"
          >
            <Zap className={`w-4 h-4 ${autoTriggering ? 'animate-spin' : ''}`} />
            <span>Trigger Auto Scan</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('UNPAID')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'UNPAID'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Unpaid Students Queue ({unpaidList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'SETTINGS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Automated Reminder Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`pb-3 px-2 border-b-2 flex items-center space-x-1.5 transition ${
            activeTab === 'LOGS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Delivery & Simulation Logs</span>
        </button>
      </div>

      {/* TAB 1: UNPAID STUDENTS QUEUE */}
      {activeTab === 'UNPAID' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700">
                {selectedStudentIds.length} student(s) selected
              </span>
              <div className="flex items-center space-x-1 text-xs">
                <span className="text-slate-400">Via:</span>
                <select
                  value={channel}
                  onChange={(e: any) => setChannel(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="BOTH">WhatsApp & Email</option>
                  <option value="WHATSAPP">WhatsApp Only</option>
                  <option value="EMAIL">Email Only</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowPreviewModal(true)}
              disabled={selectedStudentIds.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm disabled:opacity-40 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Preview & Dispatch Reminders</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedStudentIds.length === unpaidList.length && unpaidList.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Assigned Desk</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Balance Dues</th>
                  <th className="py-3.5 px-4">Contact Details</th>
                  <th className="py-3.5 px-4">Last Reminder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : unpaidList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-emerald-600">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                      All student accounts are currently paid in full!
                    </td>
                  </tr>
                ) : (
                  unpaidList.map((item) => (
                    <tr key={item.invoiceId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(item.studentId)}
                          onChange={() => handleToggleSelect(item.studentId)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{item.studentName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.admissionNumber}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {item.seatNumber} ({item.shiftName})
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            item.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {new Date(item.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        {item.isOverdue && (
                          <span className="block text-[9px] text-rose-500 font-bold">OVERDUE</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-black text-rose-600 text-sm">
                        ₹{item.balanceAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <p>{item.phone}</p>
                        {item.email && <p className="text-[10px] text-slate-400">{item.email}</p>}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {item.lastReminderSentAt ? (
                          <span>
                            {new Date(item.lastReminderSentAt).toLocaleDateString('en-IN')} (
                            {item.lastReminderStatus})
                          </span>
                        ) : (
                          <span className="italic">Never</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATED REMINDER SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl">
          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Automatic Reminder Triggers</h3>
                <p className="text-xs text-slate-500">
                  Daily background cron scans unpaid invoices and dispatches scheduled alerts
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.autoRemindersEnabled || false}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, autoRemindersEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendWhatsApp"
                  checked={settingsForm.sendWhatsApp || false}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, sendWhatsApp: e.target.checked })
                  }
                  className="rounded border-slate-300 text-emerald-600"
                />
                <label htmlFor="sendWhatsApp" className="font-bold text-slate-700">
                  Send WhatsApp Reminders
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={settingsForm.sendEmail || false}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, sendEmail: e.target.checked })
                  }
                  className="rounded border-slate-300 text-emerald-600"
                />
                <label htmlFor="sendEmail" className="font-bold text-slate-700">
                  Send Email Reminders
                </label>
              </div>
            </div>

            {/* Template Editors */}
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  WhatsApp Reminder Template
                </label>
                <textarea
                  rows={3}
                  value={settingsForm.whatsappTemplate || ''}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, whatsappTemplate: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-800"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Available tags: <code>{'{student_name}'}</code>, <code>{'{amount_due}'}</code>,{' '}
                  <code>{'{due_date}'}</code>, <code>{'{seat_number}'}</code>,{' '}
                  <code>{'{library_name}'}</code>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Subject</label>
                <input
                  type="text"
                  value={settingsForm.emailSubjectTemplate || ''}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, emailSubjectTemplate: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Reminder Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Message Snippet</th>
                <th className="py-3.5 px-4">Status & Mode</th>
                <th className="py-3.5 px-4">Dispatched At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    No reminder logs found yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-800 flex items-center space-x-1.5">
                      {log.channel === 'WHATSAPP' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>{log.channel}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{log.student?.fullName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {log.recipientContact}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-sm truncate">
                      {log.messageContent}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            log.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'SIMULATED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.simulated && (
                          <span className="text-[10px] font-semibold text-amber-600">
                            (Simulation Mode)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {new Date(log.sentAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PREVIEW & SEND MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Preview & Confirm Dispatch
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-amber-900 text-xs flex items-start space-x-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Sending reminders to <strong>{selectedStudentIds.length}</strong> selected
                recipient(s) via <strong>{channel}</strong>. Dynamic fields will be substituted
                automatically for each student.
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap">
              Dear {'{student_name}'}, this is a reminder from Apex Study Library. Your library fee
              of ₹{'{amount_due}'} for seat {'{seat_number}'} is due on {'{due_date}'}. Please pay
              to continue your reserved desk.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReminders}
                disabled={sending}
                className="px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white text-xs shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Dispatching...' : 'Confirm & Send Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
