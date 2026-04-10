import type { IActivityLogEntriesRepository } from "@/src/application/repositories/activity-log-entries.repository.interface";
import type { IHealthcareServicesRepository } from "@/src/application/repositories/healthcare-services.repository.interface";
import type {
  ILlmRuleDecisionAuditRepository,
  ILlmRuleToolExecutionAuditRepository
} from "@/src/application/repositories/llm-rule-decision-audit.repository.interface";
import type { IRoutingRulesRepository } from "@/src/application/repositories/routing-rules.repository.interface";
import type { ISiteConfigurationRepository } from "@/src/application/repositories/site-configuration.repository.interface";
import type { ITestServiceRequestsRepository } from "@/src/application/repositories/test-service-requests.repository.interface";
import type { IAiService } from "@/src/application/services/ai.service.interface";
import type { ICryptoService } from "@/src/application/services/crypto.service.interface";
import type { IPhiCryptoService } from "@/src/application/services/phi-crypto.service.interface";
import type { IDbService } from "@/src/application/services/db.service.interface";
import type { IOceanClientService } from "@/src/application/services/ocean-client.service.interface";
import type { IRoutingToolActionService } from "@/src/application/services/routing-tool-action.service.interface";
import { createHealthcareServicesRepository } from "@/src/infrastructure/repositories/healthcare-services.repository";
import { createRoutingRulesRepository } from "@/src/infrastructure/repositories/routing-rules.repository";
import { createSiteConfigurationRepository } from "@/src/infrastructure/repositories/site-configuration.repository";
import { createTestServiceRequestsRepository } from "@/src/infrastructure/repositories/test-service-requests.repository";
import { createAiService } from "@/src/infrastructure/services/ai.service";
import { createCryptoService } from "@/src/infrastructure/services/crypto.service";
import { createPhiCryptoService } from "@/src/infrastructure/services/phi-crypto.service";
import { createDbService } from "@/src/infrastructure/services/db.service";
import { createRoutingToolActionService } from "@/src/infrastructure/services/routing-tool-action.service";
import { createActivityLogEntriesRepository } from "@/src/infrastructure/repositories/activity-log-entries.repository";
import {
  createLlmRuleDecisionAuditRepository,
  createLlmRuleToolExecutionAuditRepository
} from "@/src/infrastructure/repositories/llm-rule-decision-audit.repository";
import { createOceanClientService } from "@/src/infrastructure/services/ocean-client.service";
import { UnauthenticatedError, UnauthorizedError } from "../errors/auth";
import {createLoggerFromEnv, type Logger} from "./logger";
import type { Session, SessionUser } from "./session";

export class ApplicationContext implements ApplicationContext {
  private session: Session;
  logger: Logger;
  private dbService?: IDbService;
  private cryptoService?: ICryptoService;
  private phiCryptoService?: IPhiCryptoService;
  private routingRulesRepository?: IRoutingRulesRepository;
  private healthcareServicesRepository?: IHealthcareServicesRepository;
  private testServiceRequestsRepository?: ITestServiceRequestsRepository;
  private siteConfigurationRepository?: ISiteConfigurationRepository;
  private activityLogEntriesRepository?: IActivityLogEntriesRepository;
  private aiService?: IAiService;
  private routingToolActionService?: IRoutingToolActionService;
  private oceanClientService?: IOceanClientService;
  private llmRuleDecisionAuditRepository?: ILlmRuleDecisionAuditRepository;
  private llmRuleToolExecutionAuditRepository?: ILlmRuleToolExecutionAuditRepository;

    constructor(logger?: Logger) {
        this.session = {
            user: null,
        };
        // Use provided logger or create one from LOG_LEVEL env (default 'info')
        this.logger = logger ?? createLoggerFromEnv();
    }

  appName(): string {
    return process.env.APP_NAME ?? "SnowDog Autorouter";
  }

  appUrl(): string {
    return process.env.HOST_URL ?? "unknown_app_url";
  }

