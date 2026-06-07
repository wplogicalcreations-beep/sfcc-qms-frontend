const TECHNICAL_ERROR_PATTERN = /(SQLITE|constraint|foreign key|unique|syntax error|stack trace|ECONNREFUSED|network error|internal server error|undefined is not|cannot read)/i;

export function userSafeError(error, fallback = 'This record could not be saved. Please check the required fields and try again.') {
  const raw = error?.response?.data?.error || error?.message || '';
  if (!raw || TECHNICAL_ERROR_PATTERN.test(String(raw))) return fallback;
  return String(raw);
}

export function userSafeLoadError(error, fallback = 'Records could not be loaded. Please refresh and try again.') {
  return userSafeError(error, fallback);
}

export function referenceConflictMessage() {
  return 'A reference conflict was detected. The system attempted to allocate a new reference. Please try again or contact System Admin.';
}
