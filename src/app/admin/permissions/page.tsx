'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, CheckSquare, Square, ArrowLeft, Users, UserCheck, Shield, ShieldOff, Ban, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import AdminTabs from '../_components/AdminTabs';

type Tab = 'registered' | 'pending';

interface UserItem {
  id: number;
  email: string;
  phone: string | null;
  realName: string;
  organization: string;
  department: string | null;
  position: string | null;
  permissions: string[];
  status: string;
  createdAt: string;
}

export default function PermissionsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState('');

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

  // 获取用户列表
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUsers = async () => {
      const token = localStorage.getItem('adminToken');
      const status = activeTab === 'pending' ? 'pending' : 'approved';
      const url = `/api/admin/users?status=${status}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setUsers(data.users || []);
        setSelectedIds([]);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    fetchUsers();
  }, [isAuthenticated, activeTab, searchTerm]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const handleApprove = async () => {
    if (selectedIds.length === 0) return;

    setApproving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds: selectedIds,
          permissions: ['strategy-detail'],
        }),
      });

      if (response.ok) {
        setMessage(`已成功授权 ${selectedIds.length} 位用户`);
        setSelectedIds([]);
        // 刷新列表
        const status = activeTab === 'pending' ? 'pending' : 'approved';
        const url = `/api/admin/users?status=${status}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
        const refreshResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await refreshResponse.json();
        setUsers(data.users || []);
      } else {
        setMessage('授权失败，请稍后重试');
      }
    } catch {
      setMessage('授权失败，请稍后重试');
    } finally {
      setApproving(false);
    }
  };

  const handleRevoke = async () => {
    if (selectedIds.length === 0) return;

    setApproving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds: selectedIds,
          action: 'revoke',
        }),
      });

      if (response.ok) {
        setMessage(`已取消 ${selectedIds.length} 位用户的权限`);
        setSelectedIds([]);
        // 刷新列表
        const status = activeTab === 'pending' ? 'pending' : 'approved';
        const url = `/api/admin/users?status=${status}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
        const refreshResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await refreshResponse.json();
        setUsers(data.users || []);
      } else {
        setMessage('取消权限失败，请稍后重试');
      }
    } catch {
      setMessage('取消权限失败，请稍后重试');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (selectedIds.length === 0) return;

    if (!confirm(`确定要拒绝授权 ${selectedIds.length} 位用户吗？拒绝后用户将无法登录，需要重新注册。`)) {
      return;
    }

    setApproving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds: selectedIds,
          action: 'reject',
        }),
      });

      if (response.ok) {
        setMessage(`已拒绝 ${selectedIds.length} 位用户的授权申请`);
        setSelectedIds([]);
        // 刷新列表
        const url = `/api/admin/users?status=pending${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
        const refreshResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await refreshResponse.json();
        setUsers(data.users || []);
      } else {
        setMessage('拒绝授权失败，请稍后重试');
      }
    } catch {
      setMessage('拒绝授权失败，请稍后重试');
    } finally {
      setApproving(false);
    }
  };

  const handleExportUsers = () => {
    if (users.length === 0) {
      setMessage('没有可导出的用户数据');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // 准备导出数据
    const exportData = users.map(user => ({
      '姓名': user.realName,
      '邮箱': user.email,
      '电话': user.phone || '-',
      '所在机构': user.organization,
      '所在部门': user.department || '-',
      '所在岗位': user.position || '-',
      '权限状态': user.permissions.includes('strategy-detail') ? '已授权' : '无权限',
      '注册日期': new Date(user.createdAt).toLocaleString('zh-CN'),
    }));

    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '用户列表');

    // 设置列宽
    worksheet['!cols'] = [
      { wch: 12 },  // 姓名
      { wch: 30 },  // 邮箱
      { wch: 15 },  // 电话
      { wch: 20 },  // 所在机构
      { wch: 15 },  // 所在部门
      { wch: 15 },  // 所在岗位
      { wch: 12 },  // 权限状态
      { wch: 20 },  // 注册日期
    ];

    // 导出文件
    const fileName = `用户列表_${activeTab === 'pending' ? '待审核' : '已注册'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setMessage(`成功导出 ${users.length} 条用户数据`);
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="bg-white border-b border-[#0000000D]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[14px] font-medium text-[#1D1D1F]">权限管理</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8">
        <div className="flex justify-center mb-6">
          <AdminTabs />
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-2xl p-1 shadow-apple inline-flex">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-[#0071E3] text-white'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            权限审核管理
            {activeTab === 'pending' && (
              <span className="px-1.5 py-0.5 bg-white/20 rounded-md text-[12px]">
                {users.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('registered')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
              activeTab === 'registered'
                ? 'bg-[#0071E3] text-white'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Users className="w-4 h-4" />
            已注册用户管理
            {activeTab === 'registered' && (
              <span className="px-1.5 py-0.5 bg-white/20 rounded-md text-[12px]">
                {users.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索机构、姓名、邮箱..."
              className="pl-9 pr-4 py-2.5 bg-white border border-[#0000000D] rounded-xl text-[14px] text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 transition-all w-72 shadow-apple"
            />
          </div>

          {activeTab === 'pending' && selectedIds.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] text-white rounded-xl text-[14px] font-medium hover:bg-[#B91C1C] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                {approving ? '拒绝中...' : `拒绝授权 (${selectedIds.length})`}
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0071E3] text-white rounded-xl text-[14px] font-medium hover:bg-[#0077ED] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                {approving ? '确认中...' : `确认授权 (${selectedIds.length})`}
              </button>
            </div>
          )}
          {activeTab === 'registered' && selectedIds.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportUsers}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-[14px] font-medium hover:bg-[#15803D] active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" />
                导出Excel ({users.length})
              </button>
              <button
                onClick={handleRevoke}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] text-white rounded-xl text-[14px] font-medium hover:bg-[#B91C1C] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <ShieldOff className="w-4 h-4" />
                {approving ? '取消中...' : `取消权限 (${selectedIds.length})`}
              </button>
            </div>
          )}
          {activeTab === 'registered' && selectedIds.length === 0 && users.length > 0 && (
            <button
              onClick={handleExportUsers}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-[14px] font-medium hover:bg-[#15803D] active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              导出Excel ({users.length})
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-3 rounded-xl text-[13px] ${
            message.includes('成功') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
          }`}>
            {message}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-apple overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#00000004]">
                <tr>
                  <th className="px-5 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="text-[#86868B] hover:text-[#0071E3] transition-colors"
                    >
                      {selectedIds.length === users.length && users.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">所在机构</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">所在部门</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">所在岗位</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">真实姓名</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">电话号码</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">注册邮箱</th>
                  <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">注册日期</th>
                  {activeTab === 'registered' && (
                    <th className="px-5 py-3 text-left text-[13px] font-medium text-[#86868B]">权限状态</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#00000008] hover:bg-[#0071E3]/[0.02] transition-all"
                  >
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleSelect(user.id)}
                        className="text-[#86868B] hover:text-[#0071E3] transition-colors"
                      >
                        {selectedIds.includes(user.id) ? (
                          <CheckSquare className="w-4 h-4 text-[#0071E3]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-[14px] text-[#1D1D1F]">{user.organization}</td>
                    <td className="px-5 py-3 text-[14px] text-[#86868B]">{user.department || '-'}</td>
                    <td className="px-5 py-3 text-[14px] text-[#86868B]">{user.position || '-'}</td>
                    <td className="px-5 py-3 text-[14px] text-[#1D1D1F]">{user.realName}</td>
                    <td className="px-5 py-3 text-[14px] text-[#86868B]">{user.phone || '-'}</td>
                    <td className="px-5 py-3 text-[14px] text-[#86868B]">{user.email}</td>
                    <td className="px-5 py-3 text-[14px] text-[#86868B]">{formatDate(user.createdAt)}</td>
                    {activeTab === 'registered' && (
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium ${
                          user.permissions.includes('strategy-detail')
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {user.permissions.includes('strategy-detail') ? '已授权' : '无权限'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-[#86868B] text-[14px]">
                      暂无{activeTab === 'pending' ? '待审核' : '已注册'}用户
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
