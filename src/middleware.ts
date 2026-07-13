import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 只拦截策略详情页
  if (pathname.startsWith('/strategy/')) {
    const userToken = request.cookies.get('user-token')?.value;

    // 未登录，重定向到登录页
    if (!userToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 校验 token 并检查权限
    try {
      const { payload } = await jwtVerify(userToken, SECRET_KEY);
      const permissions = (payload.permissions as string[]) || [];

      // 没有策略详情权限
      if (!permissions.includes('strategy-detail')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set('error', 'no-permission');
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      // token 无效
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/strategy/:path*'],
};
