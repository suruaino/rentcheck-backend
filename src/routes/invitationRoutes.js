import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import {
  createInvitation,
  getPropertyInvitations,
  getMyInvitations,
  acceptInvitation,
  revokeInvitation,
} from '../controllers/invitationController.js';

const router = Router();

router.use(protect);

router.post('/', checkRole('landlord'), createInvitation);
router.get('/me', getMyInvitations);
router.get('/property/:propertyId', checkRole('landlord'), getPropertyInvitations);
router.post('/accept', acceptInvitation);
router.patch('/:invitationId/revoke', checkRole('landlord'), revokeInvitation);

export default router;