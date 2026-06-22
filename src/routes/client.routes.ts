import { Router } from 'express';
import { authenticate, authorize, authorizeSection } from '../middleware/auth.middleware';
import * as clientController from '../controllers/client.controller';

const router = Router();

// Retrieve all clients (role-based dynamic section access)
router.get('/', authenticate, authorizeSection('Clients'), clientController.getClients);

// Retrieve a single client by ID
router.get('/:id', authenticate, authorizeSection('Clients'), clientController.getClientById);

// Create a new client
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), clientController.createClient);

// Update a client profile (ID in URL)
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), clientController.updateClient);

// Archive a client profile (soft-delete, ID in URL)
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), clientController.archiveClient);
router.post('/:id/archive', authenticate, authorize(['ADMIN', 'MANAGER']), clientController.archiveClient);

export default router;
