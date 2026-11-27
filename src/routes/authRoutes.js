import express from 'express';
import {
  register,
  login,
  getMe,
  verifyOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Register a new user
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/landlord-only', protect, checkRole('landlord'), (req, res) => {
  res.json({
    message: 'Welcome, landlord!',
  });
});

export default router;