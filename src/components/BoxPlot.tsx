'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { StrategyOverview } from '@/lib/types';
import { formatValue } from '@/lib/stats';

interface BoxPlotProps {
  strategy: StrategyOverview;
  onClick: () => void;
  groupName?: string;
  metric?: string;
  metricName?: string;
  isPercentage?: boolean;
}

interface TooltipData {
  clientX: number;
  clientY: number;
  visible: boolean;
}

export default function BoxPlot({ strategy, onClick, groupName, metric, metricName, isPercentage = true }: BoxPlotProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData>({ clientX: 0, clientY: 0, visible: false });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const { strategyType, strategyName, count, min, q25, median, q75, max } = strategy;

  if (count === 0) {
    return (
      <div className="glass-card rounded-3xl min-h-[180px] flex items-center justify-center p-6">
        <p className="text-[#86868B] text-[15px]">暂无数据</p>
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
  const xMedian = mapX(median);
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

  // Touch events for mobile - show on touch, hide on release
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    e.stopPropagation();
    const touch = e.touches[0];
    setTooltip({
      clientX: touch.clientX,
      clientY: touch.clientY,
      visible: true,
    });
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    e.stopPropagation();
    setTooltip({ clientX: 0, clientY: 0, visible: false });
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isTouchDevice) return;
    const touch = e.touches[0];
    setTooltip({
      clientX: touch.clientX,
      clientY: touch.clientY,
      visible: true,
    });
  };

  return (
    <div
      ref={cardRef}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#0071E3]" />
          <h3 className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">{strategyName}</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-[#00000006] text-[12px] text-[#86868B] font-medium">
          {count} 只
        </span>
      </div>

      {/* Box Plot SVG */}
      <svg
        ref={svgRef}
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <defs>
          <linearGradient id="appleBoxGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0071E3" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#0071E3" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0071E3" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="appleWhiskerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1D1D1F" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1D1D1F" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Center line */}
        <line
          x1={padding}
          y1={yCenter}
          x2={chartWidth - padding}
          y2={yCenter}
          stroke="#00000020"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Whisker - left */}
        {xMin !== null && xQ25 !== null && (
          <>
            <line
              x1={xMin}
              y1={yCenter}
              x2={xQ25}
              y2={yCenter}
              stroke="url(#appleWhiskerGradient)"
              strokeWidth="2"
            />
            <line
              x1={xMin}
              y1={yCenter - whiskerHeight / 2}
              x2={xMin}
              y2={yCenter + whiskerHeight / 2}
              stroke="#1D1D1F"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
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
              stroke="url(#appleWhiskerGradient)"
              strokeWidth="2"
            />
            <line
              x1={xMax}
              y1={yCenter - whiskerHeight / 2}
              x2={xMax}
              y2={yCenter + whiskerHeight / 2}
              stroke="#1D1D1F"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
          </>
        )}

        {/* Box */}
        {xQ25 !== null && xQ75 !== null && (
          <>
            <rect
              x={xQ25}
              y={yCenter - boxHeight / 2}
              width={Math.max(xQ75 - xQ25, 2)}
              height={boxHeight}
              fill="url(#appleBoxGradient)"
              rx="4"
              stroke="#0071E3"
              strokeWidth="1.5"
              className="transition-all duration-300 ease-apple group-hover:stroke-[#0077ED]"
            />
          </>
        )}

        {/* Median dot */}
        {xMedian !== null && (
          <circle
            cx={xMedian}
            cy={yCenter}
            r="4"
            fill="#FFFFFF"
            stroke="#0071E3"
            strokeWidth="2"
            className="transition-all duration-300"
          />
        )}
      </svg>

      {/* Footer removed - duplicate detail button */}

      {/* Tooltip via Portal */}
      {tooltip.visible && createPortal(
        <BoxPlotTooltip
          strategyName={strategyName}
          metricName={metricName}
          min={min}
          q25={q25}
          median={median}
          q75={q75}
          max={max}
          clientX={tooltip.clientX}
          clientY={tooltip.clientY}
          isPercentage={isPercentage}
        />,
        document.body
      )}
    </div>
  );
}

function BoxPlotTooltip({
  strategyName,
  metricName,
  min,
  q25,
  median,
  q75,
  max,
  clientX,
  clientY,
  isPercentage = true,
}: {
  strategyName: string;
  metricName?: string;
  min: number | null;
  q25: number | null;
  median: number | null;
  q75: number | null;
  max: number | null;
  clientX: number;
  clientY: number;
  isPercentage?: boolean;
}) {
  const tooltipWidth = 170;
  const tooltipHeight = 180;

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
      <div className="glass-card rounded-2xl p-4 shadow-apple-lg w-[170px] backdrop-blur-xl bg-[#FFFFFF]/90">
        <div className="text-[13px] font-semibold text-[#1D1D1F] mb-1 pb-2 border-b border-[#0000000D]">
          {metricName || strategyName}
        </div>
        <div className="space-y-2">
          <TooltipRow label="最大值" value={max} isPercentage={isPercentage} />
          <TooltipRow label="25分位" value={q75} isPercentage={isPercentage} />
          <TooltipRow label="中位数" value={median} isMean isPercentage={isPercentage} />
          <TooltipRow label="75分位" value={q25} isPercentage={isPercentage} />
          <TooltipRow label="最小值" value={min} isPercentage={isPercentage} />
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  isMean,
  isPercentage = true,
}: {
  label: string;
  value: number | null;
  isMean?: boolean;
  isPercentage?: boolean;
}) {
  const colorClass =
    value === null
      ? 'text-[#A1A1A6]'
      : value >= 0
      ? 'text-[#DC2626]'
      : 'text-[#16A34A]';

  return (
    <div className="flex justify-between items-center text-[13px]">
      <span className="text-[#86868B]">{label}</span>
      <span className={`font-semibold ${colorClass} ${isMean ? 'font-bold' : ''}`}>
        {formatValue(value, isPercentage)}
      </span>
    </div>
  );
}
