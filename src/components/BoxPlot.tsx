'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { StrategyOverview, STRATEGY_NAME_MAP } from '@/lib/types';
import { formatPercentage } from '@/lib/stats';

interface BoxPlotProps {
  strategy: StrategyOverview;
  onClick: () => void;
  groupName?: string;
}

interface TooltipData {
  clientX: number;
  clientY: number;
  visible: boolean;
}

export default function BoxPlot({ strategy, onClick, groupName }: BoxPlotProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData>({ clientX: 0, clientY: 0, visible: false });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const { strategyType, strategyName, count, min, q25, mean, q75, max } = strategy;

  if (count === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 min-h-[180px] flex items-center justify-center">
        <p className="text-dark-textDim text-sm">暂无数据</p>
      </div>
    );
  }

  const chartWidth = 280;
  const chartHeight = 70;
  const padding = 20;

  const dataMin = min ?? 0;
  const dataMax = max ?? 0;
  const range = dataMax - dataMin || 1;

  const mapX = (value: number | null) => {
    if (value === null) return null;
    return padding + ((value - dataMin) / range) * (chartWidth - padding * 2);
  };

  const yCenter = chartHeight / 2;
  const boxHeight = 28;
  const whiskerHeight = 14;

  const xMin = mapX(dataMin);
  const xQ25 = mapX(q25);
  const xMean = mapX(mean);
  const xQ75 = mapX(q75);
  const xMax = mapX(dataMax);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isTouchDevice) return;
    setTooltip({
      clientX: e.clientX,
      clientY: e.clientY,
      visible: true,
    });
  };

  const handleMouseLeave = () => {
    if (isTouchDevice) return;
    setTooltip({ clientX: 0, clientY: 0, visible: false });
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    e.stopPropagation();
    setTooltip(prev => ({
      clientX: prev.clientX || e.clientX,
      clientY: prev.clientY || e.clientY,
      visible: !prev.visible,
    }));
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // On touch devices, if tooltip is visible, clicking outside SVG should hide it
    if (isTouchDevice && tooltip.visible) {
      const target = e.target as HTMLElement;
      if (!target.closest('svg')) {
        setTooltip({ clientX: 0, clientY: 0, visible: false });
        return;
      }
    }
    onClick();
  };

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/strategy/${strategyType}`);
  };

  // Determine if values are positive or negative for coloring
  const valColor = (v: number | null) => {
    if (v === null) return 'text-dark-textMuted';
    return v >= 0 ? 'text-positive' : 'text-negative';
  };

  return (
    <div
      ref={cardRef}
      className="bg-dark-card border border-dark-border rounded-xl p-4 sm:p-5 hover:border-cyan-400/40 hover:bg-dark-cardHover transition-all duration-300 group cursor-pointer card-hover relative overflow-hidden"
      onClick={handleCardClick}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/0 to-cyan-400/0 group-hover:from-cyan-400/[0.02] group-hover:to-transparent transition-all duration-300 pointer-events-none" />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
          <h3 className="text-sm font-semibold text-dark-text tracking-wide">{strategyName}</h3>
        </div>
        <span className="text-xs text-dark-textDim font-mono">{count} 只产品</span>
      </div>

      {/* Box Plot SVG */}
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-hidden relative z-10"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleSvgClick}
      >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="boxGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="whiskerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#64748B" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#64748B" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Background grid line */}
          <line
            x1={padding}
            y1={yCenter}
            x2={chartWidth - padding}
            y2={yCenter}
            stroke="#2A3447"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Whisker - left */}
          {xMin !== null && xQ25 !== null && (
            <>
              <line
                x1={xMin}
                y1={yCenter}
                x2={xQ25}
                y2={yCenter}
                stroke="url(#whiskerGradient)"
                strokeWidth="1.5"
              />
              <line
                x1={xMin}
                y1={yCenter - whiskerHeight / 2}
                x2={xMin}
                y2={yCenter + whiskerHeight / 2}
                stroke="#64748B"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Whisker - right */}
          {xMax !== null && xQ75 !== null && (
            <>
              <line
                x1={xQ75}
                y1={yCenter}
                x2={xMax}
                y2={yCenter}
                stroke="url(#whiskerGradient)"
                strokeWidth="1.5"
              />
              <line
                x1={xMax}
                y1={yCenter - whiskerHeight / 2}
                x2={xMax}
                y2={yCenter + whiskerHeight / 2}
                stroke="#64748B"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Box - enhanced with glow effect */}
          {xQ25 !== null && xQ75 !== null && (
            <>
              {/* Glow layer */}
              <rect
                x={xQ25}
                y={yCenter - boxHeight / 2}
                width={Math.max(xQ75 - xQ25, 2)}
                height={boxHeight}
                fill="rgba(34, 211, 238, 0.08)"
                rx="2"
                className="blur-sm"
              />
              {/* Main box */}
              <rect
                x={xQ25}
                y={yCenter - boxHeight / 2}
                width={Math.max(xQ75 - xQ25, 2)}
                height={boxHeight}
                fill="rgba(34, 211, 238, 0.15)"
                stroke="url(#boxGradient)"
                strokeWidth="1.5"
                rx="2"
                className="transition-all duration-200"
              />
            </>
          )}

          {/* Median line */}
          {xQ25 !== null && xQ75 !== null && (
            <line
              x1={(xQ25 + xQ75) / 2}
              y1={yCenter - boxHeight / 2}
              x2={(xQ25 + xQ75) / 2}
              y2={yCenter + boxHeight / 2}
              stroke="#22d3ee"
              strokeWidth="2"
            />
          )}

          {/* Mean dot */}
          {xMean !== null && (
            <circle
              cx={xMean}
              cy={yCenter}
              r="5"
              fill="#f87171"
              stroke="#0B0F19"
              strokeWidth="2"
              className="transition-all duration-200"
            />
          )}
        </svg>

      {/* Tooltip via Portal */}
      {tooltip.visible && createPortal(
        <BoxPlotTooltip
          strategyName={strategyName}
          min={min}
          q25={q25}
          mean={mean}
          q75={q75}
          max={max}
          clientX={tooltip.clientX}
          clientY={tooltip.clientY}
        />,
        document.body
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 text-xs text-dark-textDim">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
            中位数
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            均值
          </span>
        </div>
        <button
          type="button"
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-all duration-200 font-medium opacity-0 group-hover:opacity-100 flex items-center gap-1 hover:gap-2"
          onClick={handleDetailClick}
        >
          <span>查看明细</span>
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </div>
  );
}

function BoxPlotTooltip({
  strategyName,
  min,
  q25,
  mean,
  q75,
  max,
  clientX,
  clientY,
}: {
  strategyName: string;
  min: number | null;
  q25: number | null;
  mean: number | null;
  q75: number | null;
  max: number | null;
  clientX: number;
  clientY: number;
}) {
  const tooltipWidth = 170;
  const tooltipHeight = 160;

  let left = clientX + 16;
  let top = clientY - tooltipHeight / 2;

  // Prevent overflow beyond viewport
  if (left + tooltipWidth > window.innerWidth - 8) {
    left = clientX - tooltipWidth - 16;
  }
  if (top + tooltipHeight > window.innerHeight - 8) {
    top = window.innerHeight - tooltipHeight - 8;
  }
  if (top < 8) {
    top = 8;
  }
  if (left < 8) {
    left = 8;
  }

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}
    >
      <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md border border-cyan-400/30 rounded-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-[170px]">
        <div className="text-xs font-semibold text-cyan-300 mb-2 pb-2 border-b border-slate-600/50 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {strategyName}
        </div>
        <div className="space-y-1.5">
          <TooltipRow label="最大值" value={max} />
          <TooltipRow label="75分位" value={q75} />
          <TooltipRow label="平均数" value={mean} isMean />
          <TooltipRow label="25分位" value={q25} />
          <TooltipRow label="最小值" value={min} />
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  isMean,
  showIndicator,
}: {
  label: string;
  value: number | null;
  isMean?: boolean;
  showIndicator?: boolean;
}) {
  const colorClass =
    value === null
      ? 'text-slate-500'
      : value >= 0
      ? 'text-red-400'
      : 'text-green-400';

  return (
    <div className="flex justify-between items-center text-xs group">
      <span className="text-slate-400 flex items-center gap-2">
        {showIndicator && (
          <span className={`w-1 h-1 rounded-full ${value === null ? 'bg-slate-600' : value >= 0 ? 'bg-red-400' : 'bg-green-400'}`} />
        )}
        {label}
      </span>
      <span className={`font-mono font-medium ${colorClass} ${isMean ? 'font-bold tracking-wide' : ''}`}>
        {formatPercentage(value)}
      </span>
    </div>
  );
}
