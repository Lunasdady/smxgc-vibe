import prisma from './db';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

export interface AuthResult {
  userId: number;
  email: string;
  permissions: string[];
  status: string;
}

/**
 * 从请求中解析并验证用户 token，返回最新数据库权限
 * 用于 API 路由中做实时权限校验
 */
export async function verifyRequestAuth(request: Request): Promise<AuthResult | null> {
  try {
    // 1. 从 Authorization header 获取 token
    let token: string | undefined;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. 如果没有 Authorization header，尝试从 Cookie 获取
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/user-token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }
    }

    if (!token) {
      return null;
    }

    // 3. 验证 JWT
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    if (!decoded.userId) {
      return null;
    }

    // 4. 查询数据库获取最新权限（防止 token 中的权限已过期）
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        permissions: true,
        status: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      permissions: JSON.parse(user.permissions || '[]'),
      status: user.status,
    };
  } catch {
    return null;
  }
}

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(auth: AuthResult | null, permission: string): boolean {
  if (!auth) return false;
  if (auth.status !== 'approved') return false;
  return auth.permissions.includes(permission);
}
