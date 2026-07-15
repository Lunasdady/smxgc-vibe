'use client';

import { useEffect } from 'react';

/**
 * 页面访问日志上报 Hook
 * 在页面加载时自动上报访问记录
 */
export function useAccessLog(page: string) {
  useEffect(() => {
    // 使用 sendBeacon 或 fetch 上报，确保页面卸载时也能发送
    const logAccess = () => {
      const data = JSON.stringify({ page });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/log/access', new Blob([data], { type: 'application/json' }));
      } else {
        fetch('/api/log/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
        }).catch(() => {
          // 静默忽略上报失败
        });
      }
    };

    // 延迟上报，避免页面刷新时大量请求
    const timer = setTimeout(logAccess, 500);
    return () => clearTimeout(timer);
  }, [page]);
}
