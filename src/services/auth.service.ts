import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateTokens = (user: any) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role.name,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return { accessToken, refreshToken };
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.is_active) {
    throw new Error('Invalid credentials or account disabled');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  const tokens = generateTokens(user);

  // Exclude password from user object
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, tokens };
};

export const register = async (userData: any) => {
  const { email, password, name, role_id } = userData;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPasswordStr = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPasswordStr,
      name,
      role_id: role_id || 2, // Default to MANAGER if not provided
    },
    include: { role: true },
  });

  const tokens = generateTokens(user);
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, tokens };
};

export const refresh = async (refreshToken: string) => {
  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      throw new Error('User not found or inactive');
    }

    const tokens = generateTokens(user);
    return tokens;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};
