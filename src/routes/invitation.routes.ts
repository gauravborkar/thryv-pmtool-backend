import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as invitationService from '../services/invitation.service';
import { logAction } from '../services/audit.service';

const router = Router();

/**
 * @route POST /invitations
 * @desc Create a new user invitation (Admin only)
 * @access Private (Admin)
 */
router.post('/', authenticate, authorize(['ADMIN']), async (req: any, res) => {
  const { email, role_id } = req.body;
  try {
    if (!email || !role_id) {
      return res.status(400).json({ message: 'Email and role_id are required' });
    }

    const invitation = await invitationService.createInvitation(email, role_id);
    
    // Log successful invitation creation
    await logAction({
      userId: req.user.id,
      action: 'USER_INVITATION_SUCCESS',
      entity: 'Invitation',
      entityId: invitation.id,
      details: { email, role_id },
      ipAddress: req.ip,
    });

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
    // Log failed invitation creation
    await logAction({
      userId: req.user.id,
      action: 'USER_INVITATION_FAILURE',
      details: { email, role_id, error: error.message },
      ipAddress: req.ip,
    });

    res.status(500).json({ message: error.message });
  }
});

export default router;
