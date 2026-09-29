import type { ApiError } from '../../types/api';
import type { PasswordProblem } from '../../types/generated/PasswordProblem';

const PASSWORD_PROBLEMS: readonly PasswordProblem[] = ['too-short', 'too-long', 'common', 'contains-email'];

export type AccountErrorKey =
    | 'invalidEmail'
    | 'invalidCredentials'
    | 'invalidLink'
    | 'emailTaken'
    | 'tooManyRequests'
    | 'reauthRequired'
    | 'generic'
    | `password.${PasswordProblem}`;

/// Maps an account API failure to its `account.errors.*` translation key.
export function accountErrorKey(err: unknown): AccountErrorKey {
    const response = (err as ApiError).response;
    const problem = response?.data.errors?.[0] as PasswordProblem | undefined;
    switch (response?.status) {
        case 400:
            return problem && PASSWORD_PROBLEMS.includes(problem) ? `password.${problem}` : 'invalidEmail';
        case 401:
            return 'invalidCredentials';
        case 403:
            return 'reauthRequired';
        case 404:
            return 'invalidLink';
        case 409:
            return 'emailTaken';
        case 429:
            return 'tooManyRequests';
        default:
            return 'generic';
    }
}
