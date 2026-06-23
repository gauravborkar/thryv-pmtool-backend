import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as clientService from '../services/client.service';
import { logAction } from '../services/audit.service';

const getErrorStatus = (error: any) => {
  const message = error.message || '';
  if (message.includes('Forbidden')) return 403;
  if (message.includes('not found')) return 404;
  return 400;
};

export const getClients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const activeOnly = req.query.activeOnly !== 'false';
    const clients = await clientService.getClients(user, activeOnly);

    res.status(200).json({
      message: 'Clients retrieved successfully',
      data: clients,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const getClientById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const user = req.user!;
    const client = await clientService.getClientById(id, user);

    res.status(200).json({
      message: 'Client retrieved successfully',
      data: client,
    });
  } catch (error: any) {
    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const createClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, active_month, manager_id, brand_details, timezone, package_ids } = req.body;
  const user = req.user!;

  try {
    if (!name || !active_month) {
      return res.status(400).json({ message: 'Name and active_month are required' });
    }

    const client = await clientService.createClient(
      { name, active_month, manager_id, brand_details, timezone, package_ids },
      user
    );

    // Log successful client creation
    await logAction({
      userId: user.id,
      action: 'CLIENT_CREATE_SUCCESS',
      entity: 'Client',
      entityId: client.id,
      details: { name, manager_id: client.manager_id },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Client created successfully',
      data: client,
    });
  } catch (error: any) {
    // Log failed client creation
    await logAction({
      userId: user.id,
      action: 'CLIENT_CREATE_FAILURE',
      details: { name, error: error.message },
      ipAddress: req.ip,
    });

    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const updateClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const client = await clientService.updateClient(id, req.body, user);

    // Log successful client update
    await logAction({
      userId: user.id,
      action: 'CLIENT_UPDATE_SUCCESS',
      entity: 'Client',
      entityId: client.id,
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Client updated successfully',
      data: client,
    });
  } catch (error: any) {
    // Log failed client update
    await logAction({
      userId: user.id,
      action: 'CLIENT_UPDATE_FAILURE',
      entity: 'Client',
      entityId: id,
      details: { error: error.message },
      ipAddress: req.ip,
    });

    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};

export const archiveClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id, 10);
  const user = req.user!;

  try {
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }

    const client = await clientService.archiveClient(id, user);

    // Log successful client archive
    await logAction({
      userId: user.id,
      action: 'CLIENT_ARCHIVE_SUCCESS',
      entity: 'Client',
      entityId: client.id,
      details: { name: client.name },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Client archived successfully',
      data: client,
    });
  } catch (error: any) {
    // Log failed client archive
    await logAction({
      userId: user.id,
      action: 'CLIENT_ARCHIVE_FAILURE',
      entity: 'Client',
      entityId: id,
      details: { error: error.message },
      ipAddress: req.ip,
    });

    res.status(getErrorStatus(error)).json({ message: error.message });
  }
};
