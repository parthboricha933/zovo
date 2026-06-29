/**
 * Whether verifications (Phone, KYC, Driver, Vehicle) should be auto-approved
 * on submission. Set AUTO_APPROVE_VERIFICATIONS=1 to enable in any environment.
 *
 * Default behavior:
 *  - In dev (NODE_ENV !== 'production'): auto-approve ON
 *  - In production (Vercel/etc): auto-approve OFF unless AUTO_APPROVE_VERIFICATIONS=1
 *
 * For a demo deployment where you want signups to be instantly usable, set:
 *   AUTO_APPROVE_VERIFICATIONS=1
 */
export function shouldAutoApproveVerifications(): boolean {
  if (process.env.AUTO_APPROVE_VERIFICATIONS === '1') return true
  if (process.env.AUTO_APPROVE_VERIFICATIONS === '0') return false
  // Default: auto-approve in non-production environments
  return process.env.NODE_ENV !== 'production'
}
