import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [simulationLink, setSimulationLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      if (res.data.simulationResetLink) {
        setSimulationLink(res.data.simulationResetLink);
      }
    } catch (err) {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
          <Link to="/login" className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 mb-6">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </Link>

          <h2 className="text-xl font-bold text-white mb-1">Reset Password</h2>
          <p className="text-xs text-slate-400 mb-6">
            Enter your admin email and we will send a password reset link.
          </p>

          {submitted ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-3">
              <div className="flex items-center space-x-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Reset link dispatched!</span>
              </div>
              <p className="text-slate-300">
                If an account matches that email, check your inbox for instructions to reset your password.
              </p>
              {simulationLink && (
                <div className="mt-3 p-2.5 bg-slate-950 rounded-lg border border-emerald-500/30">
                  <p className="text-[11px] font-semibold text-emerald-400 mb-1">Simulation Mode Test Link:</p>
                  <a
                    href={simulationLink}
                    className="text-[11px] text-teal-300 underline break-all hover:text-teal-200"
                  >
                    {simulationLink}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    placeholder="admin@apexlibrary.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

