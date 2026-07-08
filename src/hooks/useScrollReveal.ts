'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 滚动揭示动画 Hook
 * 当元素进入视口时，添加 revealed class 触发 fade-in-up 动画
 * 
 * @param options IntersectionObserver 配置
 * @returns [ref, revealed, forceReveal] - ref 附加到目标元素，revealed 表示是否已揭示，forceReveal 强制显示元素
 */
export function useScrollReveal(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;

    const checkAndReveal = () => {
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        setRevealed(true);
        // 清理 observer
        observerRef.current?.disconnect();
        resizeObserverRef.current?.disconnect();
        return true;
      }
      return false;
    };

    // 使用 ResizeObserver 监听元素尺寸变化
    resizeObserverRef.current = new ResizeObserver(() => {
      // 延迟一帧确保布局完成
      requestAnimationFrame(() => {
        checkAndReveal();
      });
    });

    resizeObserverRef.current.observe(el);

    // 同时使用 IntersectionObserver 处理滚动场景
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          checkAndReveal();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
        ...options,
      }
    );

    observerRef.current.observe(el);

    // 初始检查 - 延迟确保 DOM 完全渲染
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        checkAndReveal();
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      observerRef.current?.disconnect();
      resizeObserverRef.current?.disconnect();
    };
  }, [revealed, options]);

  // 强制显示元素的函数
  const forceReveal = () => {
    setRevealed(true);
    observerRef.current?.disconnect();
    resizeObserverRef.current?.disconnect();
  };

  return { ref, revealed, forceReveal };
}
