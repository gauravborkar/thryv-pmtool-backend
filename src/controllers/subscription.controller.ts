import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as subscriptionService from '../services/subscription.service';
import { logAction } from '../services/audit.service';

const getErrorStatus = (error: any) => {
  const message = error.message || '';
  if (message.includes('Forbidden')) return 403;
  if (message.includes('not found')) return 404;
  return 400;
};

export const getSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const client_id = req.query.client_id ? parseInt(req.query.client_id as string, 10) : undefined;
    const subscriptions = await subscriptionService.getSubscriptions({ client_id });

    res.status(200).json({
      message: 'Subscriptions retrieved successfully',
      data: subscriptions,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const getSubscriptionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid subscription ID' });
    }

    const subscription = await subscriptionService.getSubscriptionById(id);

    res.status(200).json({
      message: 'Subscription retrieved successfully',
      data: subscription,
    });
  } catch (error: any) {
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const createSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log("DEBUG BACKEND RECEIVED BODY:", req.body);
  const { client_id, title, description, price, payment_method, due_date } = req.body;
  const user = req.user!;

  try {
    let parsedClientId: number | null = null;
    if (client_id !== undefined && client_id !== null && client_id !== '' && client_id !== 'null' && client_id !== 'undefined') {
      parsedClientId = typeof client_id === 'number' ? client_id : parseInt(client_id, 10);
      if (isNaN(parsedClientId)) {
        console.log("DEBUG: parsedClientId is NaN, returning Invalid client ID error");
        return res.status(400).json({ message: 'Invalid client ID' });
      }
    }
    if (!title || price === undefined || !payment_method || !due_date) {
      return res.status(400).json({ message: 'Title, price, payment method, and due date are required' });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: 'Price must be a valid number greater than or equal to 0' });
    }

    const subscription = await subscriptionService.createSubscription(
      {
        client_id: parsedClientId,
        title,
        description,
        price: priceNum,
        payment_method,
        due_date,
      },
      user.id
    );

    await logAction({
      userId: user.id,
      action: 'SUBSCRIPTION_CREATE_SUCCESS',
      entity: 'Subscription',
      entityId: subscription.id,
      details: { title, client_id: parsedClientId, price: priceNum },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Subscription created successfully',
      data: subscription,
    });
  } catch (error: any) {
    await logAction({
      userId: user.id,
      action: 'SUBSCRIPTION_CREATE_FAILURE',
      details: { title, client_id, error: error.message },
      ipAddress: req.ip,
    });
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const updateSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id, 10);
  const { client_id, title, description, price, payment_method, due_date } = req.body;
  const user = req.user!;

  try {
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid subscription ID' });
    }

    const updateData: any = {};
    if (client_id !== undefined) {
      let parsedClientId: number | null = null;
      if (client_id !== null && client_id !== '' && client_id !== 'null' && client_id !== 'undefined') {
        parsedClientId = typeof client_id === 'number' ? client_id : parseInt(client_id, 10);
        if (isNaN(parsedClientId)) {
          return res.status(400).json({ message: 'Invalid client ID' });
        }
      }
      updateData.client_id = parsedClientId;
    }
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: 'Price must be a valid number greater than or equal to 0' });
      }
      updateData.price = priceNum;
    }

    const subscription = await subscriptionService.updateSubscription(id, updateData);

    await logAction({
      userId: user.id,
      action: 'SUBSCRIPTION_UPDATE_SUCCESS',
      entity: 'Subscription',
      entityId: subscription.id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Subscription updated successfully',
      data: subscription,
    });
  } catch (error: any) {
    await logAction({
      userId: user.id,
      action: 'SUBSCRIPTION_UPDATE_FAILURE',
      entity: 'Subscription',
      entityId: id,
      details: { error: error.message },
      ipAddress: req.ip,
    });
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const deleteSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid subscription ID' });
    }

    const subscription = await subscriptionService.deleteSubscription(id);

    await logAction({
      userId: user.id,
      action: 'SUBSCRIPTION_DELETE_SUCCESS',
      entity: 'Subscription',
      entityId: id,
      details: { title: subscription.title },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Subscription deleted successfully',
      data: subscription,
    });
  } catch (error: any) {
    await logAction({
      userId: user.id,
      action: 'SUBSCRIPTION_DELETE_FAILURE',
      entity: 'Subscription',
      entityId: id,
      details: { error: error.message },
      ipAddress: req.ip,
    });
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};
