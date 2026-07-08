'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * 数字滚动动画 Hook
 * 当元素进入视口时，数字从 0 平滑滚动到目标值
 * 
 * @param target - 目标数值
 * @param duration - 动画持续时间（毫秒）
 * @param decimals - 小数位数
 * @param startOnView - 是否在进入视口时才启动
 * @param trigger - 外部触发条件（当 startOnView 时，此条件为 true 也会启动）
 * @returns current - 当前显示的数值
 */
export function useCountUp(
  target: number,
  duration = 1500,
  decimals = 2,
  startOnView = true,
  trigger?: boolean
) {
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!startOnView) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView]);

  // 外部 trigger 触发时启动动画
  useEffect(() => {
    if (trigger && !started) {
      setStarted(true);
    }
  }, [trigger, started]);

  useEffect(() => {
    if (!started) return;

    const startTime = performance.now();
    const startValue = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutExpo curve
      const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const value = startValue + (target - startValue) * easedProgress;
      setCurrent(parseFloat(value.toFixed(decimals)));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [started, target, duration, decimals]);

  return { current, ref };
}