  getDbService(): IDbService {
    if (!this.dbService) {
      this.dbService = createDbService({ cxt: this });
    }
    return this.dbService;
  }

  getAiService(): IAiService {
    if (!this.aiService) {
      this.aiService = createAiService({ cxt: this });
    }
    return this.aiService;
  }

  getUser(): SessionUser | null {
    return this.session.user;
  }

  getTenantId(): string | null {
    return this.session.user?.tenantId ?? null;
  }

  getNonEmptyTenantId(): string {
    const tenantId = this.session.user?.tenantId;
    if (!tenantId) {
      throw new UnauthenticatedError(
        "This call requires an active tenant in the session."
      );
    }
    return tenantId;
  }

  getSession(): Session {
    return this.session;
  }

  setSession(session: Session) {
    this.session = session;
  }

  ensureUser(tenantId?: string): void {
    if (!this.session.user) {
      throw new UnauthenticatedError("User not authenticated");
    }
    if (tenantId && this.session.user.tenantId !== tenantId) {
      throw new UnauthorizedError("User not authorized for tenant");
    }
  }

  getRoutingRulesRepository(): IRoutingRulesRepository {
    if (!this.routingRulesRepository) {
      this.routingRulesRepository = createRoutingRulesRepository({
        cxt: this,
      });
    }
    return this.routingRulesRepository!;
  }

  getHealthcareServicesRepository(): IHealthcareServicesRepository {
    if (!this.healthcareServicesRepository) {
      this.healthcareServicesRepository = createHealthcareServicesRepository({
        cxt: this,
      });
    }
    return this.healthcareServicesRepository!;
  }

  getTestServiceRequestsRepository(): ITestServiceRequestsRepository {
    if (!this.testServiceRequestsRepository) {
      this.testServiceRequestsRepository = createTestServiceRequestsRepository({
        cxt: this,
      });
    }
    return this.testServiceRequestsRepository;
  }

  getSiteConfigurationRepository(): ISiteConfigurationRepository {
    if (!this.siteConfigurationRepository) {
      this.siteConfigurationRepository = createSiteConfigurationRepository({
        cxt: this,
      });
    }
    return this.siteConfigurationRepository;
  }

  getRoutingToolActionService(): IRoutingToolActionService {
    if (!this.routingToolActionService) {
      this.routingToolActionService = createRoutingToolActionService({
        cxt: this,
      });
    }
    return this.routingToolActionService;
  }

  getCryptoService(): ICryptoService {
    if (!this.cryptoService) {
      this.cryptoService = createCryptoService({});
    }
    return this.cryptoService;
  }

  getPhiCryptoService(): IPhiCryptoService {
    if (!this.phiCryptoService) {
      this.phiCryptoService = createPhiCryptoService({});
    }
    return this.phiCryptoService;
  }

  getActivityLogEntriesRepository(): IActivityLogEntriesRepository {
    if (!this.activityLogEntriesRepository) {
      this.activityLogEntriesRepository = createActivityLogEntriesRepository({
        cxt: this,
      });
    }
    return this.activityLogEntriesRepository;
  }

  getOceanClientService(): IOceanClientService {
    if (!this.oceanClientService) {
      this.oceanClientService = createOceanClientService({ cxt: this });
    }
    return this.oceanClientService;
  }

  getLlmRuleDecisionAuditRepository(): ILlmRuleDecisionAuditRepository {
    if (!this.llmRuleDecisionAuditRepository) {
      this.llmRuleDecisionAuditRepository = createLlmRuleDecisionAuditRepository({
        cxt: this
      });
    }
    return this.llmRuleDecisionAuditRepository;
  }

  getLlmRuleToolExecutionAuditRepository(): ILlmRuleToolExecutionAuditRepository {
    if (!this.llmRuleToolExecutionAuditRepository) {
      this.llmRuleToolExecutionAuditRepository = createLlmRuleToolExecutionAuditRepository({
        cxt: this
      });
    }
    return this.llmRuleToolExecutionAuditRepository;
  }
}
