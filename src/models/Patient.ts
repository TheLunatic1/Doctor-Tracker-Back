import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IPatient extends Document {
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  condition: string;
  doctor: Types.ObjectId;
  status: 'Active' | 'Discharged' | 'Critical';
  medicalRecordNumber?: string;
  admittedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IPatientModel = Model<IPatient>;

const patientSchema = new Schema<IPatient, IPatientModel>(
  {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
      index: true,
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [0, 'Age cannot be negative'],
      max: [130, 'Age cannot exceed 130'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['Male', 'Female', 'Other'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      trim: true,
      index: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Assigned doctor is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Discharged', 'Critical'],
      default: 'Active',
      index: true,
    },
    medicalRecordNumber: {
      type: String,
      trim: true,
    },
    admittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Performance Indexes
patientSchema.index({ doctor: 1, createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ status: 1, createdAt: -1 });
patientSchema.index({ admittedAt: -1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ doctor: 1, condition: 1 });
patientSchema.index({ name: 1, createdAt: -1 });

export const Patient = mongoose.model<IPatient, IPatientModel>('Patient', patientSchema);
