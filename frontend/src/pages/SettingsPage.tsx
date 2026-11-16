import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building,
  User,
  Sparkles,
  Clock,
  Database,
  Shield,
  Save,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Lock,
  Camera,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { LibraryProfile, Shift } from '../types/index.js';

export const SettingsPage: React.FC = () => {
  const { admin, profile: globalProfile, updateAdmin, updateProfile, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'PROFILE' | 'ADMIN' | 'BRANDING' | 'SHIFTS' | 'BACKUP' | 'AUDIT'
  >('PROFILE');

  const [profile, setProfile] = useState<LibraryProfile | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Profile form state (Tab 1)
  const [formData, setFormData] = useState<any>({});

  // Admin Account state (Tab 2)
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Branding form state (Tab 3)
  const [brandingForm, setBrandingForm] = useState({
    name: '',
    projectDisplayName: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Shift edit state (Tab 4)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftEditForm, setShiftEditForm] = useState<any>({});

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (success: string | null, error: string | null = null) => {
    setSuccessMessage(success);
    setErrorMessage(error);
    if (success) {
      setTimeout(() => setSuccessMessage(null), 4000);
    }
    if (error) {
      setTimeout(() => setErrorMessage(null), 6000);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchSettingsData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'PROFILE' || activeTab === 'BRANDING') {
        const res = await api.get('/settings/profile');
        setProfile(res.data.profile);
        setFormData(res.data.profile);
        setBrandingForm({
          name: res.data.profile.name || '',
          projectDisplayName: res.data.profile.projectDisplayName || '',
          tagline: res.data.profile.tagline || '',
          phone: res.data.profile.phone || '',
          email: res.data.profile.email || '',
          address: res.data.profile.address || '',
          logoUrl: res.data.profile.logoUrl || '',
        });
      } else if (activeTab === 'ADMIN') {
        const meRes = await api.get('/auth/me');
        if (meRes.data?.admin) {
          setAdminForm({
            name: meRes.data.admin.name || '',
            email: meRes.data.admin.email || '',
            phone: meRes.data.admin.phone || '',
            avatarUrl: meRes.data.admin.avatarUrl || '',
          });
          updateAdmin(meRes.data.admin);
        }
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
    } catch (err: any) {
      console.error(err);
      showNotification(null, err.response?.data?.error || 'Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, [activeTab]);

  // Handle Tab 1: Library Profile Submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/settings/profile', formData);
      setProfile(res.data.profile);
      updateProfile(res.data.profile);
      showNotification('Library profile & receipt templates saved successfully!');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to save library profile');
    } finally {
      setSaving(false);
    }
  };

  // Handle Tab 2: Admin Profile Submit
  const handleAdminProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', {
        name: adminForm.name,
        email: adminForm.email,
        phone: adminForm.phone,
      });

      updateAdmin(res.data.admin);
      showNotification('Admin profile details updated successfully! Sidebar reflects changes.');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to update admin profile');
    } finally {
      setSaving(false);
    }
  };

  // Handle Tab 2: Admin Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));

    const data = new FormData();
    data.append('avatar', file);

    setUploadingAvatar(true);
    try {
      const res = await api.post('/auth/avatar', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateAdmin(res.data.admin);
      setAdminForm((prev) => ({ ...prev, avatarUrl: res.data.avatarUrl }));
      showNotification('Profile photo uploaded and updated in sidebar!');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Tab 2: Remove Avatar
  const handleRemoveAvatar = async () => {
    if (!confirm('Remove profile photo?')) return;
    try {
      const res = await api.put('/auth/profile', { avatarUrl: null });
      updateAdmin(res.data.admin);
      setAdminForm((prev) => ({ ...prev, avatarUrl: '' }));
      setAvatarPreview(null);
      showNotification('Profile photo removed.');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to remove photo');
    }
  };

  // Handle Tab 2: Change Password Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showNotification(null, 'New password and confirm password do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showNotification(null, 'New password must be at least 6 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification('Admin password changed successfully! Use your new password on next login.');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to change password. Verify your current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Handle Tab 3: Branding Submit
  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/settings/profile', {
        name: brandingForm.name,
        projectDisplayName: brandingForm.projectDisplayName,
        tagline: brandingForm.tagline,
        phone: brandingForm.phone,
        email: brandingForm.email,
        address: brandingForm.address,
      });

      setProfile(res.data.profile);
      updateProfile(res.data.profile);
      showNotification('Library identity and branding updated! Sidebar and headers updated.');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  // Handle Tab 3: Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));

    const data = new FormData();
    data.append('logo', file);

    setUploadingLogo(true);
    try {
      const res = await api.post('/settings/logo', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile(res.data.profile);
      updateProfile(res.data.profile);
      setBrandingForm((prev) => ({ ...prev, logoUrl: res.data.logoUrl }));
      showNotification('Library logo uploaded and updated across application!');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to upload library logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Tab 3: Remove Logo
  const handleRemoveLogo = async () => {
    if (!confirm('Remove library logo? Default icon will be used.')) return;
    try {
      const res = await api.put('/settings/profile', { logoUrl: null });
      setProfile(res.data.profile);
      updateProfile(res.data.profile);
      setBrandingForm((prev) => ({ ...prev, logoUrl: '' }));
      setLogoPreview(null);
      showNotification('Library logo removed.');
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to remove logo');
    }
  };

  // Handle Tab 4: Shift Update
  const handleShiftUpdate = async (shiftId: string) => {
    try {
      await api.put(`/settings/shifts/${shiftId}`, shiftEditForm);
      setEditingShiftId(null);
      showNotification('Shift timings updated successfully!');
      fetchSettingsData();
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Failed to update shift');
    }
  };

  // Handle Tab 5: Create Backup
  const handleCreateBackup = async () => {
    try {
      const res = await api.post('/system/backup');
      showNotification(`Backup snapshot created successfully: ${res.data.fileName}`);
      fetchSettingsData();
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Backup creation failed');
    }
  };

  // Handle Tab 5: Restore Backup
  const handleRestoreBackup = async (fileName: string) => {
    if (
      !confirm(
        `Warning: Restoring from snapshot '${fileName}' will overwrite current database state. Proceed?`
      )
    )
      return;

    try {
      await api.post('/system/restore', { fileName });
      alert('Database restored successfully! Reloading application...');
      window.location.reload();
    } catch (err: any) {
      showNotification(null, err.response?.data?.error || 'Restore failed');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Library Settings & Security</h1>
        <p className="text-xs text-slate-600 font-medium mt-0.5">
          General library branding, admin profile & credentials, shifts configuration, backups, and audit trail
        </p>
      </div>

      {/* Floating Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-center space-x-2 shadow-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs - 6 Organized Sections */}
      <div className="flex items-center space-x-2 overflow-x-auto border-b border-slate-200 text-xs font-bold pb-px">
        {[
          { key: 'PROFILE', label: '1. Library Profile & Receipts', icon: Building },
          { key: 'ADMIN', label: '2. Admin Profile & Account', icon: User },
          { key: 'BRANDING', label: '3. Library Identity & Branding', icon: Sparkles },
          { key: 'SHIFTS', label: '4. 3 Shifts Configuration', icon: Clock },
          { key: 'BACKUP', label: '5. Database Backup & Restore', icon: Database },
          { key: 'AUDIT', label: '6. Audit Trail', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-700 font-extrabold bg-emerald-50/40 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LIBRARY PROFILE & RECEIPTS */}
      {activeTab === 'PROFILE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Library Profile & Receipts</h2>
            <p className="text-xs text-slate-600 font-medium">
              Configure official library contact info, tax details, and official receipt header/footer templates
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-6 text-xs">
            {/* General Info */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 pb-1 border-b border-slate-100">
                General Library Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">Library Name *</label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.name || '', 'lib_name')}
                      className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {copiedKey === 'lib_name' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'lib_name' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                    placeholder="e.g. Apex Study Library"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                    placeholder="e.g. Your Silent Haven for Focused Learning"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">Admin Contact Phone</label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.phone || '', 'lib_phone')}
                      className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {copiedKey === 'lib_phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'lib_phone' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">Admin Email</label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.email || '', 'lib_email')}
                      className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {copiedKey === 'lib_email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'lib_email' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                    placeholder="admin@apexlibrary.com"
                  />
                </div>
              </div>
            </div>

            {/* Address & GSTIN */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 pb-1 border-b border-slate-100">
                Physical Address & Tax Identification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">Street Address</label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.address || '', 'lib_address')}
                      className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {copiedKey === 'lib_address' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'lib_address' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                    placeholder="Plot 42, Knowledge Park, Central Avenue"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-800">GSTIN / Tax ID</label>
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.gstin || '', 'lib_gstin')}
                      className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                    >
                      {copiedKey === 'lib_gstin' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'lib_gstin' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.gstin || ''}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition font-mono"
                    placeholder="07AAAAA0000A1Z5"
                  />
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 pb-1 border-b border-slate-100">
                Operating Hours
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={formData.openingTime || '06:00'}
                    onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={formData.closingTime || '23:30'}
                    onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Header & Footer */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 pb-1 border-b border-slate-100">
                Receipt Customization (Selectable & Copyable)
              </h3>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-800">Receipt Header Text</label>
                  <button
                    type="button"
                    onClick={() => handleCopy(formData.receiptHeader || '', 'receipt_header')}
                    className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    {copiedKey === 'receipt_header' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'receipt_header' ? 'Copied' : 'Copy Header'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.receiptHeader || ''}
                  onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-medium text-xs placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="APEX STUDY LIBRARY&#10;Official Fee Receipt"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-800">Receipt Footer & Disclaimers</label>
                  <button
                    type="button"
                    onClick={() => handleCopy(formData.receiptFooter || '', 'receipt_footer')}
                    className="text-[10px] text-slate-500 hover:text-emerald-600 font-bold flex items-center space-x-0.5 cursor-pointer"
                  >
                    {copiedKey === 'receipt_footer' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'receipt_footer' ? 'Copied' : 'Copy Footer'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.receiptFooter || ''}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-medium text-xs placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="Thank you for choosing Apex Library. Fees once paid are non-refundable."
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-700/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile & Receipt Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: ADMIN PROFILE & ACCOUNT SETTINGS */}
      {activeTab === 'ADMIN' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Admin Profile & Account Settings</h2>
            <p className="text-xs text-slate-600 font-medium">
              Manage your administrator name, contact information, profile avatar, and secure login credentials
            </p>
          </div>

          {/* Current Admin Snapshot Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="relative">
                {adminForm.avatarUrl ? (
                  <img
                    src={adminForm.avatarUrl}
                    alt={adminForm.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-800 text-emerald-400 font-black text-xl flex items-center justify-center border-2 border-slate-700 shadow-md">
                    {adminForm.name?.charAt(0) || 'A'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Upload profile photo"
                  className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-md transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">{adminForm.name || 'Administrator'}</h3>
                <p className="text-xs text-slate-600 font-medium">{adminForm.email}</p>
                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full mt-1">
                  Single-Admin Account
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center space-x-1 transition cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
              </button>
              {adminForm.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="p-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Section 1: Admin Profile Details */}
          <form onSubmit={handleAdminProfileSubmit} className="space-y-4 text-xs pt-2">
            <h3 className="font-extrabold text-sm text-slate-900 pb-1 border-b border-slate-100 flex items-center space-x-1.5">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Personal Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Admin Display Name *</label>
                <input
                  type="text"
                  required
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="e.g. Administrator"
                />
                <p className="text-[10px] text-slate-500 mt-1">Appears in sidebar footer and audit logs</p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Admin Email Address *</label>
                <input
                  type="email"
                  required
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="admin@apexlibrary.com"
                />
                <p className="text-[10px] text-slate-500 mt-1">Used for login authentication</p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  value={adminForm.phone}
                  onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-700/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Updating...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>

          {/* Section 2: Change Login Password */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs pt-4 border-t border-slate-200">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Change Login Password</span>
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Verification of your current password is required before setting a new login password.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Current Password *</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-9 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition font-mono"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">New Password (Min 6 chars) *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-9 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition font-mono"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm shadow-amber-700/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                <Lock className="w-4 h-4" />
                <span>{savingPassword ? 'Changing Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: LIBRARY IDENTITY & BRANDING */}
      {activeTab === 'BRANDING' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Library Identity & Branding</h2>
            <p className="text-xs text-slate-600 font-medium">
              Update library brand name, project display label, custom logo, and sidebar branding
            </p>
          </div>

          {/* Live Preview Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 flex items-center space-x-4">
            {brandingForm.logoUrl ? (
              <img
                src={brandingForm.logoUrl}
                alt="Brand Logo"
                className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-slate-700 shadow-md shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-950 shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="truncate">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Sidebar & Portal Header Live Preview
              </span>
              <h3 className="font-extrabold text-base text-white tracking-tight truncate">
                {brandingForm.projectDisplayName || brandingForm.name || 'Apex Library'}
              </h3>
              <p className="text-xs text-slate-300 truncate">
                {brandingForm.tagline || 'Single-Admin Portal'}
              </p>
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shadow-xs">
                {brandingForm.logoUrl ? (
                  <img src={brandingForm.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Sparkles className="w-7 h-7 text-emerald-600" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Library Brand Logo</h4>
                <p className="text-[11px] text-slate-500">
                  Recommended size: 200x200 PNG or SVG with transparent background
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingLogo ? 'Uploading Logo...' : 'Upload Logo'}</span>
              </button>
              {brandingForm.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="p-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Remove Logo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Branding Form */}
          <form onSubmit={handleBrandingSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Library Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={brandingForm.name}
                  onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="e.g. Apex Study Library"
                />
                <p className="text-[10px] text-slate-500 mt-1">Used on invoices and formal documentation</p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Project Display Name *</label>
                <input
                  type="text"
                  required
                  value={brandingForm.projectDisplayName}
                  onChange={(e) =>
                    setBrandingForm({ ...brandingForm, projectDisplayName: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="e.g. Apex Library"
                />
                <p className="text-[10px] text-slate-500 mt-1">Appears in sidebar header and page titles</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">Library Tagline</label>
                <input
                  type="text"
                  value={brandingForm.tagline}
                  onChange={(e) => setBrandingForm({ ...brandingForm, tagline: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="e.g. Your Silent Haven for Focused Learning"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Library Contact Number</label>
                <input
                  type="tel"
                  value={brandingForm.phone}
                  onChange={(e) => setBrandingForm({ ...brandingForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Library Email Address</label>
                <input
                  type="email"
                  value={brandingForm.email}
                  onChange={(e) => setBrandingForm({ ...brandingForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="contact@apexlibrary.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">Library Address</label>
                <input
                  type="text"
                  value={brandingForm.address}
                  onChange={(e) => setBrandingForm({ ...brandingForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 select-text transition"
                  placeholder="Plot 42, Knowledge Park, Central Avenue"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-700/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Branding & Identity'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: 3 SHIFTS CONFIGURATION */}
      {activeTab === 'SHIFTS' && (
        <div className="space-y-4 max-w-4xl">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
            <strong>Three Independent Shifts Architecture:</strong> Each seat independently tracks
            Morning, Afternoon, and Evening reservations. Update timings or shift labels below.
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
                        <label className="font-bold text-slate-800 block mb-0.5">Shift Name</label>
                        <input
                          type="text"
                          value={shiftEditForm.name || ''}
                          onChange={(e) =>
                            setShiftEditForm({ ...shiftEditForm, name: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:bg-white focus:border-emerald-500 focus:outline-none select-text transition"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold text-slate-800 block mb-0.5">Start Time</label>
                          <input
                            type="text"
                            value={shiftEditForm.startTime || ''}
                            onChange={(e) =>
                              setShiftEditForm({ ...shiftEditForm, startTime: e.target.value })
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold font-mono focus:bg-white focus:border-emerald-500 focus:outline-none select-text transition"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-800 block mb-0.5">End Time</label>
                          <input
                            type="text"
                            value={shiftEditForm.endTime || ''}
                            onChange={(e) =>
                              setShiftEditForm({ ...shiftEditForm, endTime: e.target.value })
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold font-mono focus:bg-white focus:border-emerald-500 focus:outline-none select-text transition"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <h3 className="font-black text-slate-900 text-base">{sh.name}</h3>
                      <p className="font-mono text-xs text-emerald-700 font-bold mt-1">
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
                        className="px-3 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleShiftUpdate(sh.id)}
                        className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
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
                      className="px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition"
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

      {/* TAB 5: DATABASE BACKUP & RESTORE */}
      {activeTab === 'BACKUP' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Database Backup Snapshots</h3>
              <p className="text-xs text-slate-600 font-medium">
                Create point-in-time snapshots of all library records or restore from previous backup
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer transition"
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
                    <p className="font-mono font-bold text-slate-900">{b.fileName}</p>
                    <p className="text-[11px] text-slate-500">
                      Size: {(b.sizeBytes / 1024).toFixed(1)} KB • Created:{' '}
                      {new Date(b.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreBackup(b.fileName)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 font-bold text-xs cursor-pointer transition"
                  >
                    Restore Snapshot
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-base">System Audit Trail</h3>
            <p className="text-xs text-slate-600 font-medium">
              Immutable operational and security log tracking administrative changes, logins, and settings updates
            </p>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{log.entityType}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-800">{log.action}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
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
