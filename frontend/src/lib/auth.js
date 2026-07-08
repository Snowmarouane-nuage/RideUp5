/** RIDE'UP native auth (email / password). */
export function goToLogin(redirectPath = "/dashboard") {
  const q = redirectPath !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectPath)}` : "";
  window.location.href = `/login${q}`;
}

export function loginPath(redirectPath = "/dashboard") {
  const q = redirectPath !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectPath)}` : "";
  return `/login${q}`;
}
