import { Router } from 'express';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);


export default router;
