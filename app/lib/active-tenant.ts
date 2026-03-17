import { toast } from "vue-sonner";

const MISSING_ACTIVE_TENANT_MESSAGE = "An active tenant is required";
const TENANT_SELECTION_ROUTE = "/portal/sites";

export function isMissingActiveTenantError(error: any) {
  const statusCode =
    error?.statusCode ?? error?.status ?? error?.data?.statusCode ?? null;
  const message =
    error?.statusMessage ??
    error?.message ??
    error?.data?.statusMessage ??
    error?.data?.message ??
    "";

  return statusCode === 401 && message === MISSING_ACTIVE_TENANT_MESSAGE;
}

export async function handleMissingActiveTenantError(
  error: any,
  options?: { notify?: boolean },
) {
  if (!isMissingActiveTenantError(error)) {
    return false;
  }

  const route = useRoute();
  const shouldNotify =
    import.meta.client &&
    options?.notify !== false &&
    route.path !== TENANT_SELECTION_ROUTE;

  if (shouldNotify) {
    toast.error("Site selection required", {
      description: "Choose an active site to continue.",
    });
  }

  if (route.path !== TENANT_SELECTION_ROUTE) {
    await navigateTo(TENANT_SELECTION_ROUTE);
  }

  return true;
}
