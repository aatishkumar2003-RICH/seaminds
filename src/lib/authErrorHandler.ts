/**
 * Global auth error handler to prevent infinite token refresh loops.
 * Catches AuthRetryableFetchError and clears session after max retries.
 */

const MAX_REFRESH_FAILURES = 2;
let refreshFailureCount = 0;
let isClearing = false;

export function handleAuthRefreshError() {
  refreshFailureCount++;
  console.warn(`[SeaMinds] Auth token refresh failed (${refreshFailureCount}/${MAX_REFRESH_FAILURES})`);
  
  if (refreshFailureCount >= MAX_REFRESH_FAILURES && !isClearing) {
    isClearing = true;
    console.error('[SeaMinds] Max auth refresh retries reached. Clearing session.');
    clearSessionAndRedirect();
  }
}

export function resetRefreshFailureCount() {
  refreshFailureCount = 0;
}

export function clearSessionAndRedirect() {
  // Clear all Supabase-related localStorage keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.startsWith('supabase') || key === 'seamind_profile_id')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Force redirect to homepage
  window.location.href = '/';
}

/**
 * Install a global unhandled rejection handler to catch AuthRetryableFetchError
 * from Supabase's internal token refresh mechanism.
 */
export function installGlobalAuthErrorHandler() {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (
      error &&
      (error.name === 'AuthRetryableFetchError' ||
       (error.message && error.message.includes('_refreshAccessToken')) ||
       (error.message && error.message.includes('AuthRetryableFetchError')))
    ) {
      event.preventDefault(); // Prevent console noise
      handleAuthRefreshError();
    }
  });
}
