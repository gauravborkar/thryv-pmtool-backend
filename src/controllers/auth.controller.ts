import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { logAction } from '../services/audit.service';
import { sendPasswordResetEmail } from '../services/email.service';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    
    // Log successful login
    await logAction({
      userId: result.user.id,
      action: 'USER_LOGIN_SUCCESS',
      entity: 'User',
      entityId: result.user.id,
      details: { email },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Login successful',
      data: result,
    });
  } catch (error: any) {
    // Log failed login
    await logAction({
      action: 'USER_LOGIN_FAILURE',
      details: { email, error: error.message },
      ipAddress: req.ip,
    });

    res.status(401).json({ message: error.message });
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, name, role_id, inviteToken } = req.body;
  try {
    console.log('Register request body:', req.body);

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password and name are required' });
    }

    const result = await authService.register({ email, password, name, role_id, inviteToken });

    // Log successful registration
    await logAction({
      userId: result.user.id,
      action: 'USER_REGISTER_SUCCESS',
      entity: 'User',
      entityId: result.user.id,
      details: { email, role_id },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'User registered successfully',
      data: result,
    });
  } catch (error: any) {
    // Log failed registration
    await logAction({
      action: 'USER_REGISTER_FAILURE',
      details: { email, error: error.message },
      ipAddress: req.ip,
    });

    res.status(400).json({ message: error.message });
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const tokens = await authService.refresh(refreshToken);

    res.status(200).json({
      message: 'Token refreshed',
      data: tokens,
    });
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const result = await authService.forgotPassword(email);

    // Send the email with the reset token
    try {
      await sendPasswordResetEmail(email, result.token);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }

    // Log successful forgot password request
    await logAction({
      userId: result.userId,
      action: 'PASSWORD_RESET_REQUEST_SUCCESS',
      entity: 'User',
      entityId: result.userId,
      details: { email },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Password reset link / token generated successfully',
      data: result,
    });
  } catch (error: any) {
    // Log failed forgot password request
    await logAction({
      action: 'PASSWORD_RESET_REQUEST_FAILURE',
      details: { email, error: error.message },
      ipAddress: req.ip,
    });

    res.status(400).json({ message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  const { token, password } = req.body;
  try {
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const result = await authService.resetPassword(token, password);

    // Log successful password reset
    await logAction({
      userId: result.id,
      action: 'PASSWORD_RESET_SUCCESS',
      entity: 'User',
      entityId: result.id,
      details: { email: result.email },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Password reset successful',
      data: result,
    });
  } catch (error: any) {
    // Log failed password reset
    await logAction({
      action: 'PASSWORD_RESET_FAILURE',
      details: { error: error.message },
      ipAddress: req.ip,
    });

    res.status(400).json({ message: error.message });
  }
};


