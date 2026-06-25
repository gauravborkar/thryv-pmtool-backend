import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getIO } from '../services/socket.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { storage } from '../lib/storage';

const prisma = new PrismaClient();

export async function getChannels(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Find channels where user is a member
    const channels = await prisma.chatChannel.findMany({
      where: {
        is_deleted: false,
        members: {
          some: {
            user_id: userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: {
        updated_at: 'desc'
      }
    });

    const channelsWithUnread = await Promise.all(
      channels.map(async (c) => {
        const member = c.members.find(m => m.user_id === userId);
        const lastReadAt = member?.last_read_at || new Date(0);
        
        const unread_count = await prisma.chatMessage.count({
          where: {
            channel_id: c.id,
            created_at: { gt: lastReadAt },
            sender_id: { not: userId }
          }
        });
        
        return { ...c, unread_count };
      })
    );

    return res.json(channelsWithUnread);
  } catch (error) {
    console.error('Error fetching channels:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function markChannelRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { id: channelId } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    await prisma.chatChannelMember.update({
      where: {
        channel_id_user_id: {
          channel_id: Number(channelId),
          user_id: userId
        }
      },
      data: {
        last_read_at: new Date()
      }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking channel read:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createChannel(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [];
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, type, memberIds } = req.body; // memberIds: number[]
    const channelType = type || 'GROUP';

    const hasManagerOrAdminRole = userRoles.some(r => ['ADMIN', 'MANAGER'].includes(r));
    if (channelType !== 'DIRECT' && !hasManagerOrAdminRole) {
      return res.status(403).json({ message: 'Only Admins and Managers can create group channels' });
    }

    if (channelType === 'DIRECT') {
      // Find if direct channel already exists
      const existing = await prisma.chatChannel.findFirst({
        where: {
          type: 'DIRECT',
          is_deleted: false,
          AND: memberIds.map((id: number) => ({
            members: { some: { user_id: id } }
          }))
        },
        include: {
          members: { include: { user: { select: { id: true, name: true } } } }
        }
      });
      if (existing) return res.status(200).json(existing);
    }

    // Create channel
    const channel = await prisma.chatChannel.create({
      data: {
        name,
        type: channelType,
        created_by_id: userId,
        members: {
          create: memberIds.map((id: number) => ({
            user_id: id
          }))
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    return res.status(201).json(channel);
  } catch (error) {
    console.error('Error creating channel:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const channelId = parseInt(req.params.id);
    const messages = await prisma.chatMessage.findMany({
      where: { channel_id: channelId },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    return res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const channelId = parseInt(req.params.id);
    const { content, type, metadata } = req.body;

    const message = await prisma.chatMessage.create({
      data: {
        channel_id: channelId,
        sender_id: userId,
        content,
        type: type || 'TEXT',
        metadata: metadata || null
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      }
    });

    // Update channel updated_at
    await prisma.chatChannel.update({
      where: { id: channelId },
      data: { updated_at: new Date() }
    });

    // Broadcast via socket
    const io = getIO();
    io.to(`channel_${channelId}`).emit('new_message', message);

    return res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteMessage(req: AuthRequest, res: Response) {
  try {
    const channelId = parseInt(req.params.id);
    const messageId = parseInt(req.params.messageId);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender_id !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    await prisma.chatMessage.delete({
      where: { id: messageId }
    });

    // Delete from cloud storage if it's a file
    if (message.type === 'FILE' && message.metadata && typeof message.metadata === 'object' && 'url' in message.metadata) {
      try {
        await storage.deleteFile(message.metadata.url as string);
      } catch (err) {
        console.error('Failed to delete file from storage:', err);
      }
    }

    // Notify socket clients
    const io = getIO();
    io.to(`channel_${channelId}`).emit('message_deleted', messageId);

    return res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteChannel(req: AuthRequest, res: Response) {
  try {
    const channelId = parseInt(req.params.id);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Ensure the channel exists
    const channel = await prisma.chatChannel.findFirst({
      where: {
        id: channelId,
        is_deleted: false
      }
    });

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Optionally you could enforce that only the creator or admin can delete it here
    // but the route will use the authorize middleware anyway

    await prisma.chatChannel.update({
      where: { id: channelId },
      data: { is_deleted: true }
    });

    return res.status(200).json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
