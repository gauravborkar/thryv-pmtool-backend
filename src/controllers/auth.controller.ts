import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    
    res.status(200).json({
      message: 'Login successful',
      data: result,
    });
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role_id, inviteToken } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password and name are required' });
    }

    const result = await authService.register({ email, password, name, role_id, inviteToken });

    res.status(201).json({
      message: 'User registered successfully',
      data: result,
    });
  } catch (error: any) {
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
