'use client';

import React, { useState } from 'react';
import { AuthUser } from '@/types';
import { saveStoredUser } from '@/lib/auth';
import { loginOnServer } from '@/lib/apiClient';
import { 
  Snowflake, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle 
} from '@/components/icons';

interface LoginFormProps {
  onLogin: (user: AuthUser) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Silakan masukkan username');
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Silakan masukkan PIN 6 digit');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setErrorMsg('PIN harus tepat 6 angka');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Coba login ke server SQLite
      const serverRes = await loginOnServer(username, pin);
      if (serverRes.success && serverRes.user) {
        saveStoredUser(serverRes.user);
        setIsLoading(false);
        onLogin(serverRes.user);
        return;
      }

      setIsLoading(false);
      setErrorMsg(serverRes.message || 'Username atau PIN tidak sesuai');
    } catch {
      setIsLoading(false);
      setErrorMsg('Terjadi kesalahan saat masuk');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4 py-8">
      <div
        className="bg-card border-border w-full max-w-sm rounded-3xl border p-6 sm:p-7 shadow-pop "
      >
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-pop mb-3">
            <Snowflake className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Plan<span className="text-link">Craft</span>
            </h1>
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-link border border-primary/30">
              Frozen Meat
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Masuk untuk mengakses sistem pelacakan produksi
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/30 text-link text-xs flex items-center space-x-2 animate-in fade-in zoom-in-95">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle-foreground">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: admin atau produksi"
                autoCapitalize="none"
                autoCorrect="off"
                className="bg-background border-input w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm text-foreground placeholder-subtle-foreground focus-visible:border-ring transition"
              />
            </div>
          </div>

          {/* PIN / Password Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              PIN 6 digit
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-subtle-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="current-password"
                placeholder="Masukkan 6 angka"
                className="bg-background border-input w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm text-foreground placeholder-subtle-foreground focus-visible:border-ring transition"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-subtle-foreground hover:text-foreground "
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-sm shadow-pop transition active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-border border-t-border rounded-full animate-spin" />
            ) : (
              <>
                <span>Masuk ke PlanCraft</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
