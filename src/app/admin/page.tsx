'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { extractDataDateFromFilename } from '@/lib/stats';
import { STRATEGY_NAME_MAP } from '@/lib/types';
import dayjs from 'dayjs';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        try {
          const response = await fetch('/api/admin/verify', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('adminToken');
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('adminToken');
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
      } else {
        setError('密码错误');
      }
    } catch (error) {
      setError('登录失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 w-96 shadow-apple">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <span className="text-white font-bold text-lg">管</span>
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[#1D1D1F]">管理后台登录</h1>
              <p className="text-[13px] text-[#86868B]">私募星工厂数据管理</p>
            </div>
          </div>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#86868B] mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[#1D1D1F] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50 transition-all placeholder-[#A1A1A6]"
                placeholder="输入管理密码"
              />
            </div>
            {error && <p className="text-[#DC2626] mb-4 text-[14px]">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl transition-colors font-medium text-[15px]"
            >
              登录
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}

// 管理后台仪表盘
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [importProgress, setImportProgress] = useState<{
    importId: string | null;
    progress: number;
    total: number;
    current: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    message: string;
    result: any;
  }>({ importId: null, progress: 0, total: 0, current: 0, status: 'pending', message: '', result: null });
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'all' | 'range'>('all');
  
  // Hero text editing
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [showHeroEditor, setShowHeroEditor] = useState(false);

  useEffect(() => {
    fetchStatus();
    loadHeroText();
  }, []);

  const loadHeroText = () => {
    const savedTitle = localStorage.getItem('heroTitle');
    const savedSubtitle = localStorage.getItem('heroSubtitle');
    if (savedTitle) setHeroTitle(savedTitle);
    if (savedSubtitle) setHeroSubtitle(savedSubtitle);
  };

  const saveHeroText = () => {
    localStorage.setItem('heroTitle', heroTitle);
    localStorage.setItem('heroSubtitle', heroSubtitle);
    setMessage('首页文案已更新，请刷新首页查看效果');
    setShowHeroEditor(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const fileName = selectedFile.name.toLowerCase();
      
      // 支持 .xlsx, .xls, .csv 格式
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        setFile(selectedFile);
        const extractedDate = extractDataDateFromFilename(selectedFile.name);
        setPreview({
          fileName: selectedFile.name,
          dataDate: extractedDate || '',
          manualDate: extractedDate || '',
          strategies: null,
        });
      } else {
        alert('请选择 .xlsx、.xls 或 .csv 文件');
      }
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataDate', preview.manualDate);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setPreview({ ...preview, ...data });
        setMessage('文件解析成功，请确认导入');
      } else {
        setMessage(data.error || '文件解析失败');
      }
    } catch (error) {
      setMessage('文件解析失败');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !preview.dataDate || !file) return;

    setUploading(true);
    setImportProgress({ importId: null, progress: 0, total: 0, current: 0, status: 'pending', message: '正在启动导入任务...', result: null });
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataDate', preview.dataDate);
      formData.append('conflictAction', 'skip');

      const response = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.importId) {
        // 启动进度轮询
        setImportProgress(prev => ({ ...prev, importId: data.importId, status: 'processing' }));
        startProgressPolling(data.importId);
        setMessage('导入任务已启动，正在处理...');
      } else {
        setMessage(data.error || '数据导入失败');
        setUploading(false);
        setImportProgress({ importId: null, progress: 0, total: 0, current: 0, status: 'failed', message: data.error || '数据导入失败', result: null });
      }
    } catch (error) {
      setMessage('数据导入失败');
      setUploading(false);
      setImportProgress({ importId: null, progress: 0, total: 0, current: 0, status: 'failed', message: '数据导入失败', result: null });
    }
  };

  // 轮询导入进度
  const startProgressPolling = (importId: string) => {
    // 清除之前的定时器
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    // 每500ms轮询一次
    progressTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/import-progress?importId=${importId}`);
        const data = await response.json();

        if (response.ok) {
          setImportProgress({
            importId: data.importId,
            progress: data.progress,
            total: data.total,
            current: data.current,
            status: data.status,
            message: data.message,
            result: data.result,
          });

          // 导入完成或失败时停止轮询
          if (data.status === 'completed' || data.status === 'failed') {
            stopProgressPolling();
            setUploading(false);
            
            if (data.status === 'completed') {
              setMessage(data.message || '数据导入成功！');
              fetchStatus();
              // 刷新全局日期列表
              if (typeof window !== 'undefined' && (window as any).refreshDates) {
                (window as any).refreshDates();
              }
              setFile(null);
              setPreview(null);
              
              // 3秒后清除进度显示
              setTimeout(() => {
                setImportProgress({ importId: null, progress: 0, total: 0, current: 0, status: 'pending', message: '', result: null });
              }, 3000);
            } else {
              setMessage(data.message || '数据导入失败');
            }
          }
        } else {
          console.error('获取进度失败:', data.error);
        }
      } catch (error) {
        console.error('轮询进度异常:', error);
      }
    }, 500);
  };

  // 停止轮询
  const stopProgressPolling = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const handleClearData = () => {
    setDeleteTarget('all');
    setShowDeleteConfirm(true);
  };

  const handleDeleteByDate = () => {
    if (!dateRange.startDate && !dateRange.endDate) {
      setMessage('请选择至少一个日期');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setDeleteTarget('range');
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);

    try {
      const body: any = {};
      if (deleteTarget === 'all') {
        body.all = true;
      } else {
        if (dateRange.startDate) body.startDate = dateRange.startDate;
        if (dateRange.endDate) body.endDate = dateRange.endDate;
      }

      const response = await fetch('/api/admin/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
        fetchStatus();
        // 刷新全局日期列表
        if (typeof window !== 'undefined' && (window as any).refreshDates) {
          (window as any).refreshDates();
        }
        if (deleteTarget === 'range') {
          setDateRange({ startDate: '', endDate: '' });
        }
      } else {
        setMessage('删除数据失败');
      }
    } catch (error) {
      setMessage('删除数据失败');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="nav-glass sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <span className="text-white font-bold text-sm">管</span>
            </div>
            <h1 className="text-[17px] font-semibold text-[#1D1D1F]">数据管理后台</h1>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] text-[#86868B] rounded-xl hover:bg-[#00000006] hover:text-[#1D1D1F] transition-colors text-[14px]"
          >
            退出登录
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {message && (
          <div className={`p-4 rounded-xl border text-[14px] ${message.includes('成功') || message.includes('更新') ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20' : 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20'}`}>
            {message}
          </div>
        )}

        {/* 首页文案编辑 */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-[#1D1D1F] flex items-center gap-2">
              <div className="w-1.5 h-4 rounded-full bg-[#0071E3]" />
              首页文案设置
            </h2>
            <button
              onClick={() => setShowHeroEditor(!showHeroEditor)}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl transition-colors text-[14px] font-medium"
            >
              {showHeroEditor ? '取消编辑' : '编辑文案'}
            </button>
          </div>

          {showHeroEditor ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#86868B] mb-2">
                  主标题（支持 HTML 标签，如 <code className="px-1.5 py-0.5 bg-[#F5F5F7] rounded text-[#0071E3]">&lt;span className="text-[#0071E3]"&gt;高亮文字&lt;/span&gt;</code>）
                </label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[#1D1D1F] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50"
                  placeholder="穿越周期的<span className='text-[#0071E3]'>价值投资</span>"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#86868B] mb-2">
                  副标题
                </label>
                <input
                  type="text"
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[#1D1D1F] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50"
                  placeholder="私募星工场全量业绩跟踪平台，实时监控多维度策略表现"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveHeroText}
                  className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl transition-colors text-[14px] font-medium"
                >
                  保存文案
                </button>
                <button
                  onClick={() => {
                    setHeroTitle('');
                    setHeroSubtitle('');
                    localStorage.removeItem('heroTitle');
                    localStorage.removeItem('heroSubtitle');
                    setMessage('已恢复默认文案');
                    setTimeout(() => setMessage(''), 3000);
                  }}
                  className="px-6 py-2.5 bg-[#FFFFFF] border border-[#0000000D] text-[#86868B] rounded-xl hover:bg-[#00000006] transition-colors text-[14px]"
                >
                  恢复默认
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-[#86868B] mb-1">主标题</p>
                <p className="text-[15px] text-[#1D1D1F] font-semibold" dangerouslySetInnerHTML={{ __html: heroTitle || '穿越周期的<span className="text-[#0071E3]">价值投资</span>' }} />
              </div>
              <div>
                <p className="text-[11px] text-[#86868B] mb-1">副标题</p>
                <p className="text-[14px] text-[#86868B]">{heroSubtitle || '私募星工场全量业绩跟踪平台，实时监控多维度策略表现'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Excel 上传区域 */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-[#0071E3]" />
            Excel 数据导入
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#86868B] mb-2">
                选择 Excel 文件
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="block w-full text-[14px] text-[#86868B]
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-[13px] file:font-medium
                  file:bg-[#0071E3]/10 file:text-[#0071E3]
                  hover:file:bg-[#0071E3]/20 transition-colors"
              />
            </div>

            {preview && (
              <div className="p-4 bg-[#FFFFFF] rounded-xl border border-[#0000000D]">
                <h3 className="font-semibold text-[#0071E3] text-[14px] mb-2">文件预览</h3>
                <p className="text-[13px] text-[#86868B]">文件名：{preview.fileName}</p>
                <div className="mt-3">
                  <label className="block text-[13px] font-medium text-[#86868B] mb-2">
                    数据日期
                  </label>
                  <input
                    type="date"
                    value={preview.manualDate}
                    onChange={(e) => setPreview({ ...preview, manualDate: e.target.value })}
                    className="px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[#1D1D1F] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50"
                  />
                </div>
                {preview.strategies && (
                  <div className="mt-3">
                    <p className="text-[13px] text-[#86868B] mb-2">策略数据：</p>
                    <ul className="space-y-1 text-[13px]">
                      {Object.entries(preview.strategies as Record<string, number>).map(([strategy, count]) => (
                        <li key={strategy} className="text-[#1D1D1F] flex justify-between">
                          <span>{STRATEGY_NAME_MAP[strategy] || strategy}</span>
                          <span className="font-mono text-[#0071E3]">{count} 条</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 导入进度条 */}
            {importProgress.importId && importProgress.status === 'processing' && (
              <div className="p-4 bg-[#FFFFFF] rounded-xl border border-[#0071E3]/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[#0071E3] text-[14px] flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
                    导入进度
                  </h3>
                  <span className="text-[13px] font-mono text-[#0071E3]">{importProgress.progress}%</span>
                </div>
                <div className="w-full bg-[#F5F5F7] rounded-full h-3 overflow-hidden border border-[#0000000D]">
                  <div 
                    className="h-full bg-[#0071E3] transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${importProgress.progress}%` }}
                  />
                </div>
                <p className="text-[13px] text-[#86868B] mt-2">{importProgress.message}</p>
                <p className="text-[11px] text-[#A1A1A6] mt-1 font-mono">
                  {importProgress.current} / {importProgress.total} 条
                </p>
              </div>
            )}

            {/* 导入完成/失败提示 */}
            {importProgress.status === 'completed' && (
              <div className="p-4 bg-[#16A34A]/10 rounded-xl border border-[#16A34A]/30">
                <h3 className="font-semibold text-[#16A34A] text-[14px] mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  导入完成
                </h3>
                <p className="text-[13px] text-[#16A34A]">{importProgress.message}</p>
                {importProgress.result?.imported && (
                  <ul className="mt-2 space-y-1 text-[13px]">
                    {Object.entries(importProgress.result.imported).map(([strategy, count]) => (
                      <li key={strategy} className="text-[#16A34A] flex justify-between">
                        <span>{STRATEGY_NAME_MAP[strategy] || strategy}</span>
                        <span className="font-mono">{String(count)} 条</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {importProgress.status === 'failed' && (
              <div className="p-4 bg-[#DC2626]/10 rounded-xl border border-[#DC2626]/30">
                <h3 className="font-semibold text-[#DC2626] text-[14px] mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  导入失败
                </h3>
                <p className="text-[13px] text-[#DC2626]">{importProgress.message}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={!file || uploading}
                className="px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[14px] font-medium"
              >
                {uploading ? '解析中...' : '解析文件'}
              </button>
              <button
                onClick={handleImport}
                disabled={!preview || uploading}
                className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[14px] font-medium"
              >
                {uploading ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>

        {/* 数据状态 */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-[#0071E3]" />
            数据状态
          </h2>
          {loading ? (
            <p className="text-[#86868B] text-[14px]">加载中...</p>
          ) : status ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-[#FFFFFF] rounded-xl p-4 border border-[#0000000D]">
                  <p className="text-[11px] text-[#86868B] mb-1">最新数据日期</p>
                  <p className="text-[#1D1D1F] font-mono text-[15px]">{status.latestDate || '无'}</p>
                </div>
                <div className="flex-1 bg-[#FFFFFF] rounded-xl p-4 border border-[#0000000D]">
                  <p className="text-[11px] text-[#86868B] mb-1">总记录数</p>
                  <p className="text-[#0071E3] font-mono text-[15px] font-semibold">{status.totalRecords}</p>
                </div>
              </div>
              {status.strategyStats && (
                <div>
                  <p className="text-[11px] text-[#86868B] mb-2">各策略记录数</p>
                  <ul className="space-y-1 text-[13px]">
                    {status.strategyStats.map((stat: any) => (
                      <li key={stat.strategyType} className="flex justify-between items-center py-2 border-b border-[#0000000D]">
                        <span className="text-[#86868B]">{STRATEGY_NAME_MAP[stat.strategyType] || stat.strategyType}</span>
                        <span className="font-mono text-[#0071E3]">{stat.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#86868B] text-[14px]">暂无数据</p>
          )}
        </div>

        {/* 数据管理 */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-[#DC2626]" />
            数据管理
          </h2>

          {/* 按日期删除 */}
          <div className="mb-5 p-4 bg-[#FFFFFF] rounded-xl border border-[#0000000D]">
            <h3 className="text-[13px] font-medium text-[#86868B] mb-3">
              按日期范围删除
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-[11px] text-[#86868B] mb-1">起始日期</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[#1D1D1F] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]/50"
                />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-[11px] text-[#86868B] mb-1">结束日期</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[#1D1D1F] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]/50"
                />
              </div>
              <button
                onClick={handleDeleteByDate}
                disabled={!dateRange.startDate && !dateRange.endDate}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/20 rounded-xl transition-colors text-[14px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                删除选定日期数据
              </button>
            </div>
            <p className="text-[11px] text-[#86868B] mt-2">
              提示：只选起始日期则删除该日期之后的所有数据；只选结束日期则删除该日期之前的所有数据；两者都选则删除该范围内的数据。
            </p>
          </div>

          {/* 清空所有数据 */}
          <div className="pt-4 border-t border-[#0000000D]">
            <h3 className="text-[13px] font-medium text-[#86868B] mb-3">
              危险操作
            </h3>
            <button
              onClick={handleClearData}
              className="px-4 py-2.5 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/20 rounded-xl transition-colors text-[14px] font-medium"
            >
              清空所有数据
            </button>
          </div>
        </div>

        {/* 删除确认弹窗 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-apple-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[#1D1D1F]">
                    {deleteTarget === 'all' ? '确认清空所有数据？' : '确认删除选定日期数据？'}
                  </h3>
                  <p className="text-[13px] text-[#86868B] mt-0.5">此操作不可恢复</p>
                </div>
              </div>

              {deleteTarget === 'range' && (
                <div className="mb-4 p-4 bg-[#FFFFFF] rounded-xl border border-[#0000000D]">
                  <p className="text-[13px] text-[#86868B] mb-1">即将删除的日期范围：</p>
                  <p className="text-[15px] text-[#DC2626] font-medium">
                    {dateRange.startDate || '最早'} ~ {dateRange.endDate || '最晚'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] text-[#1D1D1F] rounded-xl hover:bg-[#00000006] transition-colors text-[14px]"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl transition-colors text-[14px] font-medium"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
