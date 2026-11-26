import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { checkPropertyAccess } from '../middleware/propertyMiddleware.js';
import {
  getPropertyCaretakers,
  updateCaretakerPermissions,
  getPropertyTenancies,
  getMyTenancies,
  endTenancy,
} from '../controllers/managementController.js';

const router = Router();

router.use(protect);

// Tenant's own tenancies
router.get('/tenancies/me', getMyTenancies);

// End an active tenancy (landlord)
router.patch('/tenancies/:tenancyId/end', checkRole('landlord'), endTenancy);

// Property-scoped caretakers & tenancies
router.get(
  '/properties/:propertyId/caretakers',
  checkPropertyAccess,
  getPropertyCaretakers
);
router.patch(
  '/properties/:propertyId/caretakers/:caretakerId',
  checkRole('landlord'),
  checkPropertyAccess,
  updateCaretakerPermissions
);
router.get(
  '/properties/:propertyId/tenancies',
  checkPropertyAccess,
  getPropertyTenancies
);

export default router;