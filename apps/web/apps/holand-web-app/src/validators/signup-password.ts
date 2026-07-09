import { z } from 'zod';

/** Matches backend RegisterRequest + auth-service PASSWORD_MIN_LENGTH. */
export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

export type SignupPasswordRuleId =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'numeric';

export interface SignupPasswordRule {
  id: SignupPasswordRuleId;
  label: string;
  met: boolean;
}

/**
 * Evaluate sign-up password rules for live hint UI.
 */
export function evaluateSignupPasswordRules(
  password: string,
  t: (key: string) => string
): SignupPasswordRule[] {
  return [
    {
      id: 'minLength',
      label: t('authPages.signUp.passwordRules.minLength', {
        min: SIGNUP_PASSWORD_MIN_LENGTH,
      }),
      met: password.length >= SIGNUP_PASSWORD_MIN_LENGTH,
    },
    {
      id: 'uppercase',
      label: t('authPages.signUp.passwordRules.uppercase'),
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: t('authPages.signUp.passwordRules.lowercase'),
      met: /[a-z]/.test(password),
    },
    {
      id: 'numeric',
      label: t('authPages.signUp.passwordRules.numeric'),
      met: /\d/.test(password),
    },
  ];
}

/**
 * First failing password rule message (ordered) for Zod field errors.
 */
export function firstSignupPasswordError(
  password: string,
  t: (key: string) => string
): string | null {
  if (!password) {
    return t('authPages.signUp.validation.passwordRequired');
  }
  if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
    return t('authPages.signUp.validation.passwordMinLength');
  }
  if (!/[A-Z]/.test(password)) {
    return t('authPages.signUp.validation.passwordUppercase');
  }
  if (!/[a-z]/.test(password)) {
    return t('authPages.signUp.validation.passwordLowercase');
  }
  if (!/\d/.test(password)) {
    return t('authPages.signUp.validation.passwordNumeric');
  }
  return null;
}

/**
 * Zod password field — one clear error at a time, aligned with backend min length 8.
 */
export function createSignupPasswordField(t: (key: string) => string) {
  return z.string().superRefine((value, ctx) => {
    const message = firstSignupPasswordError(value, t);
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });
}
