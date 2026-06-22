import { Router } from 'express';
import { getChannels, createChannel, getMessages, sendMessage, deleteChannel, markChannelRead } from '../controllers/chat.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Everyone can view their channels and messages
router.get('/channels', getChannels);
router.get('/channels/:id/messages', getMessages);
router.post('/channels/:id/messages', sendMessage);
router.post('/channels/:id/read', markChannelRead);

// Users can create DIRECT channels, ADMIN/MANAGER can create GROUP channels
router.post('/channels', createChannel);
router.delete('/channels/:id', authorize(['ADMIN', 'MANAGER']), deleteChannel);

export default router;
