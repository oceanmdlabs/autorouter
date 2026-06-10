import { toast } from "vue-sonner";
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";
import { getOceanServerUrl } from "@/src/application/services/ocean-server.utils";
import type {
  NewSiteConfiguration,
  SiteConfiguration,
} from "@/src/entities/models/site-configuration";
import { uuid } from "@/src/entities/models/uuid";

const panelFields = {
  connection: [
    "name",
    "clientId",
    "oceanServer",
    "oceanSiteNum",
    "oceanClientId",
    "oceanClientSecret",
  ],
  inbound: ["clientSecret"],
  sms: ["smsProvider", "twilioAccountSid", "twilioAuthToken", "twilioPhoneNumber", "smsSendAllowlist"],
  ai: ["aiProvider", "aiApiKey", "aiModel"],
  email: ["emailProvider", "emailFromAddress", "emailApiKey", "emailFromName", "emailSendAllowlist"],
  openApi: ["siteKey", "siteCredential", "sharedEncryptionKey"],
  erequests: [
    "erequestArchivalEnabled",
    "erequestEnabledConfirmedAt",
    "erequestDisabledConfirmedAt",
  ],
} as const;

export type SettingsPanel = keyof typeof panelFields;

export function useSiteConfigurationForm() {
  const requestFetch = useRequestFetch();
  const errors = ref<Record<string, string>>({});
  const formValues = ref<NewSiteConfiguration | null>(null);
  const isNewConfig = ref(false);
  const showEmptyState = ref(false);
  const lastSuccessfulConnection = ref<Date | null>(null);
  const hadPreviousConfig = ref(false);

  const { user } = useUserSession();
  const memberships = computed(() => user.value?.memberships ?? []);
  const activeTenantId = computed(
    () => user.value?.activeTenantId ?? user.value?.tenantId ?? null,
  );
  const activeMembership = computed(() =>
    memberships.value.find(
      (membership) => membership.tenantId === activeTenantId.value,
    ),
  );
  const canManageTenant = computed(
    () =>
      user.value?.roles?.admin === "system" ||
      activeMembership.value?.role === "admin",
  );

  const savingPanels = ref<Record<SettingsPanel, boolean>>({
    connection: false,
    inbound: false,
    sms: false,
    ai: false,
    email: false,
    openApi: false,
    erequests: false,
  });

  onMounted(() => {
    const hasHadConfig = localStorage.getItem("hadSiteConfiguration") === "true";
    hadPreviousConfig.value = hasHadConfig;
  });

  const host = useRequestURL().host;
  const tokenEndpoint = computed(() => `${host}/api/oauth2/token`);
  const apiEndpoint = computed(() => `${host}/api/fhir/$process-message`);
  const cdsHookEndpoint = computed(() => `${host}/api/cds`);

  const { data: loadedData, status } = useAsyncData("site", async () => {
    return await requestFetch<{
      siteConfig: SiteConfiguration | null;
    }>(`/api/site-configuration`);
  });

  watch(
    () => loadedData.value,
    (data) => {
      if (status.value === "pending") return;
      const site = data?.siteConfig;
      if (!site) {
        formValues.value = {
          id: uuid(),
          name: "",
          clientId: uuid(),
          clientSecret: uuid(),
          oceanServer: "ocean",
          oceanSiteNum: "",
          oceanClientId: "",
          oceanClientSecret: "",
          erequestArchivalEnabled: false,
        };
        isNewConfig.value = true;
        showEmptyState.value = true;
      } else {
        localStorage.setItem("hadSiteConfiguration", "true");
        hadPreviousConfig.value = true;
        lastSuccessfulConnection.value = site.lastSuccessfulConnection ?? null;
        formValues.value = {
          id: site.id,
          name: site.name,
          clientId: site.clientId,
          clientSecret: site.clientSecret,
          oceanServer: site.oceanServer,
          oceanSiteNum: site.oceanSiteNum,
          oceanClientId: site.oceanClientId,
          oceanClientSecret: site.oceanClientSecret,
          smsProvider: site.smsProvider ?? null,
          twilioAccountSid: site.twilioAccountSid ?? "",
          twilioAuthToken: site.twilioAuthToken ?? "",
          twilioPhoneNumber: site.twilioPhoneNumber ?? "",
          smsSendAllowlist: site.smsSendAllowlist ?? [],
          aiProvider: site.aiProvider ?? "openai",
          aiApiKey: site.aiApiKey,
          aiModel: site.aiModel,
          emailProvider: site.emailProvider ?? "smtp2go",
          emailFromAddress: site.emailFromAddress ?? "",
          emailApiKey: site.emailApiKey ?? "",
          emailFromName: site.emailFromName ?? "",
          emailSendAllowlist: site.emailSendAllowlist ?? [],
          siteKey: site.siteKey ?? "",
          siteCredential: site.siteCredential ?? "",
          sharedEncryptionKey: site.sharedEncryptionKey ?? "",
          erequestArchivalEnabled: site.erequestArchivalEnabled ?? false,
          erequestEnabledConfirmedAt: site.erequestEnabledConfirmedAt ?? null,
          erequestDisabledConfirmedAt: site.erequestDisabledConfirmedAt ?? null,
        };
        showEmptyState.value = false;
      }
    },
    { immediate: true },
  );

  const oceanServerUrl = computed(() => {
    return getOceanServerUrl(formValues.value?.oceanServer ?? "ocean");
  });

  const isRecentSuccessfulInboundConnection = computed(() => {
    if (!lastSuccessfulConnection.value) return false;
    return (
      new Date().getTime() - new Date(lastSuccessfulConnection.value).getTime() <=
      24 * 60 * 60 * 1000
    );
  });

  function clearPanelErrors(panel: SettingsPanel) {
    for (const field of panelFields[panel]) {
      delete errors.value[field];
    }
  }

  function mapValidationErrors(error: any) {
    if (
      error.data?.data?.name === "ZodError" &&
      Array.isArray(error.data.data.issues)
    ) {
      error.data.data.issues.forEach(
        (issue: { path: string[]; message: string }) => {
          const fieldName = issue.path[issue.path.length - 1];
          if (fieldName) {
            errors.value[fieldName] = issue.message;
          }
        },
      );
      return true;
    }
    return false;
  }

  function panelHasChanges(panel: SettingsPanel) {
    if (!formValues.value) return false;
    const loadedSite = loadedData.value?.siteConfig;
    if (!loadedSite) return panel === "connection";

    return panelFields[panel].some((field) => {
      return (
        loadedSite[field as keyof SiteConfiguration] !== formValues.value?.[field]
      );
    });
  }

  function panelPayload(panel: SettingsPanel) {
    if (!formValues.value) return null;
    if (isNewConfig.value) {
      return formValues.value;
    }

    const payload: Record<string, unknown> = { id: formValues.value.id };
    for (const field of panelFields[panel]) {
      payload[field] = formValues.value[field];
    }

    if (panel === "erequests") {
      if (formValues.value.erequestArchivalEnabled) {
        payload.erequestEnabledConfirmedAt = new Date();
        payload.erequestDisabledConfirmedAt = null;
      } else {
        payload.erequestDisabledConfirmedAt = new Date();
      }
    }
    return payload;
  }

  async function savePanel(panel: SettingsPanel) {
    if (!canManageTenant.value) {
      errors.value.general =
        "Only tenant admins can update site configuration settings.";
      return;
    }

    const payload = panelPayload(panel);
    if (!payload) return;

    savingPanels.value[panel] = true;
    clearPanelErrors(panel);
    delete errors.value.general;

    try {
      loadedData.value = {
        siteConfig: await requestFetch<SiteConfiguration>("/api/site-configuration", {
          method: "POST",
          body: payload,
        }),
      };
      isNewConfig.value = false;
      toast.success("Settings saved");
    } catch (error: any) {
      console.error("Failed to save site configuration:", error);
      if (await handleMissingActiveTenantError(error)) {
        return;
      }
      if (error?.status === 403 || error?.data?.statusCode === 403) {
        errors.value.general =
          "Only tenant admins can update site configuration settings.";
        return;
      }
      const hasValidationErrors = mapValidationErrors(error);
      if (!hasValidationErrors) {
        errors.value.general = "Failed to save site configuration";
      }
    } finally {
      savingPanels.value[panel] = false;
    }
  }

  function handleCreateConfig() {
    showEmptyState.value = false;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", {
      description: "The value has been copied to your clipboard",
    });
  }

  const SECRET_MASK_CHARACTER = "•";

  function isMaskedSecretValue(value: string | null | undefined) {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      [...value].every((character) => character === SECRET_MASK_CHARACTER)
    );
  }

  return {
    // State
    errors,
    formValues,
    isNewConfig,
    showEmptyState,
    lastSuccessfulConnection,
    hadPreviousConfig,
    savingPanels,
    status,
    // Computed
    canManageTenant,
    oceanServerUrl,
    tokenEndpoint,
    apiEndpoint,
    cdsHookEndpoint,
    isRecentSuccessfulInboundConnection,
    user,
    // Methods
    panelHasChanges,
    savePanel,
    handleCreateConfig,
    copyToClipboard,
    isMaskedSecretValue,
  };
}
