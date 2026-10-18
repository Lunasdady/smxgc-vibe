'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Download, Upload, Search, Trash2, Edit2, X } from 'lucide-react';

interface NavData {
  id: number;
  productCode: string;
  productName: string;
  navDate: string;
  unitNav: number;
  cumulativeNav: number | null;
  source: string;
  confidence: string;
}

export default function ManualNavTab() {
  const [data, setData] = useState<NavData[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 50;

  // 搜索
  const [searchProductCode, setSearchProductCode] = useState('');
  const [searchProductName, setSearchProductName] = useState('');

  // 编辑/添加弹窗
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<NavData | null>(null);
  const [formData, setFormData] = useState({
    productCode: '',
    productName: '',
    navDate: '',
    unitNav: '',
    cumulativeNav: '',
  });

  // 导入
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [page, searchProductCode, searchProductName]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        productCode: searchProductCode,
        productName: searchProductName,
      });

      const response = await fetch(`/api/admin/manual-nav?${params}`);
      const result = await response.json();

      if (response.ok) {
        setData(result.data || []);
        setTotal(result.total || 0);
        setTotalPages(result.totalPages || 0);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      productCode: '',
      productName: '',
      navDate: '',
      unitNav: '',
      cumulativeNav: '',
    });
    setShowModal(true);
  };

  const handleEdit = (item: NavData) => {
    setEditingItem(item);
    setFormData({
      productCode: item.productCode,
      productName: item.productName,
      navDate: new Date(item.navDate).toISOString().split('T')[0],
      unitNav: String(item.unitNav),
      cumulativeNav: item.cumulativeNav ? String(item.cumulativeNav) : '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
      const response = await fetch(`/api/admin/manual-nav?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
        alert('删除成功');
      } else {
        const data = await response.json();
        alert(`删除失败: ${data.error}`);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!formData.productCode || !formData.productName || !formData.navDate || !formData.unitNav) {
      alert('请填写必填字段');
      return;
    }

    try {
      const url = editingItem ? '/api/admin/manual-nav' : '/api/admin/manual-nav';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem?.id,
          ...formData,
          unitNav: parseFloat(formData.unitNav),
          cumulativeNav: formData.cumulativeNav ? parseFloat(formData.cumulativeNav) : null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setShowModal(false);
        fetchData();
        alert(editingItem ? '更新成功' : '添加成功');
      } else {
        alert(`操作失败: ${result.error}`);
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('操作失败');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/manual-nav/excel');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manual_nav_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/manual-nav/excel', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message);
        fetchData();
      } else {
        alert(`导入失败: ${result.error}`);
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/manual-nav/excel/template');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'manual_nav_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('下载模板失败:', error);
      alert('下载模板失败');
    }
  };

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex gap-2 items-center">
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#0071E3] text-white rounded-lg hover:bg-[#0077ED] transition-colors"
        >
          <Plus size={16} />
          <span>添加数据</span>
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#0000000D] rounded-lg hover:bg-[#E8E8ED] transition-colors"
        >
          <Download size={16} />
          <span>导出Excel</span>
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#0000000D] rounded-lg hover:bg-[#E8E8ED] transition-colors"
        >
          <Download size={16} />
          <span>导入Excel模板</span>
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F7] text-[#1D1D1F] border border-[#0000000D] rounded-lg hover:bg-[#E8E8ED] transition-colors cursor-pointer">
          <Upload size={16} />
          <span>导入Excel</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
            disabled={importing}
          />
        </label>

        {importing && <span className="text-[#86868B]">导入中...</span>}
      </div>

      {/* 搜索栏 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜索产品代码"
            value={searchProductCode}
            onChange={(e) => {
              setSearchProductCode(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜索产品名称"
            value={searchProductName}
            onChange={(e) => {
              setSearchProductName(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
          />
        </div>
        <button
          onClick={() => {
            setSearchProductCode('');
            setSearchProductName('');
            setPage(1);
          }}
          className="px-4 py-2 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
        >
          清空
        </button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl border border-[#0000000D] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#86868B]">加载中...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-[#86868B]">暂无数据</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-[#F5F5F7]">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86868B]">产品代码</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86868B]">产品名称</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86868B]">净值日期</th>
                  <th className="px-4 py-3 text-right text-[13px] font-medium text-[#86868B]">单位净值</th>
                  <th className="px-4 py-3 text-right text-[13px] font-medium text-[#86868B]">累计净值</th>
                  <th className="px-4 py-3 text-center text-[13px] font-medium text-[#86868B]">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-t border-[#0000000D] hover:bg-[#F5F5F7]/50">
                    <td className="px-4 py-3 text-[14px] font-mono text-[#0071E3]">{item.productCode}</td>
                    <td className="px-4 py-3 text-[14px] text-[#1D1D1F]">{item.productName}</td>
                    <td className="px-4 py-3 text-[14px] text-[#1D1D1F]">
                      {new Date(item.navDate).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 text-[14px] text-right font-medium text-[#1D1D1F]">
                      {item.unitNav?.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-[14px] text-right text-[#86868B]">
                      {item.cumulativeNav?.toFixed(4) || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1 text-[#0071E3] hover:bg-[#0071E3]/10 rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-4 py-3 bg-[#F5F5F7] border-t border-[#0000000D]">
                <span className="text-[13px] text-[#86868B]">
                  共 {total} 条记录，第 {page} 页/共 {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-[13px] border border-[#0000000D] rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-[13px] border border-[#0000000D] rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[17px] font-semibold text-[#1D1D1F]">
                {editingItem ? '编辑净值数据' : '添加净值数据'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">
                  产品代码 <span className="text-[#FF3B30]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.productCode}
                  onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                  className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  placeholder="例如: SQU707"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">
                  产品名称 <span className="text-[#FF3B30]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                  placeholder="例如: 展弘多策略10号私募证券投资基金"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">
                  净值日期 <span className="text-[#FF3B30]">*</span>
                </label>
                <input
                  type="date"
                  value={formData.navDate}
                  onChange={(e) => setFormData({ ...formData, navDate: e.target.value })}
                  className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">
                    单位净值 <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.unitNav}
                    onChange={(e) => setFormData({ ...formData, unitNav: e.target.value })}
                    className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                    placeholder="1.0000"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">累计净值</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.cumulativeNav}
                    onChange={(e) => setFormData({ ...formData, cumulativeNav: e.target.value })}
                    className="w-full px-3 py-2 border border-[#0000000D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
                    placeholder="1.0000"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-[#0000000D] rounded-lg hover:bg-[#F5F5F7] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-[#0071E3] text-white rounded-lg hover:bg-[#0077ED] transition-colors"
              >
                {editingItem ? '更新' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
