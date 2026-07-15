'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Eye,
  UserCheck,
  Clock,
  CheckCircle,
  TrendingUp,
  FileDown,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { STRATEGY_NAME_MAP } from '@/lib/types';
import AdminTabs from '../_components/AdminTabs';

interface OverviewData {
  totalUsers: number;
  todayNewUsers: number;
  todayPV: number;
  todayUV: number;
  todayLoginUV: number;
  pendingUsers: number;
  approvedUsers: number;
}

interface TrendItem {
  date: string;
  count?: number;
  pv?: number;
  uv?: number;
  loginUV?: number;
}

interface PageRankItem {
  page: string;
  pv: number;
  uv: number;
}

interface UserRankItem {
  userId: number;
  realName: string;
  email: string;
  organization: string;
  visitCount: number;
  lastVisit: string;
}

type TimeRange = 7 | 30 | 90;

const timeRangeOptions: { label: string; value: TimeRange }[] = [
  { label: '近7天', value: 7 },
  { label: '近30天', value: 30 },
  { label: '近90天', value: 90 },
];

// 构建策略页面名称映射 /strategy/[type] -> 中文名称
const strategyPageNameMap: Record<string, string> = {};
for (const [key, value] of Object.entries(STRATEGY_NAME_MAP)) {
  strategyPageNameMap[`/strategy/${key}`] = value;
}

const pageNameMap: Record<string, string> = {
  '/': '首页',
  '/login': '登录页',
  '/register': '注册页',
  '/forgot-password': '找回密码',
  '/admin': '管理后台-数据',
  '/admin/operation': '管理后台-运营',
  '/admin/permissions': '管理后台-权限',
  ...strategyPageNameMap,
};

