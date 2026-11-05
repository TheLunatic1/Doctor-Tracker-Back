import { Router } from 'express';
import * as doctorController from '../controllers/doctor.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  doctorQuerySchema,
  doctorParamsSchema,
} from '../validators/doctor.validator.js';
import {
  createNestedPatientSchema,
  nestedPatientParamsSchema,
} from '../validators/patient.validator.js';

const router = Router();

// Protect all doctor routes
router.use(authenticate);

// Main Doctor CRUD
router
  .route('/')
  .get(validate(doctorQuerySchema), doctorController.listDoctors)
  .post(validate(createDoctorSchema), doctorController.createDoctor);

router
  .route('/:id')
  .get(validate(doctorParamsSchema), doctorController.getDoctor)
  .put(validate(updateDoctorSchema), doctorController.updateDoctor)
  .delete(validate(doctorParamsSchema), doctorController.deleteDoctor);

// Nested Doctor Patients routes
router
  .route('/:id/patients')
  .get(validate(doctorParamsSchema), doctorController.getDoctorPatients)
  .post(validate(createNestedPatientSchema), doctorController.addDoctorPatient);

router
  .route('/:id/patients/:patientId')
  .delete(validate(nestedPatientParamsSchema), doctorController.deleteDoctorPatient);

export default router;
