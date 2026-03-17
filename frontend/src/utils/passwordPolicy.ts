export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter";
  if (!/\d/.test(password)) return "Password must include at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one symbol";
  if (new TextEncoder().encode(password).length > 72) return "Password must be at most 72 bytes";
  return null;
}
