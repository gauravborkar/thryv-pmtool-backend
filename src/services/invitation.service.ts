import crypto from 'crypto';
import prisma from '../lib/prisma';

/**
 * Service to handle user invitations
 */
export const createInvitation = async (email: string, role_id: number) => {
  // Check if invitation already exists for this email
  const existingInvite = await prisma.invitation.findUnique({
    where: { email },
  });

  if (existingInvite && !existingInvite.is_used && existingInvite.expires_at > new Date()) {
    return existingInvite;
  }

  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set expiry to 7 days from now
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 7);

  // If there was an old expired/used invite, delete it or update it
  if (existingInvite) {
    return await prisma.invitation.update({
      where: { email },
      data: {
        token,
        role_id,
        expires_at,
        is_used: false,
      },
    });
  }

  return await prisma.invitation.create({
    data: {
      email,
      token,
      role_id,
      expires_at,
    },
  });
};

export const validateInvitation = async (token: string) => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { role: true },
  });

  if (!invitation) {
    throw new Error('Invalid invitation token');
  }

  if (invitation.is_used) {
    throw new Error('This invitation has already been used');
  }

  if (invitation.expires_at < new Date()) {
    throw new Error('This invitation has expired');
  }

  return invitation;
};

export const markInvitationAsUsed = async (token: string) => {
  return await prisma.invitation.update({
    where: { token },
    data: { is_used: true },
  });
};
