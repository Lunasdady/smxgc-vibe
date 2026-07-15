'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAccessLog } from '@/hooks/useAccessLog';

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  useAccessLog('/forgot-password');
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error === 'Email not found' ? '该邮箱未注册' : '发送失败，请稍后重试');
        return;
      }

      setCodeSent(true);
      setCountdown(60);
    } catch {
      setError('发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');

    if (!code) {
      setError('请输入验证码');
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 20) {
      setError('密码长度需为8-20位');
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setError('密码必须同时包含字母和数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error === 'Invalid or expired code' ? '验证码错误或已过期' : '重置失败，请稍后重试');
        return;
      }

      setStep(3);
    } catch {
      setError('重置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[14px] text-[#86868B] hover:text-[#0071E3] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </Link>

        <div className="bg-white rounded-3xl p-8 shadow-apple">
          <h1 className="text-[24px] font-semibold text-[#1D1D1F] mb-2 tracking-tight">找回密码</h1>
          <p className="text-[14px] text-[#86868B] mb-8">
            {step === 1 && '通过邮箱验证码重置密码'}
            {step === 2 && '设置新密码'}
            {step === 3 && '密码重置成功'}
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">注册邮箱</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入注册邮箱"
                    className="flex-1 px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={loading || countdown > 0}
                    className="px-4 py-3 bg-[#0071E3] text-white rounded-xl text-[13px] font-medium hover:bg-[#0077ED] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '发送验证码'}
                  </button>
                </div>
              </div>

              {codeSent && (
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入6位验证码"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              )}

              {codeSent && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!code}
                  className="w-full py-3 bg-[#0071E3] text-white rounded-xl text-[15px] font-medium hover:bg-[#0077ED] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一步
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">新密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8-20位，字母和数字组合"
                    className="w-full px-4 py-3 pr-11 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">确认新密码</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="w-full py-3 bg-[#0071E3] text-white rounded-xl text-[15px] font-medium hover:bg-[#0077ED] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '重置中...' : '重置密码'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-[18px] font-semibold text-[#1D1D1F] mb-2">密码重置成功</h2>
              <p className="text-[14px] text-[#86868B] mb-6">请使用新密码登录</p>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full py-3 bg-[#0071E3] text-white rounded-xl text-[15px] font-medium hover:bg-[#0077ED] transition-all"
              >
                去登录
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
