import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { checkPropertyAccess } from '../middleware/propertyMiddleware.js';
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  createUnit,
  getUnitsByProperty,
  updateUnit,
} from '../controllers/propertyController.js';

const router = Router();

router.use(protect);

// Properties
router.post('/', checkRole('landlord'), createProperty);
router.get('/', getProperties);
router.get('/:propertyId', checkPropertyAccess, getPropertyById);
router.patch('/:propertyId', checkRole('landlord'), checkPropertyAccess, updateProperty);
router.put('/:propertyId', checkRole('landlord'), checkPropertyAccess, updateProperty);

// Units under a property
router.post('/:propertyId/units', checkRole('landlord'), checkPropertyAccess, createUnit);
router.get('/:propertyId/units', checkPropertyAccess, getUnitsByProperty);

// Direct unit update
router.patch('/units/:unitId', checkRole('landlord'), updateUnit);
router.put('/units/:unitId', checkRole('landlord'), updateUnit);

export default router;