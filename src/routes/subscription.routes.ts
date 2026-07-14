import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as subscriptionController from '../controllers/subscription.controller';

const router = Router();

// Retrieve all subscriptions
router.get('/', authenticate, subscriptionController.getSubscriptions);

// Retrieve a subscription by ID
router.get('/:id', authenticate, subscriptionController.getSubscriptionById);

// Create a subscription (Admin and Manager only)
router.post('/', authenticate, authorize([1, 2]), subscriptionController.createSubscription);

// Update a subscription (Admin and Manager only)
router.put('/:id', authenticate, authorize([1, 2]), subscriptionController.updateSubscription);

// Delete a subscription (Admin and Manager only)
router.delete('/:id', authenticate, authorize([1, 2]), subscriptionController.deleteSubscription);

export default router;
