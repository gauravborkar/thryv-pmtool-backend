import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as clientAddOnService from '../services/client-addon.service';
import { logAction } from '../services/audit.service';

const getErrorStatus = (error: any) => {
  const message = error.message || '';
  if (message.includes('Forbidden')) return 403;
  if (message.includes('not found')) return 404;
  return 400;
};

export const getClientAddOns = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const clientId = parseInt(req.params.clientId, 10);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const addons = await clientAddOnService.getClientAddOns(clientId);

    res.status(200).json({
      message: 'Add-Ons retrieved successfully',
      data: addons,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const createClientAddOn = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const clientId = parseInt(req.params.clientId, 10);
  const { title, description, date, price, assigned_to_id } = req.body;
  const user = req.user!;

  try {
    if (isNaN(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }
    if (!title || !date || price === undefined) {
      return res.status(400).json({ message: 'Title, date, and price are required' });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: 'Price must be a valid number greater than or equal to 0' });
    }

    const addon = await clientAddOnService.createClientAddOn(
      clientId,
      {
        title,
        description,
        date,
        price: priceNum,
        assigned_to_id: assigned_to_id ? parseInt(assigned_to_id, 10) : undefined,
      },
      user.id
    );

    await logAction({
      userId: user.id,
      action: 'ADDON_CREATE_SUCCESS',
      entity: 'AddOn',
      entityId: addon.id,
      details: { title, clientId, price: priceNum },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Add-On created successfully',
      data: addon,
    });
  } catch (error: any) {
    await logAction({
      userId: user.id,
      action: 'ADDON_CREATE_FAILURE',
      details: { title, clientId, error: error.message },
      ipAddress: req.ip,
    });
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const updateClientAddOn = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, date, price, assigned_to_id } = req.body;
  const user = req.user!;

  try {
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid Add-On ID' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: 'Price must be a valid number greater than or equal to 0' });
      }
      updateData.price = priceNum;
    }
    if (assigned_to_id !== undefined) {
      updateData.assigned_to_id = assigned_to_id ? parseInt(assigned_to_id, 10) : null;
    }

    const addon = await clientAddOnService.updateClientAddOn(id, updateData, user.id);

    await logAction({
      userId: user.id,
      action: 'ADDON_UPDATE_SUCCESS',
      entity: 'AddOn',
      entityId: addon.id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Add-On updated successfully',
      data: addon,
    });
  } catch (error: any) {
    await logAction({
      userId: user.id,
      action: 'ADDON_UPDATE_FAILURE',
      entity: 'AddOn',
      entityId: id,
      details: { error: error.message },
      ipAddress: req.ip,
    });
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const deleteClientAddOn = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid Add-On ID' });
    }

    const addon = await clientAddOnService.deleteClientAddOn(id);

    await logAction({
      userId: user.id,
      action: 'ADDON_DELETE_SUCCESS',
      entity: 'AddOn',
      entityId: id,
      details: { title: addon.title },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Add-On deleted successfully',
      data: addon,
    });
  } catch (error: any) {
    await logAction({
      userId: user.id,
      action: 'ADDON_DELETE_FAILURE',
      entity: 'AddOn',
      entityId: id,
      details: { error: error.message },
      ipAddress: req.ip,
    });
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};
