'use client';

import { useState, useEffect } from 'react';
import AdminTabs from '../_components/AdminTabs';

interface StrategyDict {
  id: number;
  level: number; // 1=一级, 2=二级
  parentStrategy: string | null;
  strategyName: string;
  sortOrder: number;
  isActive: boolean;
}

export default function StrategyDictionaryPage() {
  const [strategies, setStrategies] = useState<StrategyDict[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'primary' | 'secondary'>('primary');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    level: 1,
    parentStrategy: '',
    strategyName: '',
    sortOrder: 0,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/strategy-dictionary');
      const data = await response.json();
      if (response.ok) {
        setStrategies(data.strategies || []);
      } else {
        setMessage(`加载失败: ${data.error}`);
      }
    } catch (error) {
      console.error('加载策略字典失败:', error);
      setMessage('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      level: activeTab === 'primary' ? 1 : 2,
      parentStrategy: activeTab === 'secondary' ? getPrimaryStrategies()[0] || '' : '',
      strategyName: '',
      sortOrder: 0,
    });
    setEditingId(null);
    setShowAddDialog(true);
  };

  const handleEdit = (strategy: StrategyDict) => {
    setFormData({
      level: strategy.level,
      parentStrategy: strategy.parentStrategy || '',
      strategyName: strategy.strategyName,
      sortOrder: strategy.sortOrder,
    });
    setEditingId(strategy.id);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!formData.strategyName.trim()) {
      setMessage('请输入策略名称');
      return;
    }

    try {
      const response = await fetch('/api/admin/strategy-dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...formData,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(editingId ? '更新成功' : '添加成功');
        setShowAddDialog(false);
        fetchStrategies();
      } else {
        setMessage(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      setMessage('保存失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个策略吗？')) return;

    try {
      const response = await fetch(`/api/admin/strategy-dictionary?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('删除成功');
        fetchStrategies();
      } else {
        const data = await response.json();
        setMessage(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      setMessage('删除失败');
    }
  };

  const handleToggleActive = async (strategy: StrategyDict) => {
    try {
      const response = await fetch('/api/admin/strategy-dictionary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: strategy.id,
          isActive: !strategy.isActive,
        }),
      });

      if (response.ok) {
        fetchStrategies();
      }
    } catch (error) {
      console.error('切换状态失败:', error);
    }
  };

  const getPrimaryStrategies = () => {
    return strategies
      .filter(s => s.level === 1 && s.isActive)
      .map(s => s.strategyName);
  };

  const getFilteredStrategies = () => {
    const level = activeTab === 'primary' ? 1 : 2;
    return strategies.filter(s => s.level === level);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="nav-glass sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <span className="text-white font-bold text-sm">策</span>
            </div>
            <h1 className="text-[17px] font-semibold text-[#1D1D1F]">策略字典管理</h1>
          </div>
        </div>
      </header>

      {/* 固定定位的管理后台Tab导航 */}
      <div className="sticky top-[57px] z-20 bg-[#F5F5F7]/80 backdrop-blur-lg py-3">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-center">
            <AdminTabs />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 消息提示 */}
        {message && (
          <div className="p-4 rounded-xl bg-[#0071E3]/10 text-[#0071E3] text-[14px]">
            {message}
            <button
              onClick={() => setMessage('')}
              className="float-right font-bold cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* 一级/二级策略Tab */}
        <div className="flex gap-2 border-b border-[#0000000D]">
          <button
            onClick={() => setActiveTab('primary')}
            className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${
              activeTab === 'primary'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            一级策略
          </button>
          <button
            onClick={() => setActiveTab('secondary')}
            className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${
              activeTab === 'secondary'
                ? 'border-[#0071E3] text-[#0071E3]'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            二级策略
          </button>
        </div>

        {/* 操作栏 */}
        <div className="flex justify-between items-center">
          <div className="text-[14px] text-[#86868B]">
            {activeTab === 'primary' ? '一级策略' : '二级策略'}管理
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0071E3]/90 text-white rounded-xl text-[14px] font-medium"
          >
            + 添加策略
          </button>
        </div>

        {/* 策略列表 */}
        {loading ? (
          <div className="text-center py-12 text-[#86868B]">加载中...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-apple overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F5F5F7]">
                <tr>
                  <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">
                    排序
                  </th>
                  <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">
                    策略名称
                  </th>
                  {activeTab === 'secondary' && (
                    <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">
                      所属一级策略
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-right text-[12px] font-semibold text-[#86868B] uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0000000D]">
                {getFilteredStrategies().map((strategy) => (
                  <tr key={strategy.id} className="hover:bg-[#F5F5F7]/50">
                    <td className="px-6 py-4 text-[14px] text-[#1D1D1F]">
                      {strategy.sortOrder}
                    </td>
                    <td className="px-6 py-4 text-[14px] font-medium text-[#1D1D1F]">
                      {strategy.strategyName}
                    </td>
                    {activeTab === 'secondary' && (
                      <td className="px-6 py-4 text-[14px] text-[#86868B]">
                        {strategy.parentStrategy || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(strategy)}
                        className={`px-3 py-1 rounded-lg text-[12px] font-medium ${
                          strategy.isActive
                            ? 'bg-[#16A34A]/10 text-[#16A34A]'
                            : 'bg-[#86868B]/10 text-[#86868B]'
                        }`}
                      >
                        {strategy.isActive ? '启用' : '禁用'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(strategy)}
                        className="text-[#0071E3] hover:text-[#0071E3]/80 text-[14px] font-medium"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(strategy.id)}
                        className="text-[#DC2626] hover:text-[#DC2626]/80 text-[14px] font-medium"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {getFilteredStrategies().length === 0 && (
                  <tr>
                    <td
                      colSpan={activeTab === 'secondary' ? 5 : 4}
                      className="px-6 py-12 text-center text-[#86868B]"
                    >
                      暂无数据，请点击"添加策略"添加
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 添加/编辑对话框 */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? '编辑策略' : '添加策略'}
            </h2>

            <div className="space-y-4">
              {activeTab === 'secondary' && (
                <div>
                  <label className="block text-[14px] font-medium text-[#1D1D1F] mb-2">
                    所属一级策略
                  </label>
                  <select
                    value={formData.parentStrategy}
                    onChange={(e) => setFormData({ ...formData, parentStrategy: e.target.value })}
                    className="w-full px-3 py-2 border border-[#0000000D] rounded-lg text-[14px]"
                  >
                    {getPrimaryStrategies().map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[14px] font-medium text-[#1D1D1F] mb-2">
                  策略名称
                </label>
                <input
                  type="text"
                  value={formData.strategyName}
                  onChange={(e) => setFormData({ ...formData, strategyName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#0000000D] rounded-lg text-[14px]"
                  placeholder="请输入策略名称"
                />
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#1D1D1F] mb-2">
                  排序顺序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-[#0000000D] rounded-lg text-[14px]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddDialog(false)}
                className="flex-1 px-4 py-2 border border-[#0000000D] rounded-xl text-[14px] font-medium hover:bg-[#F5F5F7]"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-[#0071E3] text-white rounded-xl text-[14px] font-medium hover:bg-[#0071E3]/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
