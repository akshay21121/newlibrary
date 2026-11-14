import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';

// Pages
import { LoginPage } from './pages/LoginPage.js';
import { SetupPage } from './pages/SetupPage.js';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/ResetPasswordPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { FloorPlanPage } from './pages/FloorPlanPage.js';
import { StudentsPage } from './pages/StudentsPage.js';
import { StudentDetailPage } from './pages/StudentDetailPage.js';
import { FeesPage } from './pages/FeesPage.js';
import { RemindersPage } from './pages/RemindersPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, isConfigured } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConfigured) {
    return <Navigate to="/setup" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Admin Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="floors" element={<FloorPlanPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:id" element={<StudentDetailPage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="reminders" element={<RemindersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

