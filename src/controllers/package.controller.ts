import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as packageService from '../services/package.service';
import { logAction } from '../services/audit.service';

const getErrorStatus = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found')) return 404;
  return 400;
};

export const getPackages = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const packages = await packageService.getContentPackages();
    res.status(200).json({
      message: 'Packages retrieved successfully',
      data: packages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
};

export const getPackageLookups = async (_req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const lookups = await packageService.getPackageBuilderLookups();
    res.status(200).json({
      message: 'Package builder lookups retrieved successfully',
      data: lookups,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  }
};

export const getPackageById = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const { id } = req.params;
    const pkg = await packageService.getContentPackageById(id);
    res.status(200).json({
      message: 'Package retrieved successfully',
      data: pkg,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(getErrorStatus(error)).json({ message });
  }
};

export const createPackage = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const user = req.user!;

  try {
    const { name, description, items } = req.body;

    if (!name || !items) {
      return res.status(400).json({ message: 'Name and items are required' });
    }

    const pkg = await packageService.createContentPackage(
      { name, description, items },
      user
    );

    await logAction({
      userId: user.id,
      action: 'CONTENT_PACKAGE_CREATE_SUCCESS',
      entity: 'ContentPackage',
      entityId: undefined,
      details: { packageId: pkg.id, name: pkg.name, lineCount: pkg.items.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Package created successfully',
      data: pkg,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    await logAction({
      userId: user.id,
      action: 'CONTENT_PACKAGE_CREATE_FAILURE',
      details: { error: message },
      ipAddress: req.ip,
    });

    res.status(getErrorStatus(error)).json({ message });
  }
};

export const updatePackage = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const pkg = await packageService.updateContentPackage(id, req.body, user);

    await logAction({
      userId: user.id,
      action: 'CONTENT_PACKAGE_UPDATE_SUCCESS',
      entity: 'ContentPackage',
      details: { packageId: pkg.id, updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Package updated successfully',
      data: pkg,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    await logAction({
      userId: user.id,
      action: 'CONTENT_PACKAGE_UPDATE_FAILURE',
      entity: 'ContentPackage',
      details: { packageId: id, error: message },
      ipAddress: req.ip,
    });

    res.status(getErrorStatus(error)).json({ message });
  }
};

export const getPackageHistory = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const { id } = req.params;
    const history = await packageService.getPackageHistory(id);
    res.status(200).json({
      message: 'Package history retrieved successfully',
      data: history,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(getErrorStatus(error)).json({ message });
  }
};

export const getPackageVersion = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const { id, versionNumber } = req.params;
    const version = parseInt(versionNumber, 10);
    if (isNaN(version) || version < 1) {
      return res.status(400).json({ message: 'Invalid version number' });
    }

    const data = await packageService.getPackageVersion(id, version);
    res.status(200).json({
      message: 'Package version retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(getErrorStatus(error)).json({ message });
  }
};

export const deletePackage = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const user = req.user!;
  const { id } = req.params;

  try {
    const result = await packageService.deleteContentPackage(id, user);

    await logAction({
      userId: user.id,
      action: 'CONTENT_PACKAGE_DELETE_SUCCESS',
      entity: 'ContentPackage',
      details: { packageId: result.id },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: 'Package deleted successfully',
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    await logAction({
      userId: user.id,
      action: 'CONTENT_PACKAGE_DELETE_FAILURE',
      entity: 'ContentPackage',
      details: { packageId: id, error: message },
      ipAddress: req.ip,
    });

    res.status(getErrorStatus(error)).json({ message });
  }
};
