/**
 * Client-side form validation helpers.
 * Mirrors the server-side Zod validation rules.
 */

export interface FieldErrors {
  [field: string]: string;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value: string): boolean {
  // At least 8 chars, one uppercase, one lowercase, one number
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

export function validateEmail(value: string): string | undefined {
  if (!value) return 'Email is required';
  if (!isEmail(value)) return 'Invalid email format';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!isStrongPassword(value)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }
  return undefined;
}

export function validateRequired(value: string, label = 'This field'): string | undefined {
  if (!value || !value.trim()) return `${label} is required`;
  return undefined;
}

export function validateMinLength(value: string, min: number, label = 'This field'): string | undefined {
  if (!value || value.trim().length < min) {
    return `${label} must be at least ${min} characters`;
  }
  return undefined;
}

export function validateMaxLength(value: string, max: number, label = 'This field'): string | undefined {
  if (value && value.length > max) {
    return `${label} cannot exceed ${max} characters`;
  }
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Password confirmation is required';
  if (password !== confirm) return 'Passwords do not match';
  return undefined;
}

/**
 * Validate a set of fields and return the first error message, or null if valid.
 */
export function validateFields(validators: Array<() => string | undefined>): string | null {
  for (const validate of validators) {
    const error = validate();
    if (error) return error;
  }
  return null;
}
