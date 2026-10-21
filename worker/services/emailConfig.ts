/**
 * Shared email service configuration (works on Workers + Node).
 */
export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  ADMIN_EMAIL_RECIPIENT?: string;
}

export function getFromAddress(env: EmailEnv): string {
  return env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}