import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Mail, Phone, ArrowLeft, MessageCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useRouter } from '../useRouter';

export default function ResetPassword({ token }: { token?: string }) {
  if (token) return <EmailResetForm token={token} />;
  return <ForgotPasswordPage />;
}

// ── Forgot Password Page: choose Email or Phone OTP ──
function ForgotPasswordPage() {
  const { navigateTo } = useRouter();
  const [method, setMethod] = useState<'email' | 'phone'>('email');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <button onClick={() => navigateTo({ type: 'home' })} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black mb-8 transition-colors cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to store
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-full mb-5">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Reset password</h1>
          <p className="text-sm text-neutral-500 mt-1">Choose how to verify your identity.</p>
        </div>

        {/* Method toggle */}
        <div className="flex bg-neutral-100 rounded-xl p-1 mb-6">
          <button onClick={() => setMethod('email')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${method === 'email' ? 'bg-white text-zinc-900 shadow-sm' : 'text-neutral-500 hover:text-zinc-900'}`}>
            <Mail className="w-3.5 h-3.5 inline mr-1.5" /> Email
          </button>
          <button onClick={() => setMethod('phone')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${method === 'phone' ? 'bg-white text-zinc-900 shadow-sm' : 'text-neutral-500 hover:text-zinc-900'}`}>
            <Phone className="w-3.5 h-3.5 inline mr-1.5" /> Phone OTP
          </button>
        </div>

        {method === 'email' ? <ForgotEmailForm /> : <ForgotPhoneForm />}
      </motion.div>
    </div>
  );
}

// ── Email Forgot Password ──
function ForgotEmailForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-4">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm text-neutral-600">If an account with <strong>{email}</strong> exists, we've sent a reset link.</p>
        <p className="text-xs text-neutral-400 mt-2">Check your inbox (and spam folder).</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-red-600 text-xs">{error}</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-neutral-500 text-[10px] uppercase tracking-widest font-medium">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm text-zinc-900 placeholder-neutral-400 focus:outline-none focus:border-black transition-colors" placeholder="you@example.com" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-black text-white py-3 rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors cursor-pointer flex items-center justify-center gap-2">
        {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Sending...</> : <><Mail className="w-4 h-4" /> Send Reset Link</>}
      </button>
    </form>
  );
}

// ── Phone OTP Forgot Password ──
function ForgotPhoneForm() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'phone' | 'code-password' | 'done'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPasswordOtp(phone);
      if (res.devCode) setDevCode(res.devCode);
      setStep('code-password');
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleCodeChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handleReset = async () => {
    setError('');
    const fullCode = code.join('');
    if (fullCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await authAPI.resetPasswordWithOtp(phone, fullCode, password);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-4">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-zinc-900">Password updated</p>
        <p className="text-xs text-neutral-500 mt-1">You can now log in with your new password.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-red-600 text-xs">{error}</span>
        </div>
      )}

      {step === 'phone' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-500 text-[10px] uppercase tracking-widest font-medium">Phone Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 border-neutral-200 rounded-l-lg bg-neutral-50 text-neutral-500 text-sm">+91</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full border border-neutral-200 rounded-r-lg px-4 py-3 text-sm text-zinc-900 placeholder-neutral-400 focus:outline-none focus:border-black transition-colors" placeholder="9876543210" />
            </div>
          </div>
          <button onClick={sendOtp} disabled={loading || phone.length < 10}
            className="w-full bg-black text-white py-3 rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors cursor-pointer flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Sending...</> : <><MessageCircle className="w-4 h-4" /> Send OTP</>}
          </button>
        </>
      )}

      {step === 'code-password' && (
        <>
          <p className="text-sm text-neutral-600 text-center">
            Enter the 6-digit code sent to <strong>+91 {phone}</strong>
          </p>
          {devCode && (
            <p className="text-xs text-amber-600 text-center bg-amber-50 rounded-lg py-1">Dev code: {devCode}</p>
          )}
          <div className="flex justify-center gap-2">
            {code.map((d, i) => (
              <input key={i} ref={(el) => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={(e) => handleCodeChange(i, e.target.value)} onKeyDown={(e) => handleCodeKeyDown(i, e)}
                className="w-10 h-12 text-center text-lg font-semibold border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-zinc-900" />
            ))}
          </div>

          <div className="border-t border-neutral-100 pt-4 mt-2">
            <p className="text-xs text-neutral-400 mb-3 text-center">Set a new password</p>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  className="w-full border border-neutral-200 rounded-lg px-4 py-3 pr-10 text-sm text-zinc-900 placeholder-neutral-400 focus:outline-none focus:border-black transition-colors" placeholder="New password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm text-zinc-900 placeholder-neutral-400 focus:outline-none focus:border-black transition-colors" placeholder="Confirm password" />
            </div>
          </div>

          <button onClick={handleReset} disabled={loading || code.join('').length < 6 || password.length < 8}
            className="w-full bg-black text-white py-3 rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors cursor-pointer flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Resetting...</> : 'Reset Password'}
          </button>

          <div className="text-center">
            <button onClick={sendOtp} disabled={loading || cooldown > 0} className="text-xs text-neutral-500 hover:text-black underline underline-offset-4 disabled:no-underline disabled:text-neutral-300 cursor-pointer transition-colors">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Email token reset form (existing) ──
function EmailResetForm({ token }: { token: string }) {
  const { navigateTo } = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-5">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Password updated</h1>
          <p className="text-sm text-neutral-500 mb-6">You can now log in with your new password.</p>
          <button onClick={() => navigateTo({ type: 'home' })} className="text-sm text-neutral-600 hover:text-black underline underline-offset-4 cursor-pointer">Return to store</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <button onClick={() => navigateTo({ type: 'home' })} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black mb-8 transition-colors cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to store
        </button>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-full mb-5">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Set new password</h1>
          <p className="text-sm text-neutral-500 mt-1">Must be at least 8 characters.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-600 text-xs">{error}</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-500 text-[10px] uppercase tracking-widest font-medium">New Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full border border-neutral-200 rounded-lg px-4 py-3 pr-10 text-sm text-zinc-900 placeholder-neutral-400 focus:outline-none focus:border-black transition-colors" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-500 text-[10px] uppercase tracking-widest font-medium">Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
              className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm text-zinc-900 placeholder-neutral-400 focus:outline-none focus:border-black transition-colors" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors cursor-pointer flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Resetting...</> : 'Reset Password'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
