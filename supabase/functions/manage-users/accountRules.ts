export const EMAIL_IN_USE = 'This email has already been used or assigned to another outlet or shop. Please use a different email.';
export function accountUpdateError(input: {
  admin: boolean; owner: boolean; callerStore: string | null; targetStore: string | null;
  targetOwner: boolean; activeStore: boolean; email: unknown; password: unknown;
}) {
  if (!input.admin || !input.callerStore || input.callerStore !== input.targetStore || !input.activeStore) return 'Only administrators can update users in their active store';
  if (input.targetOwner && !input.owner) return 'Only the platform owner can update this account';
  if (typeof input.email !== 'string' || input.email.length > 254 || !/^\S+@\S+\.\S+$/.test(input.email)) return 'Enter a valid email address';
  if (input.password !== undefined && (typeof input.password !== 'string' || input.password.length < 6 || input.password.length > 128)) return 'Password must be between 6 and 128 characters';
  return null;
}