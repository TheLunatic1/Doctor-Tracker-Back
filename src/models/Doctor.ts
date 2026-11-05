import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDoctor extends Document {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  avatar?: string;
  qualification?: string;
  yearsExperience: number;
  rating: number;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IDoctorModel = Model<IDoctor>;

const doctorSchema = new Schema<IDoctor, IDoctorModel>(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
      index: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
      index: true,
    },
    hospital: {
      type: String,
      required: [true, 'Hospital is required'],
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    qualification: {
      type: String,
      default: 'MBBS, MD',
    },
    yearsExperience: {
      type: Number,
      default: 5,
      min: 0,
      max: 60,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    bio: {
      type: String,
      default: 'Experienced healthcare specialist dedicated to high quality clinical care and patient wellness.',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Performance Indexes
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ status: 1, createdAt: -1 });
doctorSchema.index({ name: 1, createdAt: -1 });
doctorSchema.index({ createdAt: -1 });

export const Doctor = mongoose.model<IDoctor, IDoctorModel>('Doctor', doctorSchema);
