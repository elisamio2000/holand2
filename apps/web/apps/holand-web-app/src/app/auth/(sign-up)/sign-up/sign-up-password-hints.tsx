'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import { PiCheckCircleFill, PiCircle } from 'react-icons/pi';
import {
  evaluateSignupPasswordRules,
  SIGNUP_PASSWORD_MIN_LENGTH,
} from '@/validators/signup-password';

interface SignUpPasswordHintsProps {
  password: string;
  showErrors?: boolean;
  /** When false, nothing is rendered (parent controls focus-based visibility). */
  visible?: boolean;
}

/**
 * Live password requirement checklist for the sign-up form.
 * Render only while the password field is focused — see SignUpForm.
 */
export default function SignUpPasswordHints({
  password,
  showErrors = false,
  visible = true,
}: SignUpPasswordHintsProps) {
  const { t } = useTranslation();
  const rules = useMemo(
    () => evaluateSignupPasswordRules(password, t),
    [password, t]
  );
  const hasInput = password.length > 0;

  if (!visible) {
    return null;
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-muted bg-gray-50/80 px-3 py-2.5 duration-200 dark:bg-gray-100/60"
      aria-live="polite"
    >
      <Text className="mb-2 text-xs font-medium text-gray-600">
        {t('authPages.signUp.passwordRules.title', {
          min: SIGNUP_PASSWORD_MIN_LENGTH,
        })}
      </Text>
      <ul className="space-y-1">
        {rules.map((rule) => {
          const unmet = hasInput && !rule.met && showErrors;
          const pending = !hasInput && !rule.met;
          return (
            <li key={rule.id} className="flex items-start gap-2 text-xs">
              {rule.met ? (
                <PiCheckCircleFill className="mt-0.5 size-4 shrink-0 text-green-600" />
              ) : (
                <PiCircle
                  className={`mt-0.5 size-4 shrink-0 ${
                    unmet ? 'text-red-500' : 'text-gray-400'
                  }`}
                />
              )}
              <span
                className={
                  rule.met
                    ? 'text-green-700'
                    : unmet
                      ? 'text-red-600'
                      : pending
                        ? 'text-gray-500'
                        : 'text-amber-700'
                }
              >
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
