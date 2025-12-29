/**
 * Validation Module - Barrel Export
 * 
 * @example
 * import { useFormValidation, signInSchema, authFieldSchemas } from '../validation';
 */

// Hook
export { useFormValidation } from './useFormValidation';

// Auth schemas
export {
  signInSchema,
  signUpSchema,
  resetPasswordSchema,
  authFieldSchemas,
} from './schemas/auth';

// Database schemas
export {
  credentialsSchema,
  connectionStringSchema,
  sqliteSchema,
  dbFieldSchemas,
} from './schemas/database';
