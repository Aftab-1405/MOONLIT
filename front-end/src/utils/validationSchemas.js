/**
 * Validation Schemas
 *
 * Zod schemas for authentication and database connection forms.
 *
 * @module utils/validationSchemas
 */

import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

const emailRule = z.string().min(1, 'Email is required').email('Please enter a valid email');

const passwordRule = z.string().min(1, 'Password is required');

const passwordWithLengthRule = z
  .string()
  .min(1, 'Password is required')
  .min(6, 'Password must be at least 6 characters');

export const signInSchema = z.object({
  email: emailRule,
  password: passwordRule,
});

export const signUpSchema = z
  .object({
    displayName: z.string().optional(),
    email: emailRule,
    passwordSignUp: passwordWithLengthRule,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.passwordSignUp === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const resetPasswordSchema = z.object({
  email: emailRule,
});

export const authFieldSchemas = {
  email: emailRule,
  password: passwordRule,
  passwordSignUp: passwordWithLengthRule,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  displayName: z.string().optional(),
};

// ─── Database ─────────────────────────────────────────────────────────────────

export const credentialsSchema = z.object({
  host: z
    .string()
    .min(1, 'Host is required')
    .regex(/^[a-zA-Z0-9.-]+$/, 'Invalid host format'),
  port: z
    .string()
    .min(1, 'Port is required')
    .refine((val) => {
      const num = parseInt(val, 10);
      return !Number.isNaN(num) && num >= 1 && num <= 65535;
    }, 'Port must be between 1 and 65535'),
  user: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const connectionStringSchema = z.object({
  connectionString: z.string().min(1, 'Connection string is required'),
});

export const dbFieldSchemas = {
  host: z
    .string()
    .min(1, 'Host is required')
    .regex(/^[a-zA-Z0-9.-]+$/, 'Invalid host format'),
  port: z
    .string()
    .min(1, 'Port is required')
    .refine((val) => {
      const num = parseInt(val, 10);
      return !Number.isNaN(num) && num >= 1 && num <= 65535;
    }, 'Port must be between 1 and 65535'),
  user: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  connectionString: z.string().min(1, 'Connection string is required'),
  database: z.string().min(1, 'Database name is required'),
};
