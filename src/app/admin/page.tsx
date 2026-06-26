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

  // 检查是否已认证
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        setIsAuthenticated(true);
        setLoading(false);
      } else {
        localStorage.removeItem('adminToken');
        setLoading(false);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('adminToken');
      setLoading(false);
    }
  };

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
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-dark-textDim text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="bg-dark-card border border-dark-border p-8 rounded-xl w-96">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">管</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark-text">管理后台登录</h1>
              <p className="text-xs text-dark-textDim">私募星工厂数据管理</p>
            </div>
          </div>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-dark-textDim uppercase tracking-wider mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50 transition-all placeholder-dark-textDim"
                placeholder="输入管理密码"
              />
            </div>
            {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors font-medium text-sm"
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

  useEffect(() => {
    fetchStatus();
  }, []);

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

  const handleClearData = async () => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      if (response.ok) {
        setMessage('数据已清空');
        fetchStatus();
      } else {
        setMessage('清空数据失败');
      }
    } catch (error) {
      setMessage('清空数据失败');
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card/80 backdrop-blur-md border-b border-dark-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">管</span>
            </div>
            <h1 className="text-base font-bold text-dark-text tracking-wide">数据管理后台</h1>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-dark-card border border-dark-border text-dark-textMuted rounded-lg hover:bg-dark-cardHover hover:text-dark-text transition-colors text-sm"
          >
            退出登录
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {message && (
          <div className={`p-4 rounded-lg border text-sm ${message.includes('成功') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {message}
          </div>
        )}

        {/* Excel 上传区域 */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-dark-text mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-cyan-400" />
            Excel 数据导入
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dark-textDim uppercase tracking-wider mb-2">
                选择 Excel 文件
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-dark-textDim
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-cyan-500/10 file:text-cyan-400
                  hover:file:bg-cyan-500/20 transition-colors"
              />
            </div>

            {preview && (
              <div className="p-4 bg-dark-bg rounded-lg border border-dark-border">
                <h3 className="font-semibold text-cyan-400 text-sm mb-2">文件预览</h3>
                <p className="text-xs text-dark-textMuted">文件名：{preview.fileName}</p>
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-dark-textDim uppercase tracking-wider mb-2">
                    数据日期
                  </label>
                  <input
                    type="date"
                    value={preview.manualDate}
                    onChange={(e) => setPreview({ ...preview, manualDate: e.target.value })}
                    className="px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50"
                  />
                </div>
                {preview.strategies && (
                  <div className="mt-3">
                    <p className="text-xs text-dark-textMuted mb-2">策略数据：</p>
                    <ul className="space-y-1 text-xs">
                      {Object.entries(preview.strategies as Record<string, number>).map(([strategy, count]) => (
                        <li key={strategy} className="text-dark-text flex justify-between">
                          <span>{STRATEGY_NAME_MAP[strategy] || strategy}</span>
                          <span className="font-mono text-cyan-400">{count} 条</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 导入进度条 */}
            {importProgress.importId && importProgress.status === 'processing' && (
              <div className="p-4 bg-dark-bg rounded-lg border border-cyan-400/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-cyan-400 text-sm flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                    导入进度
                  </h3>
                  <span className="text-xs font-mono text-cyan-300">{importProgress.progress}%</span>
                </div>
                <div className="w-full bg-dark-card rounded-full h-3 overflow-hidden border border-dark-border">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${importProgress.progress}%` }}
                  />
                </div>
                <p className="text-xs text-dark-textMuted mt-2">{importProgress.message}</p>
                <p className="text-[10px] text-dark-textDim mt-1 font-mono">
                  {importProgress.current} / {importProgress.total} 条
                </p>
              </div>
            )}

            {/* 导入完成/失败提示 */}
            {importProgress.status === 'completed' && (
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-400/30">
                <h3 className="font-semibold text-green-400 text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  导入完成
                </h3>
                <p className="text-xs text-green-300">{importProgress.message}</p>
                {importProgress.result?.imported && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {Object.entries(importProgress.result.imported).map(([strategy, count]) => (
                      <li key={strategy} className="text-green-200 flex justify-between">
                        <span>{STRATEGY_NAME_MAP[strategy] || strategy}</span>
                        <span className="font-mono">{String(count)} 条</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {importProgress.status === 'failed' && (
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-400/30">
                <h3 className="font-semibold text-red-400 text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  导入失败
                </h3>
                <p className="text-xs text-red-300">{importProgress.message}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={!file || uploading}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {uploading ? '解析中...' : '解析文件'}
              </button>
              <button
                onClick={handleImport}
                disabled={!preview || uploading}
                className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {uploading ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>

        {/* 数据状态 */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-dark-text mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-cyan-400" />
            数据状态
          </h2>
          {loading ? (
            <p className="text-dark-textDim text-sm">加载中...</p>
          ) : status ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <p className="text-[10px] text-dark-textDim uppercase tracking-wider mb-1">最新数据日期</p>
                  <p className="text-dark-text font-mono text-sm">{status.latestDate || '无'}</p>
                </div>
                <div className="flex-1 bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <p className="text-[10px] text-dark-textDim uppercase tracking-wider mb-1">总记录数</p>
                  <p className="text-cyan-400 font-mono text-sm font-semibold">{status.totalRecords}</p>
                </div>
              </div>
              {status.strategyStats && (
                <div>
                  <p className="text-[10px] text-dark-textDim uppercase tracking-wider mb-2">各策略记录数</p>
                  <ul className="space-y-1 text-xs">
                    {status.strategyStats.map((stat: any) => (
                      <li key={stat.strategyType} className="flex justify-between items-center py-1 border-b border-dark-border/30">
                        <span className="text-dark-textMuted">{STRATEGY_NAME_MAP[stat.strategyType] || stat.strategyType}</span>
                        <span className="font-mono text-cyan-400">{stat.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-dark-textDim text-sm">暂无数据</p>
          )}
        </div>

        {/* 数据管理 */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-dark-text mb-4 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-red-400" />
            数据管理
          </h2>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium"
          >
            清空所有数据
          </button>
        </div>
      </main>
    </div>
  );
}
