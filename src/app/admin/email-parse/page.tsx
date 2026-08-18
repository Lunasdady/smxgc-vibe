'use client';

import { useState, useEffect, useRef } from 'react';

export default function EmailParsePage() {
  const [activeTab, setActiveTab] = useState<'configs' | 'results' | 'nav'>('configs');
  
  // 解析状态提升到父组件,避免切换Tab丢失
  const [parseingId, setParseingId] = useState<number | null>(null);
  const [parseProgress, setParseProgress] = useState<{
    taskId: string;
    progress: number;
    message: string;
    current: number;
    total: number;
  } | null>(null);
  
  // 页面加载时恢复解析状态
  useEffect(() => {
    restoreParseState();
  }, []);
  
  // 恢复解析状态(切换/刷新界面)
  const restoreParseState = async () => {
    try {
      console.log('🔄 检查是否有进行中的解析任务...');
      const response = await fetch('/api/admin/email/parse');
      const data = await response.json();
      
      if (response.ok && data.tasks && data.tasks.length > 0) {
        // 找到第一个进行中的任务
        const task = data.tasks[0];
        console.log('✅ 发现进行中的任务:', task);
        
        setParseingId(task.configId);
        
        // 通知子组件开始轮询
        window.dispatchEvent(new CustomEvent('resumeParseProgress', { detail: { taskId: task.taskId } }));
      } else {
        console.log('ℹ️ 没有进行中的任务');
      }
    } catch (error) {
      console.error('恢复解析状态失败:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="nav-glass sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <span className="text-white font-bold text-sm">邮</span>
            </div>
            <h1 className="text-[17px] font-semibold text-[#1D1D1F]">邮件解析管理</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Tab切换 */}
        <div className="flex gap-2 border-b border-[#0000000D]">
          <button
            onClick={() => setActiveTab('configs')}
            className={`px-4 py-2 text-[14px] font-medium transition-colors ${
              activeTab === 'configs'
                ? 'text-[#0071E3] border-b-2 border-[#0071E3]'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            邮箱配置
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 text-[14px] font-medium transition-colors ${
              activeTab === 'results'
                ? 'text-[#0071E3] border-b-2 border-[#0071E3]'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            解析结果
          </button>
          <button
            onClick={() => setActiveTab('nav')}
            className={`px-4 py-2 text-[14px] font-medium transition-colors ${
              activeTab === 'nav'
                ? 'text-[#0071E3] border-b-2 border-[#0071E3]'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            净值数据
          </button>
        </div>

        {/* 内容区域 */}
        {activeTab === 'configs' && (
          <EmailConfigsTab 
            parseingId={parseingId}
            setParseingId={setParseingId}
            parseProgress={parseProgress}
            setParseProgress={setParseProgress}
          />
        )}
        {activeTab === 'results' && <ParseResultsTab />}
        {activeTab === 'nav' && <NavDataTab />}
      </main>
    </div>
  );
}

function EmailConfigsTab({ 
  parseingId, 
  setParseingId, 
  parseProgress, 
  setParseProgress 
}: {
  parseingId: number | null;
  setParseingId: (id: number | null) => void;
  parseProgress: {
    taskId: string;
    progress: number;
    message: string;
    current: number;
    total: number;
  } | null;
  setParseProgress: (progress: any) => void;
}) {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchConfigs();
    
    // 组件挂载时检查是否有进行中的任务
    restoreParseProgress();
    
    // 监听父组件的恢复事件
    const handleResume = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { taskId } = customEvent.detail;
      console.log('📡 收到恢复事件, taskId:', taskId);
      startProgressPolling(taskId);
    };
    
    window.addEventListener('resumeParseProgress', handleResume);
    
    return () => {
      window.removeEventListener('resumeParseProgress', handleResume);
      stopProgressPolling();
    };
  }, []);

  // 恢复解析进度(组件挂载时调用)
  const restoreParseProgress = async () => {
    try {
      console.log('🔍 检查是否有进行中的解析任务...');
      const response = await fetch('/api/admin/email/parse');
      const data = await response.json();
      
      if (response.ok && data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        console.log('✅ 发现进行中的任务,恢复轮询:', task.id);
        
        // 设置parseingId
        setParseingId(task.configId);
        
        // 设置当前进度
        setParseProgress({
          taskId: task.id,
          progress: task.progress,
          message: task.message,
          current: task.current,
          total: task.total,
        });
        
        // 开始轮询
        startProgressPolling(task.id);
      } else {
        console.log('ℹ️ 没有进行中的任务');
      }
    } catch (error) {
      console.error('恢复解析进度失败:', error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/email/configs');
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (configId: number) => {
    setTestingId(configId);
    setMessage('');
    
    try {
      const response = await fetch(`/api/admin/email/configs/${configId}/test`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ 连接成功! 响应时间: ${data.responseTime}`);
      } else {
        setMessage(`❌ 连接失败: ${data.message || data.error}`);
      }
    } catch (error: any) {
      setMessage(`❌ 连接失败: ${error.message}`);
    } finally {
      setTestingId(null);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const startParse = async (configId: number, fullParse: boolean = false) => {
    console.log('🚀 开始解析, configId:', configId, 'fullParse:', fullParse);
    setParseingId(configId);
    setMessage('');
    setParseProgress(null);
    
    try {
      const response = await fetch('/api/admin/email/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfigId: configId, fullParse }),
      });
      
      const data = await response.json();
      console.log('📡 解析API响应:', data);
      
      if (response.ok && data.taskIds && data.taskIds.length > 0) {
        const taskId = data.taskIds[0];
        console.log('✅ 获取到taskId:', taskId);
        setMessage(`✅ ${data.message}`);
        
        // 开始轮询进度
        startProgressPolling(taskId);
      } else {
        console.error('❌ 解析失败,响应数据:', data);
        setMessage(`❌ 解析失败: ${data.error}`);
      }
    } catch (error: any) {
      console.error('❌ 请求解析API失败:', error);
      setMessage(`❌ 解析失败: ${error.message}`);
    } finally {
      // 注意: 不在这里清除parseingId,等进度轮询完成后再清除
    }
  };

  // 测试解析(最新100封)
  const testParse = async (configId: number) => {
    console.log('🧪 开始测试解析, configId:', configId);
    setParseingId(configId);
    setMessage('');
    setParseProgress(null);
    
    try {
      const response = await fetch('/api/admin/email/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfigId: configId, testLimit: 100 }),
      });
      
      const data = await response.json();
      console.log('📡 测试解析API响应:', data);
      
      if (response.ok && data.taskIds && data.taskIds.length > 0) {
        const taskId = data.taskIds[0];
        console.log('✅ 获取到taskId:', taskId);
        setMessage(`✅ ${data.message}`);
        
        // 开始轮询进度
        startProgressPolling(taskId);
      } else {
        console.error('❌ 测试解析失败,响应数据:', data);
        setMessage(`❌ 测试解析失败: ${data.error}`);
      }
    } catch (error: any) {
      console.error('❌ 请求测试解析API失败:', error);
      setMessage(`❌ 测试解析失败: ${error.message}`);
    } finally {
      // 注意: 不在这里清除parseingId,等进度轮询完成后再清除
    }
  };

  // 轮询解析进度
  const startProgressPolling = (taskId: string) => {
    console.log('🔄 开始轮询进度, taskId:', taskId);
    
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = setInterval(async () => {
      try {
        console.log('📡 查询进度中...');
        const response = await fetch(`/api/admin/email/parse/status?taskId=${taskId}`);
        const data = await response.json();
        
        console.log('📊 进度数据:', data);

        if (response.ok) {
          console.log('✅ 更新进度状态:', {
            progress: data.progress,
            message: data.message,
            current: data.current,
            total: data.total,
          });
          
          setParseProgress({
            taskId,
            progress: data.progress,
            message: data.message,
            current: data.current,
            total: data.total,
          });

          // 解析完成或失败时停止轮询
          if (data.status === 'completed' || data.status === 'failed') {
            console.log('✅ 解析完成,停止轮询');
            stopProgressPolling();
            setParseingId(null);
            
            if (data.status === 'completed') {
              setMessage(`✅ ${data.message}`);
            } else {
              setMessage(`❌ ${data.message}`);
            }
            
            // 3秒后清除进度显示
            setTimeout(() => {
              setParseProgress(null);
            }, 3000);
          }
        } else {
          console.error('❌ 获取进度失败:', data.error);
        }
      } catch (error) {
        console.error('❌ 轮询进度失败:', error);
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

  // 取消解析
  const cancelParse = async () => {
    if (!parseProgress) return;
    
    console.log('🛑 请求取消解析, taskId:', parseProgress.taskId);
    setIsCancelling(true);
    
    try {
      // 调用后端取消API
      const response = await fetch('/api/admin/email/parse/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: parseProgress.taskId }),
      });
      
      const data = await response.json();
      console.log('📡 取消API响应:', data);
      
      if (response.ok) {
        // 停止轮询
        stopProgressPolling();
        setParseProgress(null);
        setParseingId(null);
        setMessage('✅ 已停止解析任务');
      } else {
        console.error('❌ 取消失败:', data.error);
        setMessage(`❌ 取消失败: ${data.error}`);
      }
    } catch (error: any) {
      console.error('❌ 请求取消API失败:', error);
      setMessage(`❌ 取消失败: ${error.message}`);
    } finally {
      setIsCancelling(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-[#86868B]">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-4 rounded-xl border text-[14px] ${
          message.includes('✅') 
            ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20' 
            : 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20'
        }`}>
          {message}
        </div>
      )}
      
      {/* 解析进度条 */}
      {parseProgress && (
        <div className="glass-card rounded-2xl p-4 border border-[#0071E3]/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[#0071E3] text-[14px] flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin" />
              解析进度
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-mono text-[#0071E3]">{parseProgress.progress}%</span>
              <button
                onClick={cancelParse}
                disabled={isCancelling}
                className="px-3 py-1 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] rounded-lg text-[12px] disabled:opacity-50"
              >
                {isCancelling ? '取消中...' : '停止解析'}
              </button>
            </div>
          </div>
          <div className="w-full bg-[#F5F5F7] rounded-full h-3 overflow-hidden border border-[#0000000D]">
            <div 
              className="h-full bg-[#0071E3] transition-all duration-300 ease-out rounded-full"
              style={{ width: `${parseProgress.progress}%` }}
            />
          </div>
          <p className="text-[13px] text-[#86868B] mt-2">{parseProgress.message}</p>
          <p className="text-[11px] text-[#A1A1A6] mt-1 font-mono">
            {parseProgress.current} / {parseProgress.total} 封
          </p>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h2 className="text-[15px] font-semibold text-[#1D1D1F]">邮箱配置列表</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-[14px] font-medium"
        >
          {showForm ? '取消' : '新增邮箱'}
        </button>
      </div>

      {showForm && <EmailConfigForm onSuccess={() => { fetchConfigs(); setShowForm(false); }} />}

      {configs.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-[#86868B]">暂无邮箱配置,请添加</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => (
            <div key={config.id} className="glass-card rounded-2xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{config.email}</h3>
                  <p className="text-[13px] text-[#86868B] mt-1">
                    IMAP: {config.imapHost}:{config.imapPort}
                  </p>
                  <p className="text-[13px] text-[#86868B]">
                    SSL: {config.sslEnabled ? '是' : '否'} | 
                    状态: <span className={config.enabled ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                      {config.enabled ? '启用' : '禁用'}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => testConnection(config.id)}
                    disabled={testingId === config.id}
                    className="px-3 py-1.5 bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] rounded-lg text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingId === config.id ? '测试中...' : '测试连接'}
                  </button>
                  <button 
                    onClick={() => testParse(config.id)}
                    disabled={parseingId === config.id}
                    className="px-3 py-1.5 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] rounded-lg text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {parseingId === config.id ? '解析中...' : '测试解析'}
                  </button>
                  <button 
                    onClick={() => startParse(config.id, false)}
                    disabled={parseingId === config.id}
                    className="px-3 py-1.5 bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] rounded-lg text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {parseingId === config.id ? '解析中...' : '增量解析'}
                  </button>
                  <button 
                    onClick={() => startParse(config.id, true)}
                    disabled={parseingId === config.id}
                    className="px-3 py-1.5 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] rounded-lg text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {parseingId === config.id ? '解析中...' : '全量解析'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmailConfigForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    email: '',
    imapHost: '',
    imapPort: '993',
    password: '',
    sslEnabled: true,
    enabled: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/admin/email/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create config:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-[15px] font-semibold text-[#1D1D1F]">新增邮箱配置</h3>
      
      <div>
        <label className="block text-[13px] font-medium text-[#86868B] mb-2">邮箱地址</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-medium text-[#86868B] mb-2">IMAP服务器</label>
          <input
            type="text"
            value={form.imapHost}
            onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
            className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
            placeholder="mail.example.com"
            required
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#86868B] mb-2">IMAP端口</label>
          <input
            type="number"
            value={form.imapPort}
            onChange={(e) => setForm({ ...form, imapPort: e.target.value })}
            className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#86868B] mb-2">密码/授权码</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          required
        />
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.sslEnabled}
            onChange={(e) => setForm({ ...form, sslEnabled: e.target.checked })}
          />
          <span className="text-[14px] text-[#86868B]">启用SSL</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <span className="text-[14px] text-[#86868B]">启用此邮箱</span>
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-[14px] font-medium disabled:opacity-50"
        >
          {submitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}

function ParseResultsTab() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>(null);
  const [filters, setFilters] = useState({
    parseStatus: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'filtered' | 'all'>('selected');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchStatistics();
    fetchResults();
  }, [filters]);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/admin/email/results?action=statistics');
      const data = await response.json();
      if (response.ok) {
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const fetchResults = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
        ...filters,
      });
      
      const response = await fetch(`/api/admin/email/results?${params}`);
      const data = await response.json();
      setResults(data.results || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
      setSelectedIds([]); // 清空选中
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换选中
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === results.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map(r => r.id));
    }
  };

  // 显示删除确认
  const showDeleteDialog = (mode: 'selected' | 'filtered' | 'all') => {
    setDeleteMode(mode);
    setShowDeleteConfirm(true);
  };

  // 执行删除
  const handleDelete = async () => {
    setDeleting(true);
    try {
      let body: any = {};
      
      if (deleteMode === 'selected') {
        if (selectedIds.length === 0) {
          alert('请先选择要删除的数据');
          return;
        }
        body.ids = selectedIds;
      } else if (deleteMode === 'filtered') {
        body.parseStatus = filters.parseStatus || undefined;
        body.startDate = filters.startDate || undefined;
        body.endDate = filters.endDate || undefined;
      } else if (deleteMode === 'all') {
        body.deleteAll = true;
      }
      
      const response = await fetch('/api/admin/email/results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ ${data.message}`);
        setShowDeleteConfirm(false);
        fetchResults(); // 刷新列表
      } else {
        alert(`❌ 删除失败: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ 删除失败: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="text-[#16A34A]">✅</span>;
      case 'failed':
        return <span className="text-[#DC2626]">❌</span>;
      case 'skipped':
        return <span className="text-[#86868B]">⚪</span>;
      default:
        return <span className="text-[#86868B]">-</span>;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-[#86868B]">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 - 固定在顶部 */}
      {statistics && (
        <div className="sticky top-16 z-20 glass-card rounded-2xl p-4 border border-[#0071E3]/20 bg-white/95 backdrop-blur-xl shadow-lg">
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] mb-3">📊 解析结果统计</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">总邮件数</div>
              <div className="text-2xl font-bold text-blue-700">{statistics?.totalCount || 0}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600 mb-1">净值落库成功</div>
              <div className="text-2xl font-bold text-green-700">{statistics?.successCount || 0}</div>
              <div className="text-xs text-green-600 mt-1">
                {statistics?.totalPercent || 0}%
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600 mb-1">净值未落库</div>
              <div className="text-2xl font-bold text-red-700">{statistics?.failedCount || 0}</div>
              <div className="text-xs text-red-600 mt-1">
                {statistics?.failedPercent || 0}%
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">跳过</div>
              <div className="text-2xl font-bold text-gray-700">{statistics?.skippedCount || 0}</div>
              <div className="text-xs text-gray-600 mt-1">
                {statistics?.skippedPercent || 0}%
              </div>
            </div>
          </div>
          {statistics?.topFailureReasons && statistics.topFailureReasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#0000000D]">
              <div className="text-sm text-[#86868B] mb-2">🔍 主要失败原因:</div>
              <div className="flex flex-wrap gap-2">
                {statistics.topFailureReasons.map((reason: any, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs">
                    {reason.reason}: {reason.count}封
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">确认删除</h3>
            <p className="text-[14px] text-[#86868B] mb-6">
              {deleteMode === 'selected' && `确定要删除选中的 ${selectedIds.length} 条解析结果吗？`}
              {deleteMode === 'filtered' && '确定要删除当前筛选条件下的所有解析结果吗？'}
              {deleteMode === 'all' && '⚠️ 确定要删除所有解析结果吗？此操作不可恢复！'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] rounded-xl text-[14px] disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-[14px] disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 筛选器和操作按钮 */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-3 items-center flex-1">
          <select
            value={filters.parseStatus}
            onChange={(e) => setFilters({ ...filters, parseStatus: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          >
            <option value="">全部状态</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
            <option value="skipped">跳过</option>
          </select>
          
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          />
          
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          />
        </div>
        
        <div className="flex gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <button
              onClick={() => showDeleteDialog('selected')}
              className="px-4 py-2 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] rounded-xl text-[14px] font-medium"
            >
              删除选中 ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => showDeleteDialog('filtered')}
            className="px-4 py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] rounded-xl text-[14px] font-medium"
          >
            删除筛选结果
          </button>
          <button
            onClick={() => showDeleteDialog('all')}
            className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-[14px] font-medium"
          >
            清空全部
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-[14px]">
          <thead className="bg-[#F5F5F7] border-b border-[#0000000D]">
            <tr>
              <th className="px-4 py-3 text-center text-[#86868B] font-medium w-12">
                <input
                  type="checkbox"
                  checked={results.length > 0 && selectedIds.length === results.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">邮件标题</th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">发送日期</th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">来源邮箱</th>
              <th className="px-4 py-3 text-center text-[#86868B] font-medium">解析结果</th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">失败原因</th>
              <th className="px-4 py-3 text-center text-[#86868B] font-medium">记录数</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} className={`border-b border-[#0000000D] hover:bg-[#F5F5F7]/50 ${
                selectedIds.includes(result.id) ? 'bg-[#0071E3]/5' : ''
              }`}>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(result.id)}
                    onChange={() => toggleSelect(result.id)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-[#1D1D1F]">{result.subject}</td>
                <td className="px-4 py-3 text-[#86868B]">
                  {result.sentDate ? new Date(result.sentDate).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3 text-[#86868B]">{result.emailConfig?.email || '-'}</td>
                <td className="px-4 py-3 text-center">{getStatusIcon(result.parseStatus)}</td>
                <td className="px-4 py-3">
                  {result.errorReason ? (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg inline-block max-w-xs truncate" title={result.errorReason}>
                      {result.errorReason}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-mono text-[#0071E3]">
                  {result.recordCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {results.length === 0 && (
          <div className="text-center py-8 text-[#86868B]">暂无解析结果</div>
        )}
      </div>
      
      {/* 分页控件 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-[14px] text-[#86868B]">
            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchResults(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F5F5F7]"
            >
              上一页
            </button>
            <button
              onClick={() => fetchResults(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F5F5F7]"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavDataTab() {
  const [navData, setNavData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    productCode: '',
    productName: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'filtered' | 'all'>('selected');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchNavData();
  }, [filters]);

  const fetchNavData = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
        ...filters,
      });
      
      const response = await fetch(`/api/admin/email/nav?${params}`);
      const data = await response.json();
      setNavData(data.navData || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
      setSelectedIds([]); // 清空选中
    } catch (error) {
      console.error('Failed to fetch nav data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换选中
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === navData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(navData.map(d => d.id));
    }
  };

  // 显示删除确认
  const showDeleteDialog = (mode: 'selected' | 'filtered' | 'all') => {
    setDeleteMode(mode);
    setShowDeleteConfirm(true);
  };

  // 执行删除
  const handleDelete = async () => {
    setDeleting(true);
    try {
      let body: any = {};
      
      if (deleteMode === 'selected') {
        if (selectedIds.length === 0) {
          alert('请先选择要删除的数据');
          return;
        }
        body.ids = selectedIds;
      } else if (deleteMode === 'filtered') {
        body.productCode = filters.productCode || undefined;
        body.startDate = filters.startDate || undefined;
        body.endDate = filters.endDate || undefined;
      } else if (deleteMode === 'all') {
        body.deleteAll = true;
      }
      
      const response = await fetch('/api/admin/email/nav', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ ${data.message}`);
        setShowDeleteConfirm(false);
        fetchNavData(); // 刷新列表
      } else {
        alert(`❌ 删除失败: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ 删除失败: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const styles: Record<string, string> = {
      high: 'bg-[#16A34A]/10 text-[#16A34A]',
      medium: 'bg-[#0071E3]/10 text-[#0071E3]',
      low: 'bg-[#DC2626]/10 text-[#DC2626]',
    };
    const labels: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };
    return (
      <span className={`px-2 py-1 rounded-lg text-[12px] ${styles[confidence]}`}>
        {labels[confidence]}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-[#86868B]">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">确认删除</h3>
            <p className="text-[14px] text-[#86868B] mb-6">
              {deleteMode === 'selected' && `确定要删除选中的 ${selectedIds.length} 条数据吗？`}
              {deleteMode === 'filtered' && '确定要删除当前筛选条件下的所有数据吗？'}
              {deleteMode === 'all' && '⚠️ 确定要删除所有净值数据吗？此操作不可恢复！'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] rounded-xl text-[14px] disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-[14px] disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 筛选器和操作按钮 */}
      <div className="flex justify-between items-start gap-4">
        <div className="grid grid-cols-2 gap-3 flex-1">
          <input
            type="text"
            placeholder="产品代码"
            value={filters.productCode}
            onChange={(e) => setFilters({ ...filters, productCode: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          />
          <input
            type="text"
            placeholder="产品名称"
            value={filters.productName}
            onChange={(e) => setFilters({ ...filters, productName: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px]"
          />
        </div>
        
        <div className="flex gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <button
              onClick={() => showDeleteDialog('selected')}
              className="px-4 py-2 bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] rounded-xl text-[14px] font-medium"
            >
              删除选中 ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => showDeleteDialog('filtered')}
            className="px-4 py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] rounded-xl text-[14px] font-medium"
          >
            删除筛选结果
          </button>
          <button
            onClick={() => showDeleteDialog('all')}
            className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-[14px] font-medium"
          >
            清空全部
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-[14px]">
          <thead className="bg-[#F5F5F7] border-b border-[#0000000D]">
            <tr>
              <th className="px-4 py-3 text-center text-[#86868B] font-medium w-12">
                <input
                  type="checkbox"
                  checked={navData.length > 0 && selectedIds.length === navData.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">产品名称</th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">产品代码</th>
              <th className="px-4 py-3 text-left text-[#86868B] font-medium">净值日期</th>
              <th className="px-4 py-3 text-right text-[#86868B] font-medium">单位净值</th>
              <th className="px-4 py-3 text-right text-[#86868B] font-medium">累计净值</th>
              <th className="px-4 py-3 text-center text-[#86868B] font-medium">来源</th>
              <th className="px-4 py-3 text-center text-[#86868B] font-medium">置信度</th>
            </tr>
          </thead>
          <tbody>
            {navData.map((data) => (
              <tr key={data.id} className={`border-b border-[#0000000D] hover:bg-[#F5F5F7]/50 ${
                selectedIds.includes(data.id) ? 'bg-[#0071E3]/5' : ''
              }`}>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(data.id)}
                    onChange={() => toggleSelect(data.id)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-[#1D1D1F] font-medium">{data.productName}</td>
                <td className="px-4 py-3 text-[#86868B] font-mono">{data.productCode}</td>
                <td className="px-4 py-3 text-[#86868B]">
                  {new Date(data.navDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#0071E3]">
                  {data.unitNav?.toFixed(4) || '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[#0071E3]">
                  {data.cumulativeNav?.toFixed(4) || '-'}
                </td>
                <td className="px-4 py-3 text-center text-[#86868B] capitalize">
                  {data.source}
                </td>
                <td className="px-4 py-3 text-center">
                  {getConfidenceBadge(data.confidence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {navData.length === 0 && (
          <div className="text-center py-8 text-[#86868B]">暂无净值数据</div>
        )}
      </div>
      
      {/* 分页控件 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-[14px] text-[#86868B]">
            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchNavData(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F5F5F7]"
            >
              上一页
            </button>
            <button
              onClick={() => fetchNavData(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F5F5F7]"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
