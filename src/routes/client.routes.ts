import { Router } from 'express';
import { authenticate, authorize, authorizeSection } from '../middleware/auth.middleware';
import * as clientController from '../controllers/client.controller';
import * as clientAddOnController from '../controllers/client-addon.controller';

const router = Router();

// Retrieve all clients (role-based dynamic section access)
router.get('/', authenticate, clientController.getClients);

// Retrieve a single client by ID
router.get('/:id', authenticate, authorizeSection('Clients'), clientController.getClientById);

// Create a new client
router.post('/', authenticate, authorize([1, 2]), clientController.createClient);

// Send quotation email
router.post('/send-quotation', authenticate, clientController.sendQuotationEmail);

// Update a client profile (ID in URL)
router.put('/:id', authenticate, authorize([1, 2]), clientController.updateClient);

// Archive a client profile (soft-delete, ID in URL)
router.delete('/:id', authenticate, authorize([1, 2]), clientController.archiveClient);
router.post('/:id/archive', authenticate, authorize([1, 2]), clientController.archiveClient);

// Client Add-On routes
router.get('/:clientId/addons', authenticate, authorizeSection('Clients'), clientAddOnController.getClientAddOns);
router.post('/:clientId/addons', authenticate, authorize([1, 2]), clientAddOnController.createClientAddOn);
router.put('/:clientId/addons/:id', authenticate, authorize([1, 2]), clientAddOnController.updateClientAddOn);
router.delete('/:clientId/addons/:id', authenticate, authorize([1, 2]), clientAddOnController.deleteClientAddOn);

export default router;
