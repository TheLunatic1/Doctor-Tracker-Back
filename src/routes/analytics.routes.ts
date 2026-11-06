import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Protect all analytics endpoints (clinical operations & management)
router.use(authenticate, authorize('admin', 'doctor', 'staff'));

router.get('/overview', analyticsController.getOverview);
router.get('/patients-per-doctor', analyticsController.getPatientsPerDoctor);
router.get('/timeline', analyticsController.getTimeline);
router.get('/conditions', analyticsController.getConditionDistribution);
router.get('/specializations', analyticsController.getSpecializationDistribution);
router.get('/recent', analyticsController.getRecentActivities);

export default router;
