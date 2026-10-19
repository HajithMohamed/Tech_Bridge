import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  role: string;
  version?: number;
}

export const generateToken = (userId: string, role: string, version = 0): string => {
  return jwt.sign({ userId, role, version }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};
