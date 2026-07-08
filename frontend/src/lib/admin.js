/** Admin UI — only true when the backend confirmed is_admin on /auth/me */
export function isSiteAdmin(user) {
  return Boolean(user && user.is_admin === true);
}
