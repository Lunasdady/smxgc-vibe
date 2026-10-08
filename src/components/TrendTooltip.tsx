'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';

interface TrendTooltipProps {
  productCode: string;
  productName?: string;
  children: React.ReactNode;
}

interface NavDataPoint {
  date: string;
  nav: number;
  cumulativeNav?: number;
}

/**
 * 产品走势浮窗组件
 * 鼠标悬停显示近6个月净值折线图
 * 使用 createPortal 渲染到 body，避免被 overflow 容器裁剪
 */
export default function TrendTooltip({ productCode, productName, children }: TrendTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [navData, setNavData] = useState<NavDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || navData.length > 0) return;

    const fetchTrendData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/product/trend?productCode=${encodeURIComponent(productCode)}&months=6`);
        
        if (!response.ok) {
          throw new Error('获取走势数据失败');
        }

        const data = await response.json();
        
        if (data.success && data.navData) {
          setNavData(data.navData);
        } else {
          throw new Error(data.error || '无数据');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendData();
  }, [visible, productCode, navData.length]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 280;
    
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - 12;
    
    // 边界检查：确保不超出视口
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8;
    }
    if (top < 8) {
      top = rect.bottom + 12; // 如果上方空间不足，显示在下方
    }
    
    setPosition({ top, left });
  }, []);

  const handleMouseEnter = () => {
    updatePosition();
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  const formatXAxis = (date: string) => {
    return dayjs(date).format('MM/DD');
  };

  const formatYAxis = (value: number) => {
    return value.toFixed(4);
  };

  const tooltipContent = (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: position.top, left: position.left }}
    >
      <div className="glass-card rounded-2xl p-4 shadow-2xl border border-[#0000000D] bg-white/95 backdrop-blur-xl" style={{ width: '320px' }}>
        {/* 标题 */}
        <div className="mb-3 pb-2 border-b border-[#0000000D]">
          <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">
            {productName || productCode}
          </div>
          <div className="text-[11px] text-[#86868B] mt-0.5">
            近6个月单位净值走势
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-[13px] text-[#86868B]">加载中...</div>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-[13px] text-[#FF3B30]">{error}</div>
          </div>
        )}

        {/* 图表 */}
        {!loading && !error && navData.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={navData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXAxis}
                  tick={{ fontSize: 11, fill: '#86868B' }}
                  axisLine={{ stroke: '#E5E5E7' }}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 11, fill: '#86868B' }}
                  axisLine={{ stroke: '#E5E5E7' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #E5E5E7',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [value.toFixed(4), '单位净值']}
                  labelFormatter={(label: string) => dayjs(label).format('YYYY-MM-DD')}
                />
                <Line
                  type="monotone"
                  dataKey="nav"
                  stroke="#0071E3"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#0071E3', strokeWidth: 2, fill: '#FFFFFF' }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 底部统计 */}
            <div className="mt-2 pt-2 border-t border-[#0000000D] flex justify-between text-[11px] text-[#86868B]">
              <span>数据点: {navData.length}个</span>
              <span>
                {navData.length > 0 && (
                  <>
                    {navData[0].date} ~ {navData[navData.length - 1].date}
                  </>
                )}
              </span>
            </div>
          </>
        )}

        {/* 无数据 */}
        {!loading && !error && navData.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-[13px] text-[#86868B]">暂无走势数据</div>
          </div>
        )}
      </div>

      {/* 三角形箭头 */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
        <div className="w-3 h-3 bg-white rotate-45 border-r border-b border-[#0000000D]" />
      </div>
    </div>
  );

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && createPortal(tooltipContent, document.body)}
    </div>
  );
}
