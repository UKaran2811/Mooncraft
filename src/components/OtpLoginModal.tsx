/**
 * src/components/OtpLoginModal.tsx
 *
 * Modal for mobile-OTP login. Two steps:
 *   1. Enter phone number → POST /api/auth/send-otp
 *   2. Enter 6-digit code → POST /api/auth/verify-otp
 *
 * Calls onAuthenticated(user) on success so the parent can close
 * the modal and resume the action that triggered login.
 */

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ClipboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, KeyRound, X, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { authAPI, ApiError } from '../services/api';
import { useAuthStore } from '../useAuthStore';

interface OtpLoginModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: { id: string; phone: string }) => void;
  initialPhone?: string;
}

type Step = 'phone' | 'code';

export default function OtpLoginModal({ open, onClose, onAuthenticated, initialPhone = '' }: OtpLoginModalProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const signInWithOtp = useAuthStore((s) => s.signInWithOtp);
  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setStep('phone');
      setPhone(initialPhone);
      setCode(['', '', '', '', '', '']);
      setError('');
      setCooldown(0);
      setDevCode(null);
    }
  }, [open, initialPhone]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestOtp = async (phoneToUse?: string) => {
    const target = (phoneToUse ?? phone).trim();
    if (!/^[0-9]{10,15}$/.test(target.replace(/^\+/, ''))) {
      setError('Please enter a valid phone number (10-15 digits)');
      return;
    }
    setSending(true);
    setError('');
    setDevCode(null);
    try {
      const res = await authAPI.sendOtp(target);
      setPhone(target);
      setStep('code');
      if (res?.devCode) setDevCode(res.devCode);
      if (res?.cooldownSeconds) setCooldown(res.cooldownSeconds);
      // Focus the first OTP input
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err) {
      if (err instanceof ApiError && err.data.cooldownSeconds) {
        setCooldown(Number(err.data.cooldownSeconds));
        setError(err.data.message as string || 'Please wait before requesting a new code');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send OTP');
      }
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (codeStr: string) => {
    if (codeStr.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const user = await signInWithOtp(phone, codeStr);
      onAuthenticated({ id: user.id, phone: user.phone });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  };

  const handleCodeChange = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    if (!digit && !value) {
      // Allow clearing
      const next = [...code];
      next[idx] = '';
      setCode(next);
      return;
    }
    if (!digit) return;
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (idx < 5) codeRefs.current[idx + 1]?.focus();
    if (next.every((d) => d) && next.join('').length === 6) {
      verifyOtp(next.join(''));
    }
  };

  const handleCodeKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted.split(''));
      verifyOtp(pasted);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-neutral-900 to-black p-6 text-white">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-white/10 border border-white/15 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-white/80" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold">Secure Login</span>
              </div>
              <h2 className="text-lg font-light tracking-wide">
                {step === 'phone' ? 'Sign in to checkout' : 'Enter verification code'}
              </h2>
              <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">
                {step === 'phone'
                  ? "We'll send a 6-digit code to your mobile number. No password required."
                  : `Sent to ${phone}. The code expires in 5 minutes.`}
              </p>
            </div>

            {/* Body */}
            <div className="p-6">
              {step === 'phone' ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); requestOtp(); }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                      Mobile Number
                    </label>
                    <div className="relative flex items-center border border-neutral-200 rounded-lg focus-within:border-black transition-colors">
                      <span className="pl-3 pr-1 text-neutral-400 text-sm font-mono">+91</span>
                      <input
                        id="otp-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 15)); setError(''); }}
                        placeholder="98765 43210"
                        className="flex-1 py-2.5 pr-3 text-sm text-black placeholder-neutral-300 focus:outline-none bg-transparent"
                      />
                      <Phone className="w-4 h-4 text-neutral-300 mr-3" />
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <button
                    id="otp-send-btn"
                    type="submit"
                    disabled={sending || phone.replace(/\D/g, '').length < 10}
                    className="w-full bg-black text-white py-3 rounded-lg text-xs font-bold tracking-widest uppercase hover:bg-neutral-800 disabled:bg-neutral-300 transition-colors flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending code…</>
                    ) : (
                      <>Send Code <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>

                  <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
                    By continuing, you agree to Mooncraft's terms of service and privacy policy.
                  </p>
                </form>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Dev hint */}
                  {devCode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-800 font-mono text-center">
                      [Dev] Your OTP: <strong>{devCode}</strong>
                    </div>
                  )}

                  {/* 6-digit input */}
                  <div className="flex items-center justify-center gap-2" onPaste={handleCodePaste}>
                    {code.map((digit, i) => (
                      <input
                        key={i}
                        id={`otp-code-${i}`}
                        ref={(el) => { codeRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        disabled={verifying}
                        className="w-10 h-12 text-center text-lg font-bold border-2 border-neutral-200 rounded-lg focus:border-black focus:outline-none transition-colors disabled:opacity-50"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>

                  {error && <p className="text-xs text-red-600 text-center">{error}</p>}

                  {verifying && (
                    <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      onClick={() => { setStep('phone'); setError(''); setCode(['', '', '', '', '', '']); }}
                      className="text-neutral-500 hover:text-black transition-colors"
                    >
                      ← Change number
                    </button>
                    <button
                      onClick={() => requestOtp()}
                      disabled={cooldown > 0 || sending}
                      className="text-neutral-500 hover:text-black transition-colors disabled:text-neutral-300 disabled:cursor-not-allowed"
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer note */}
            <div className="bg-neutral-50 border-t border-neutral-100 px-6 py-3 flex items-center gap-2 text-[10px] text-neutral-400">
              <KeyRound className="w-3 h-3" />
              <span>Mobile OTP · No password · Secure</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
