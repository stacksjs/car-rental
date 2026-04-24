import type { UserModel } from '@stacksjs/orm'

/**
 * Authorization Gates Configuration
 *
 * Define your application's authorization gates and policy mappings here.
 * Gates provide a simple way to authorize actions, while policies
 * organize authorization logic around particular models.
 *
 * @see https://stacksjs.org/docs/security/authorization
 */

/**
 * Gate definitions
 *
 * Simple ability checks that don't require a model.
 *
 * @example
 * // In your code:
 * import { Gate } from '@stacksjs/auth'
 *
 * if (await Gate.allows('edit-settings', user)) {
 *   // User can edit settings
 * }
 */
export const gates = {
  'access-admin': (user: UserModel | null) => {
    return (user as any)?.role === 'admin'
  },

  'edit-settings': (user: UserModel | null) => {
    return (user as any)?.role === 'admin'
  },

  'view-dashboard': (user: UserModel | null) => {
    return user !== null
  },

  'manage-fleet': (user: UserModel | null) => {
    const role = (user as any)?.role
    return role === 'host' || role === 'admin'
  },

  'moderate-content': (user: UserModel | null) => {
    return (user as any)?.role === 'admin'
  },
}

/**
 * Policy mappings
 *
 * Map model names to their policy classes.
 * Policy files should be in app/Policies/ directory.
 *
 * @example
 * // Simple mapping (uses PostPolicy for Post model)
 * 'Post': 'PostPolicy',
 *
 * // Or with config:
 * 'Post': {
 *   policy: 'PostPolicy',
 *   model: 'Post',
 * },
 */
export const policies: Record<string, string | { policy: string, model?: string }> = {
  Car: 'CarPolicy',
  Booking: 'BookingPolicy',
  HostProfile: 'HostProfilePolicy',
  Review: 'ReviewPolicy',
}

/**
 * Before callbacks
 *
 * Run before any gate/policy check. Return true to allow,
 * false to deny, or null to continue to the actual check.
 *
 * @example
 * // Super admins bypass all checks
 * (user) => user?.role === 'super-admin' ? true : null
 */
export const before: Array<(user: UserModel | null, ability: string, args: any[]) => boolean | null | Promise<boolean | null>> = [
  (user) => {
    if ((user as any)?.role === 'admin')
      return true
    return null
  },
]

/**
 * After callbacks
 *
 * Run after gate/policy checks. Can override the result.
 */
export const after: Array<(user: UserModel | null, ability: string, result: boolean, args: any[]) => boolean | void | Promise<boolean | void>> = [
  // Example: Log all authorization checks
  // (user, ability, result) => {
  //   console.log(`User ${user?.id} ${result ? 'allowed' : 'denied'} for ${ability}`)
  // },
]

export default { gates, policies, before, after }
