import { Router } from 'express';
import { authenticate, authorize, authorizeSection } from '../middleware/auth.middleware';
import * as packageController from '../controllers/package.controller';

const router = Router();

router.get(
  '/lookups',
  authenticate,
  authorizeSection('Packages'),
  packageController.getPackageLookups
);

router.get('/', authenticate, authorizeSection('Packages'), packageController.getPackages);

router.get(
  '/:id/history/:versionNumber',
  authenticate,
  authorizeSection('Packages'),
  packageController.getPackageVersion
);

router.get(
  '/:id/history',
  authenticate,
  authorizeSection('Packages'),
  packageController.getPackageHistory
);

router.get('/:id', authenticate, authorizeSection('Packages'), packageController.getPackageById);

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.createPackage);

router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.updatePackage);

router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.deletePackage);

export default router;
