import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as packageController from '../controllers/package.controller';

const router = Router();

router.get(
  '/lookups',
  authenticate,
  authorize(['ADMIN', 'MANAGER']),
  packageController.getPackageLookups
);

router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.getPackages);

router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.getPackageById);

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.createPackage);

router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.updatePackage);

router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), packageController.deletePackage);

export default router;
