import { z } from 'zod';
import { messages } from '@/config/messages';
import {
  getAllowedInternalEmailDomains,
  isValidPlatformEmail,
} from '@/config/platform-email';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from './common-rules';
import { createSignupPasswordField } from './signup-password';

/**
 * Build sign-up validation schema with platform email rules and mandatory terms.
 */
export function createSignUpSchema(t: (key: string) => string) {
  const allowedDomains = getAllowedInternalEmailDomains();

  return z
    .object({
      username: z
        .string()
        .min(3, { message: t('authPages.signUp.validation.usernameMinLength') })
        .max(50, { message: t('authPages.signUp.validation.usernameMaxLength') }),
      email: z.string().refine(
        (value) => isValidPlatformEmail(value, allowedDomains),
        { message: t('authPages.signUp.validation.invalidEmail') }
      ),
      password: createSignupPasswordField(t),
      confirmPassword: z.string().min(1, {
        message: t('authPages.signUp.validation.confirmPasswordRequired'),
      }),
      isAgreed: z.boolean().refine((value) => value === true, {
        message: t('authPages.signUp.validation.termsRequired'),
      }),
    })
    .superRefine((data, ctx) => {
      if (data.confirmPassword && data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('authPages.signUp.validation.passwordMismatch'),
          path: ['confirmPassword'],
        });
      }
    });
}

export type PrimarySignUpSchema = z.infer<ReturnType<typeof createSignUpSchema>>;

/**
 * Legacy template forms (sign-up-1 … sign-up-5) — demo only.
 * @deprecated Use createSignUpSchema on the primary /auth/sign-up route.
 */
export const signUpSchema = z.object({
  firstName: z.string().min(1, { message: messages.firstNameRequired }),
  lastName: z.string().optional(),
  email: validateEmail,
  password: validatePassword,
  confirmPassword: validateConfirmPassword,
  isAgreed: z.boolean(),
});

export type SignUpSchema = z.infer<typeof signUpSchema>;
