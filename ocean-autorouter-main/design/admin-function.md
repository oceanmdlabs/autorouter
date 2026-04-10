# Admin Impersonation — Design Notes

## Explanation of Admin Logic

### How It Works

1. **Authentication**
    - Users log in via OAuth (Microsoft, GitHub, Google) or client credentials.
    - Their `tenantId` is set based on their account association.

2. **System Admin Role**
    - Users with `roles.admin === "system"` have privileges to view/manage any site.

3. **Tenant Switching** (`/api/auth/update-tenant`)
    - Only system admins can call this endpoint.
    - It updates the session's `tenantId` to the selected site.
    - `originalTenantId` is preserved so we know the admin is impersonating.

4. **Site-Scoped Data**
    - Repositories filter by `tenantId` from the session (e.g., `dbService.findFirst(siteConfig)`).
    - When admin switches tenant, subsequent queries use the new tenant automatically.

5. **UI Indication**
    - The layout shows **View as Admin: Site Name** (styled in orange) when `originalTenantId !== tenantId`.

---

## Assessment of the Pattern

### Strengths

- ✅ Simple and effective — session-based tenant switching.
- ✅ No database schema changes required; works via session manipulation.
- ✅ Existing repository code continues to work (tenant filtering).
- ✅ Clear audit trail potential (log both `tenantId` and `originalTenantId`).

### Potential Improvements

1. **Return to own site**
    - Add a "Return to my site" button in the header when viewing as admin.

2. **Audit logging**
    - Log admin tenant switches for security/audit purposes.

3. **Session expiry**
    - `originalTenantId` persists until logout; consider auto-expiry for impersonation.

4. **Permission granularity**
    - Consider more granular admin permissions (e.g., view-only vs edit).

---

Overall, this is a common and practical pattern for admin impersonation in multi-tenant applications.
