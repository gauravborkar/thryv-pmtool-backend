import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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

import * as invitationService from './invitation.service';

export const register = async (userData: any) => {
  const { email, password, name, inviteToken } = userData;

  let assignedRoleId = 3; // Default role (e.g. CLIENT or user)
  if (inviteToken) {
    // Validate the invitation
    const invitation = await invitationService.validateInvitation(inviteToken);
    
    if (invitation.email !== email) {
      throw new Error('This invitation was issued for a different email address');
    }
    assignedRoleId = invitation.role_id;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPasswordStr = await hashPassword(password);
  const sessionToken = crypto.randomUUID();

  // Create user with the role pre-assigned in the invitation or default role
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPasswordStr,
      name,
      role_id: assignedRoleId,
      current_session_token: sessionToken,
    },
    include: { role: true },
  });

  if (inviteToken) {
    // Mark invitation as used
    await invitationService.markInvitationAsUsed(inviteToken);
  }

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

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('User with this email does not exist');
  }

  // Generate unique 32-byte secure reset token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

  await prisma.user.update({
    where: { email },
    data: {
      reset_password_token: token,
      reset_password_expires: expiresAt,
    },
  });

  return { token, email, userId: user.id };
};

export const resetPassword = async (token: string, passwordStr: string) => {
  const user = await prisma.user.findFirst({
    where: {
      reset_password_token: token,
      reset_password_expires: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  const hashedPasswordStr = await hashPassword(passwordStr);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPasswordStr,
      reset_password_token: null,
      reset_password_expires: null,
    },
  });

  return { id: user.id, email: user.email };
};

