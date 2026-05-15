import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as invitationService from '../services/invitation.service';

const router = Router();

/**
 * @route POST /invitations
 * @desc Create a new user invitation (Admin only)
 * @access Private (Admin)
 */
router.post('/', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { email, role_id } = req.body;

    if (!email || !role_id) {
      return res.status(400).json({ message: 'Email and role_id are required' });
    }

    const invitation = await invitationService.createInvitation(email, role_id);
    
    // In a real app, you would send an email here.
    res.status(201).json({ 
      message: 'Invitation created successfully',
      data: {
        email: invitation.email,
        token: invitation.token,
        expires_at: invitation.expires_at
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
