import jwt from 'jsonwebtoken';

interface TokenPayload extends jwt.JwtPayload {
  userId: string;
  role: string;
  version?: number;
  scope?: 'verification';
}

export const generateToken = (userId: string, role: string, version = 0): string => {
  return jwt.sign({ userId, role, version }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};

export const generateVerificationToken = (userId: string, version = 0): string =>
  jwt.sign({ userId, role: 'provider', version, scope: 'verification' }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
