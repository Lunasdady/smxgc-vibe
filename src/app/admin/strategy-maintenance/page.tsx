'use client';

import { useState, useEffect } from 'react';
import AdminTabs from '../_components/AdminTabs';

interface Product {
  id: number;
  productCode: string;
  productName: string;
  primaryStrategy: string;   // 一级策略
  secondaryStrategy: string; // 二级策略
  category: string;          // 分类分层
  fundManager: string;       // 基金管理人
  managerScale: string;      // 管理人规模
  latestNavDate: string;
  daysSinceLatestNav: number;
}

interface StrategyDict {
  id: number;
  level: number;
  parentStrategy: string | null;
  strategyName: string;
  sortOrder: number;
  isActive: boolean;
}

export default function StrategyMaintenancePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [strategyDict, setStrategyDict] = useState<StrategyDict[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [message, setMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);
  
  // 筛选状态
  const [filterPrimary, setFilterPrimary] = useState('');
  const [filterSecondary, setFilterSecondary] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // 输入框本地状态
  const [inputValues, setInputValues] = useState<Record<string, { fundManager?: string; managerScale?: string }>>({});

  useEffect(() => {
    fetchProducts();
    fetchStrategyDict();
  }, []);

  const fetchStrategyDict = async () => {
    try {
      const response = await fetch('/api/admin/strategy-dictionary');
      const data = await response.json();
      if (response.ok) {
        setStrategyDict(data.strategies || []);
      }
    } catch (error) {
      console.error('加载策略字典失败:', error);
    }
  };

  // 获取一级策略列表
  const getPrimaryStrategies = () => {
    return strategyDict
      .filter(s => s.level === 1 && s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(s => s.strategyName);
  };

  // 获取指定一级策略下的二级策略
  const getSecondaryStrategies = (primaryStrategy: string) => {
    return strategyDict
      .filter(s => s.level === 2 && s.parentStrategy === primaryStrategy && s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(s => s.strategyName);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/strategy-maintenance/products');
      const data = await response.json();
      if (response.ok) {
        setProducts(data.products || []);
      } else {
        setMessage(`加载失败: ${data.error}`);
      }
    } catch (error) {
      console.error('加载产品列表失败:', error);
      setMessage('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyChange = async (
    productCode: string,
    field: 'primaryStrategy' | 'secondaryStrategy' | 'category' | 'fundManager' | 'managerScale',
    newValue: string
  ) => {
    setSaving(Date.now()); // 使用时间戳作为唯一标识
    try {
      const response = await fetch('/api/admin/strategy-maintenance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode,
          [field]: newValue,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`✅ 已更新: ${data.productName}`);
        // 更新本地状态
        setProducts(prev =>
          prev.map(p => (p.productCode === productCode ? { ...p, [field]: newValue } : p))
        );
      } else {
        setMessage(`❌ 更新失败: ${data.error}`);
      }
    } catch (error) {
      console.error('更新失败:', error);
      setMessage('❌ 更新失败，请重试');
    } finally {
      setSaving(null);
    }

    // 3秒后清除消息
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCategoryChange = async (productCode: string, newValue: string) => {
    await handleStrategyChange(productCode, 'category', newValue);
  };

  const handleFundManagerChange = async (productCode: string, newValue: string) => {
    await handleStrategyChange(productCode, 'fundManager', newValue);
    // 清除本地状态
    setInputValues(prev => {
      const next = { ...prev };
      delete next[productCode];
      return next;
    });
  };

  const handleManagerScaleChange = async (productCode: string, newValue: string) => {
    await handleStrategyChange(productCode, 'managerScale', newValue);
    // 清除本地状态
    setInputValues(prev => {
      const next = { ...prev };
      delete next[productCode];
      return next;
    });
  };

  // 管理人规模选项
  const managerScaleOptions = [
    '0-5亿元',
    '5-10亿元',
    '10-20亿元',
    '20-50亿元',
    '50-100亿元',
    '100亿元以上',
  ];

  const handleExport = async () => {
    try {
      setMessage('📥 正在导出Excel...');
      const response = await fetch('/api/admin/strategy-maintenance/export');
      const blob = await response.blob();
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      link.download = `strategy_mapping_${year}-${month}-${day}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      
      setMessage('✅ 导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      setMessage('❌ 导出失败');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage('📤 正在导入Excel...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/strategy-maintenance/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`✅ 导入成功: 更新 ${data.updateCount} 个产品的策略类型`);
        fetchProducts(); // 重新加载
      } else {
        setMessage(`❌ 导入失败: ${data.error}`);
      }
    } catch (error) {
      console.error('导入失败:', error);
      setMessage('❌ 导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      // 清空file input
      if (e.target) e.target.value = '';
    }
    setTimeout(() => setMessage(''), 5000);
  };

  // 过滤产品
  const filteredProducts = products.filter(p => {
    // 关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      if (
        !p.productName.toLowerCase().includes(keyword) &&
        !p.productCode.toLowerCase().includes(keyword)
      ) {
        return false;
      }
    }
    
    // 一级策略筛选
    if (filterPrimary) {
      if (filterPrimary === '__unset__') {
        // 筛选未设置的
        if (p.primaryStrategy) return false;
      } else if (p.primaryStrategy !== filterPrimary) {
        return false;
      }
    }
    
    // 二级策略筛选
    if (filterSecondary) {
      if (filterSecondary === '__unset__') {
        // 筛选未设置的
        if (p.secondaryStrategy) return false;
      } else if (p.secondaryStrategy !== filterSecondary) {
        return false;
      }
    }
    
    // 分类分层筛选
    if (filterCategory) {
      if (filterCategory === '__unset__') {
        // 筛选未设置的
        if (p.category) return false;
      } else if (p.category !== filterCategory) {
        return false;
      }
    }
    
    return true;
  });
  
  // 清除所有筛选
  const clearFilters = () => {
    setFilterPrimary('');
    setFilterSecondary('');
    setFilterCategory('');
    setSearchKeyword('');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="nav-glass sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <span className="text-white font-bold text-sm">策</span>
            </div>
            <h1 className="text-[17px] font-semibold text-[#1D1D1F]">策略类型维护</h1>
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
          <div
            className={`p-4 rounded-xl border text-[14px] ${
              message.includes('✅') || message.includes('成功')
                ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20'
                : message.includes('❌') || message.includes('失败')
                ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20'
                : 'bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20'
            }`}
          >
            {message}
          </div>
        )}

        {/* 操作栏 */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          {/* 搜索和筛选 */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 搜索框 */}
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="搜索产品名称或代码..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50 transition-all"
                />
              </div>
            </div>
            
            {/* 一级策略筛选 */}
            <div className="relative">
              <select
                value={filterPrimary}
                onChange={e => setFilterPrimary(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50 cursor-pointer hover:border-[#0000001A] transition-all"
              >
                <option value="">所有一级策略</option>
                <option value="__unset__">未设置</option>
                {getPrimaryStrategies().map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {/* 二级策略筛选 */}
            <div className="relative">
              <select
                value={filterSecondary}
                onChange={e => setFilterSecondary(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50 cursor-pointer hover:border-[#0000001A] transition-all"
              >
                <option value="">所有二级策略</option>
                <option value="__unset__">未设置</option>
                {strategyDict
                  .filter(s => s.level === 2 && s.isActive && (!filterPrimary || s.parentStrategy === filterPrimary || filterPrimary === '__unset__'))
                  .map(s => s.strategyName)
                  .map(s => <option key={s} value={s}>{s}</option>)
                }
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {/* 分类分层筛选 */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-[#FFFFFF] border border-[#0000000D] rounded-xl text-[14px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 focus:border-[#0071E3]/50 cursor-pointer hover:border-[#0000001A] transition-all"
              >
                <option value="">所有分类</option>
                <option value="__unset__">未设置</option>
                <option value="观察池">观察池</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {/* 清除筛选 */}
            {(filterPrimary || filterSecondary || filterCategory || searchKeyword) && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 bg-[#0071E3]/5 hover:bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] rounded-xl text-[14px] font-medium transition-all flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>清除筛选</span>
              </button>
            )}
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#0000000D]">
            <div className="text-[14px] text-[#86868B]">
              共 {products.length} 个产品，筛选后显示 {filteredProducts.length} 个
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-4 py-2.5 bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] rounded-xl text-[14px] font-medium transition-colors"
              >
                📥 导出Excel
              </button>
              <label className="px-4 py-2.5 bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] rounded-xl text-[14px] font-medium transition-colors cursor-pointer">
                📤 导入Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                  disabled={importing}
                />
              </label>
              <button
                onClick={fetchProducts}
                className="px-4 py-2.5 bg-[#FFFFFF] border border-[#0000000D] hover:bg-[#F5F5F7] text-[#1D1D1F] rounded-xl text-[14px] font-medium transition-colors"
              >
                🔄 刷新
              </button>
            </div>
          </div>

          <div className="mt-3 text-[12px] text-[#86868B]">
            💡 提示：仅显示15天内有净值更新的产品（共 {products.length} 个）
          </div>
        </div>

        {/* 产品列表 */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-[#86868B]">
              <div className="w-8 h-8 border-2 border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin mx-auto mb-3"></div>
              <p>加载中...</p>
            </div>
          ) : (
            <>
              <table className="w-full text-[14px]">
                <thead className="bg-[#F5F5F7] border-b border-[#0000000D]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-16">序号</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium">产品名称</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-40">产品代码</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-40">一级策略</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-40">二级策略</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-32">分类分层</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-40">基金管理人</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-40">管理人规模</th>
                    <th className="px-4 py-3 text-left text-[#86868B] font-medium w-32">最新净值日期</th>
                    <th className="px-4 py-3 text-center text-[#86868B] font-medium w-24">未更新天数</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => {
                    const primaryStrategies = getPrimaryStrategies();
                    const secondaryStrategies = getSecondaryStrategies(product.primaryStrategy);
                    
                    return (
                    <tr
                      key={product.id}
                      className="border-b border-[#0000000D] hover:bg-[#F5F5F7]/50"
                    >
                      <td className="px-4 py-3 text-[#86868B]">{index + 1}</td>
                      <td className="px-4 py-3 text-[#1D1D1F] font-medium">{product.productName}</td>
                      <td className="px-4 py-3 font-mono text-[#0071E3]">{product.productCode}</td>
                      <td className="px-4 py-3">
                        <select
                          value={product.primaryStrategy || ''}
                          onChange={e => handleStrategyChange(product.productCode, 'primaryStrategy', e.target.value)}
                          disabled={saving !== null}
                          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#0000000D] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-50"
                        >
                          <option value="">未设置</option>
                          {primaryStrategies.map(strategy => (
                            <option key={strategy} value={strategy}>
                              {strategy}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={product.secondaryStrategy || ''}
                          onChange={e => handleStrategyChange(product.productCode, 'secondaryStrategy', e.target.value)}
                          disabled={saving !== null || !product.primaryStrategy}
                          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#0000000D] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-50"
                        >
                          <option value="">未设置</option>
                          {secondaryStrategies.map(strategy => (
                            <option key={strategy} value={strategy}>
                              {strategy}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={product.category || ''}
                          onChange={e => handleCategoryChange(product.productCode, e.target.value)}
                          disabled={saving !== null}
                          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#0000000D] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-50"
                        >
                          <option value="">未设置</option>
                          <option value="观察池">观察池</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={inputValues[product.productCode]?.fundManager ?? product.fundManager ?? ''}
                          onChange={e => {
                            setInputValues(prev => ({
                              ...prev,
                              [product.productCode]: {
                                ...prev[product.productCode],
                                fundManager: e.target.value,
                              },
                            }));
                          }}
                          onBlur={e => handleFundManagerChange(product.productCode, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleFundManagerChange(product.productCode, (e.target as HTMLInputElement).value);
                            }
                          }}
                          placeholder="请输入基金管理人"
                          className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#0000000D] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 placeholder-[#A1A1A6]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={inputValues[product.productCode]?.managerScale ?? product.managerScale ?? ''}
                          onChange={e => handleManagerScaleChange(product.productCode, e.target.value)}
                          disabled={saving !== null}
                          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#0000000D] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-50 cursor-pointer hover:border-[#0000001A] transition-all"
                        >
                          <option value="">未设置</option>
                          {managerScaleOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[#86868B]">
                        {new Date(product.latestNavDate).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-lg text-[12px] font-medium ${
                            product.daysSinceLatestNav <= 3
                              ? 'bg-[#16A34A]/10 text-[#16A34A]'
                              : product.daysSinceLatestNav <= 7
                              ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#DC2626]/10 text-[#DC2626]'
                          }`}
                        >
                          {product.daysSinceLatestNav}天
                        </span>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-[#86868B]">
                  {searchKeyword ? '没有找到匹配的产品' : '暂无产品数据'}
                </div>
              )}
            </>
          )}
        </div>

        {/* 使用说明 */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] mb-3 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-[#0071E3]" />
            📖 使用说明
          </h3>
          <ul className="space-y-2 text-[13px] text-[#86868B]">
            <li className="flex items-start gap-2">
              <span className="text-[#0071E3] mt-0.5">•</span>
              <span><strong>产品筛选</strong>：仅显示15天内有净值更新的产品，确保维护活跃产品</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#0071E3] mt-0.5">•</span>
              <span><strong>单个修改</strong>：直接在表格中下拉选择策略类型，自动保存</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#0071E3] mt-0.5">•</span>
              <span><strong>批量导入</strong>：先导出Excel，修改策略类型后导入，批量更新</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#0071E3] mt-0.5">•</span>
              <span><strong>状态标识</strong>：绿色≤3天，橙色≤7天，红色&gt;7天未更新</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