export default function OperationPage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>(30);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [userTrend, setUserTrend] = useState<TrendItem[]>([]);
  const [visitTrend, setVisitTrend] = useState<TrendItem[]>([]);
  const [pageRank, setPageRank] = useState<PageRankItem[]>([]);
  const [userRank, setUserRank] = useState<UserRankItem[]>([]);

  // 检查管理员认证
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        router.push('/admin');
        return;
      }
      try {
        const response = await fetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('adminToken');
          router.push('/admin');
        }
      } catch {
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // 获取概览数据
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('adminToken');
    fetch('/api/admin/operation/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setOverview)
      .catch(console.error);
  }, [isAuthenticated]);

  // 获取趋势和排行数据
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('adminToken');

    Promise.all([
      fetch(`/api/admin/operation/user-trend?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/admin/operation/visit-trend?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/admin/operation/page-rank?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/admin/operation/user-rank?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([ut, vt, pr, ur]) => {
        setUserTrend(ut.data || []);
        setVisitTrend(vt.data || []);
        setPageRank(pr.data || []);
        setUserRank(ur.data || []);
      })
      .catch(console.error);
  }, [isAuthenticated, timeRange]);

  // 导出用户访问排行为 Excel (CSV)
  const exportUserRankCSV = () => {
    if (userRank.length === 0) return;
    const headers = ['排名', '姓名', '邮箱', '机构', '访问次数', '最近访问'];
    const rows = userRank.map((u, i) => [
      i + 1,
      u.realName,
      u.email,
      u.organization,
      u.visitCount,
      u.lastVisit,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `用户访问排行_${timeRange}天_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导出 HTML 报告
  const exportHTMLReport = () => {
    if (!reportRef.current) return;
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>私募星工厂运营数据报告</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f7;padding:40px;color:#1d1d1f}
.container{max-width:1200px;margin:0 auto;background:#fff;border-radius:20px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h1{font-size:24px;font-weight:600;margin-bottom:8px}
.subtitle{color:#86868b;font-size:14px;margin-bottom:32px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
.card{background:#f5f5f7;border-radius:16px;padding:20px}
.card-label{font-size:13px;color:#86868b;margin-bottom:4px}
.card-value{font-size:28px;font-weight:600;color:#1d1d1f}
.card-sub{font-size:12px;color:#86868b;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
th{background:#f5f5f7;padding:12px 16px;text-align:left;font-weight:500;color:#86868b}
td{padding:12px 16px;border-bottom:1px solid #eee}
tr:hover{background:#fafafa}
.section{margin-bottom:40px}
.section-title{font-size:17px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:500}
.badge-blue{background:#0071e3;color:#fff}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;color:#86868b;font-size:12px;text-align:center}
</style>
</head>
<body>
<div class="container">
<h1>私募星工厂 · 运营数据报告</h1>
<p class="subtitle">生成时间：${new Date().toLocaleString('zh-CN')}&nbsp;&nbsp;|&nbsp;&nbsp;统计周期：近${timeRange}天</p>
<div class="grid">
  <div class="card"><div class="card-label">总注册用户</div><div class="card-value">${overview?.totalUsers ?? 0}</div></div>
  <div class="card"><div class="card-label">今日新增注册</div><div class="card-value">${overview?.todayNewUsers ?? 0}</div></div>
  <div class="card"><div class="card-label">今日页面访问(PV)</div><div class="card-value">${overview?.todayPV ?? 0}</div></div>
  <div class="card"><div class="card-label">今日独立访客(UV)</div><div class="card-value">${overview?.todayUV ?? 0}</div></div>
  <div class="card"><div class="card-label">今日登录访客</div><div class="card-value">${overview?.todayLoginUV ?? 0}</div></div>
  <div class="card"><div class="card-label">待审核用户</div><div class="card-value">${overview?.pendingUsers ?? 0}</div></div>
</div>
<div class="section">
  <div class="section-title">页面访问排行 Top 10</div>
  <table>
    <thead><tr><th>排名</th><th>页面</th><th>访问次数(PV)</th><th>独立访客(UV)</th></tr></thead>
    <tbody>
      ${pageRank.map((p, i) => `<tr><td>${i + 1}</td><td>${pageNameMap[p.page] || p.page}</td><td>${p.pv}</td><td>${p.uv}</td></tr>`).join('')}
    </tbody>
  </table>
</div>
<div class="section">
  <div class="section-title">用户访问排行 Top 10</div>
  <table>
    <thead><tr><th>排名</th><th>姓名</th><th>邮箱</th><th>机构</th><th>访问次数</th><th>最近访问</th></tr></thead>
    <tbody>
      ${userRank.map((u, i) => `<tr><td>${i + 1}</td><td>${u.realName}</td><td>${u.email}</td><td>${u.organization}</td><td>${u.visitCount}</td><td>${u.lastVisit}</td></tr>`).join('')}
    </tbody>
  </table>
</div>
<div class="footer">本报告由私募星工厂管理后台自动生成</div>
</div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `运营数据报告_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-[15px] text-[#86868B]">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="bg-white border-b border-[#0000000D]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[14px] font-medium text-[#1D1D1F]">运营管理</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportHTMLReport}
              className="flex items-center gap-2 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl transition-colors text-[14px] font-medium"
            >
              <FileDown className="w-4 h-4" />
              导出报告
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8" ref={reportRef}>
        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <AdminTabs />
        </div>

        {/* 时间范围选择 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[17px] font-semibold text-[#1D1D1F]">数据概览</h2>
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-apple">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  timeRange === opt.value
                    ? 'bg-[#0071E3] text-white'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <OverviewCard
            icon={<Users className="w-5 h-5 text-[#0071E3]" />}
            label="总注册用户"
            value={overview?.totalUsers ?? 0}
          />
          <OverviewCard
            icon={<UserPlus className="w-5 h-5 text-[#34C759]" />}
            label="今日新增"
            value={overview?.todayNewUsers ?? 0}
          />
          <OverviewCard
            icon={<Eye className="w-5 h-5 text-[#5856D6]" />}
            label="今日PV"
            value={overview?.todayPV ?? 0}
          />
          <OverviewCard
            icon={<UserCheck className="w-5 h-5 text-[#FF9500]" />}
            label="今日UV"
            value={overview?.todayUV ?? 0}
          />
          <OverviewCard
            icon={<CheckCircle className="w-5 h-5 text-[#34C759]" />}
            label="已授权用户"
            value={overview?.approvedUsers ?? 0}
          />
          <OverviewCard
            icon={<Clock className="w-5 h-5 text-[#FF3B30]" />}
            label="待审核用户"
            value={overview?.pendingUsers ?? 0}
          />
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 用户注册趋势 */}
          <div className="bg-white rounded-2xl p-6 shadow-apple">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#0071E3]" />
              <h3 className="text-[15px] font-semibold text-[#1D1D1F]">用户注册趋势</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userTrend}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0071E3" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#86868B' }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#86868B' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 24px rgba(0,0,0,.12)',
                      fontSize: 13,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0071E3"
                    strokeWidth={2}
                    fill="url(#userGrad)"
                    name="新增注册"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 页面访问趋势 */}
          <div className="bg-white rounded-2xl p-6 shadow-apple">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-[#5856D6]" />
              <h3 className="text-[15px] font-semibold text-[#1D1D1F]">页面访问趋势</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visitTrend}>
                  <defs>
                    <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5856D6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5856D6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="uvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34C759" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34C759" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#86868B' }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#86868B' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 24px rgba(0,0,0,.12)',
                      fontSize: 13,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pv"
                    stroke="#5856D6"
                    strokeWidth={2}
                    fill="url(#pvGrad)"
                    name="PV"
                  />
                  <Area
                    type="monotone"
                    dataKey="uv"
                    stroke="#34C759"
                    strokeWidth={2}
                    fill="url(#uvGrad)"
                    name="UV"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 排行区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 页面访问排行 */}
          <div className="bg-white rounded-2xl p-6 shadow-apple">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#FF9500]" />
              <h3 className="text-[15px] font-semibold text-[#1D1D1F]">页面访问排行 Top 10</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pageRank} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#86868B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="page"
                    type="category"
                    tick={{ fontSize: 12, fill: '#1D1D1F' }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                    tickFormatter={(v: string) => pageNameMap[v] || v}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 24px rgba(0,0,0,.12)',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="pv" fill="#0071E3" radius={[0, 6, 6, 0]} name="PV" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 用户访问排行 */}
          <div className="bg-white rounded-2xl p-6 shadow-apple">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#34C759]" />
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">用户访问排行 Top 10</h3>
              </div>
              <button
                onClick={exportUserRankCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#0071E3] bg-[#0071E3]/10 rounded-lg hover:bg-[#0071E3]/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                导出Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[#86868B] text-[13px]">
                    <th className="pb-3 font-medium">排名</th>
                    <th className="pb-3 font-medium">用户</th>
                    <th className="pb-3 font-medium">机构</th>
                    <th className="pb-3 font-medium text-right">访问次数</th>
                    <th className="pb-3 font-medium text-right">最近访问</th>
                  </tr>
                </thead>
                <tbody>
                  {userRank.map((user, index) => (
                    <tr key={user.userId} className="border-t border-[#0000000D]">
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[12px] font-semibold ${
                            index < 3
                              ? 'bg-[#0071E3] text-white'
                              : 'bg-[#F5F5F7] text-[#86868B]'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-[#1D1D1F]">{user.realName}</div>
                        <div className="text-[12px] text-[#86868B]">{user.email}</div>
                      </td>
                      <td className="py-3 text-[#86868B]">{user.organization}</td>
                      <td className="py-3 text-right font-medium text-[#1D1D1F]">
                        {user.visitCount}
                      </td>
                      <td className="py-3 text-right text-[#86868B] text-[13px]">
                        {user.lastVisit}
                      </td>
                    </tr>
                  ))}
                  {userRank.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#86868B]">
                        暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function OverviewCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-apple">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[13px] text-[#86868B]">{label}</span>
      </div>
      <div className="text-[28px] font-semibold text-[#1D1D1F]">{value}</div>
    </div>
  );
}
