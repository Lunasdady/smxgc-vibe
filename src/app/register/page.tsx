'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Eye, EyeOff, CheckCircle, Mail, Building2, User, Phone, Lock, Shield, Briefcase } from 'lucide-react';
import { useAccessLog } from '@/hooks/useAccessLog';

type Step = 1 | 2 | 3 | 4;

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  useAccessLog('/register');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: 人机验证
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');

  // Step 2: 邮箱验证
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Step 3: 机构认证
  const [organization, setOrganization] = useState('');
  const [realName, setRealName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [referrer, setReferrer] = useState('');

  // Step 4: 密码设置
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 生成4位验证码
  const generateCaptcha = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setCaptchaCode(code);
    setCaptchaInput('');
  }, []);

  useEffect(() => {
    generateCaptcha();
  }, [generateCaptcha]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateStep1 = () => {
    if (captchaInput.toUpperCase() !== captchaCode) {
      setError('验证码错误，请重新输入');
      generateCaptcha();
      return false;
    }
    return true;
  };

  const sendEmailCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error === 'Email already registered' ? '该邮箱已注册' : '发送失败，请稍后重试');
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

  const validateStep2 = async () => {
    if (!email || !emailCode) {
      setError('请填写邮箱和验证码');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: emailCode, type: 'register' }),
      });

      if (!response.ok) {
        setError('验证码错误或已过期');
        return false;
      }

      return true;
    } catch {
      setError('验证失败，请稍后重试');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const validateStep3 = () => {
    if (!organization.trim()) {
      setError('请填写所在机构');
      return false;
    }
    if (!department.trim()) {
      setError('请填写所在部门');
      return false;
    }
    if (!position.trim()) {
      setError('请填写所在岗位');
      return false;
    }
    if (!realName.trim()) {
      setError('请填写真实姓名');
      return false;
    }
    if (!phone.trim()) {
      setError('请填写电话号码');
      return false;
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      setError('请输入有效的手机号码');
      return false;
    }
    if (!referrer.trim()) {
      setError('请填写推荐人');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (password.length < 8 || password.length > 20) {
      setError('密码长度需为8-20位');
      return false;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      setError('密码必须同时包含字母和数字');
      return false;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    setError('');

    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      const valid = await validateStep2();
      if (valid) setStep(3);
    } else if (step === 3) {
      if (validateStep3()) setStep(4);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep4()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          realName,
          organization,
          department,
          position,
          referrer,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error === 'Email already registered' ? '该邮箱已注册' : '注册失败，请稍后重试');
        return;
      }

      // 注册成功，跳转到登录页
      router.push(`/login?registered=true&redirect=${encodeURIComponent(redirect)}`);
    } catch {
      setError('注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: '人机验证', icon: Shield },
    { num: 2, label: '邮箱验证', icon: Mail },
    { num: 3, label: '机构认证', icon: Building2 },
    { num: 4, label: '密码设置', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[14px] text-[#86868B] hover:text-[#0071E3] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-apple">
          <h1 className="text-[24px] font-semibold text-[#1D1D1F] mb-2 tracking-tight">用户注册</h1>
          <p className="text-[14px] text-[#86868B] mb-8">完成四步注册，获取策略数据访问权限</p>

          {/* Progress */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium transition-colors ${
                    step >= s.num
                      ? 'bg-[#0071E3] text-white'
                      : 'bg-[#F5F5F7] text-[#86868B]'
                  }`}
                >
                  {step > s.num ? <CheckCircle className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-8 h-[2px] mx-1 transition-colors ${
                      step > s.num ? 'bg-[#0071E3]' : 'bg-[#F5F5F7]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {error}
            </div>
          )}

          {/* Step 1: 人机验证 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-3">请输入下方验证码</label>
                <div className="flex items-center gap-4">
                  <div className="px-6 py-3 bg-[#1D1D1F] rounded-xl">
                    <span className="text-[24px] font-bold text-white tracking-[8px] select-none">
                      {captchaCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-2 rounded-xl bg-[#F5F5F7] hover:bg-[#0000000A] transition-colors"
                    title="刷新验证码"
                  >
                    <RefreshCw className="w-4 h-4 text-[#86868B]" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="请输入4位验证码"
                maxLength={4}
                className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all uppercase"
              />
            </div>
          )}

          {/* Step 2: 邮箱验证 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">邮箱地址</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入邮箱地址"
                    className="flex-1 px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={sendEmailCode}
                    disabled={loading || countdown > 0}
                    className="px-4 py-3 bg-[#0071E3] text-white rounded-xl text-[13px] font-medium hover:bg-[#0077ED] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '发送验证码'}
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="请输入6位邮箱验证码"
                maxLength={6}
                className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
              />

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[12px] text-blue-700 leading-relaxed">
                  <strong>机构权限说明：</strong>注册后需管理员审核并分配机构权限。使用企业邮箱（如 name@company.com）可加快审核流程。
                </p>
              </div>
            </div>
          )}

          {/* Step 3: 机构认证 */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <Building2 className="w-3.5 h-3.5 inline mr-1" />
                  所在机构
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="请填写完整机构名称"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                  所在部门
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="请填写所在部门"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                  所在岗位
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="请填写所在岗位"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  真实姓名
                </label>
                <input
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder="请填写真实姓名"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />
                  电话号码
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号码"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  推荐人
                </label>
                <input
                  type="text"
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  placeholder="如无推荐人，请填写&ldquo;无&rdquo;"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[12px] text-amber-700 leading-relaxed">
                  <strong>填写说明：</strong>请填写完整机构名称及电话号码，供管理员审核分配。
                </p>
              </div>
            </div>
          )}

          {/* Step 4: 密码设置 */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
                  <Lock className="w-3.5 h-3.5 inline mr-1" />
                  设置密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">确认密码</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as Step)}
                className="flex-1 py-3 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl text-[15px] font-medium hover:bg-[#0000000A] transition-all"
              >
                上一步
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 py-3 bg-[#0071E3] text-white rounded-xl text-[15px] font-medium hover:bg-[#0077ED] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '验证中...' : '下一步'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-[#0071E3] text-white rounded-xl text-[15px] font-medium hover:bg-[#0077ED] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '注册中...' : '完成注册'}
              </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <span className="text-[14px] text-[#86868B]">已有账号？</span>
            <Link
              href={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
              className="text-[14px] text-[#0071E3] hover:underline ml-1"
            >
              立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
