'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const errorParam = searchParams.get('error');

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (errorParam === 'no-permission') {
      setError('您的账户暂未开通策略访问权限，需等待管理员审核。审核通过后，系统将通过您的注册邮箱发送通知。');
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error === 'User not found' ? '用户不存在' : '密码错误');
        return;
      }

      // 设置 cookie
      document.cookie = `user-token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}`;

      // 跳转
      router.push(redirect);
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
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
          <h1 className="text-[24px] font-semibold text-[#1D1D1F] mb-2 tracking-tight">用户登录</h1>
          <p className="text-[14px] text-[#86868B] mb-8">登录后查看完整策略数据</p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">邮箱或手机号</label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="请输入邮箱或手机号"
                className="w-full px-4 py-3 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3 pr-11 bg-[#F5F5F7] border border-transparent rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:bg-white transition-all"
                  required
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

            <div className="flex items-center justify-between">
              <Link
                href="/forgot-password"
                className="text-[13px] text-[#0071E3] hover:underline"
              >
                忘记密码？
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0071E3] text-white rounded-xl text-[15px] font-medium hover:bg-[#0077ED] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-[14px] text-[#86868B]">还没有账号？</span>
            <Link
              href={`/register${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
              className="text-[14px] text-[#0071E3] hover:underline ml-1"
            >
              立即注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
