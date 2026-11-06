import { Router } from 'express';
import * as patientController from '../controllers/patient.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createPatientSchema,
  updatePatientSchema,
  patientQuerySchema,
  patientParamsSchema,
} from '../validators/patient.validator.js';

const router = Router();

// Protect all patient routes
router.use(authenticate);

router
  .route('/')
  .get(validate(patientQuerySchema), patientController.listPatients)
  .post(authorize('admin', 'doctor', 'staff'), validate(createPatientSchema), patientController.createPatient);

router
  .route('/:id')
  .get(validate(patientParamsSchema), patientController.getPatient)
  .put(authorize('admin', 'doctor', 'staff'), validate(updatePatientSchema), patientController.updatePatient)
  .delete(authorize('admin'), validate(patientParamsSchema), patientController.deletePatient);

export default router;
