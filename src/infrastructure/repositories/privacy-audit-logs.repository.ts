import { desc, eq } from "drizzle-orm";
import { privacyAuditLog as table } from "@/drizzle/schema";
import type { IPrivacyAuditLogsRepository } from "@/src/application/repositories/privacy-audit-logs.repository.interface";
import type {
  NewPrivacyAuditLog,
  PrivacyAuditLog,
} from "@/src/entities/models/privacy-audit-log";
import { privacyAuditLogSchema } from "@/src/entities/models/privacy-audit-log";
import type { ApplicationContext } from "@/src/entities/models/application-context";

type Dependencies = {
  cxt: ApplicationContext;
};

function parseSensitiveData(value: string | null, cxt: ApplicationContext) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(cxt.getCryptoService().decrypt(value));
  } catch (error) {
    cxt.logger.warn("Failed to decrypt privacy audit payload", error);
    return null;
  }
}

function mapToEntity(
  record: typeof table.$inferSelect,
  cxt: ApplicationContext
): PrivacyAuditLog {
  return privacyAuditLogSchema.parse({
    ...record,
    sensitiveData: parseSensitiveData(record.sensitiveDataEncrypted, cxt),
  });
}

export function createPrivacyAuditLogsRepository({
  cxt,
}: Dependencies): IPrivacyAuditLogsRepository {
  const dbService = cxt.getDbService();
  const cryptoService = cxt.getCryptoService();

  return {
    async listAtTenant(options = {}) {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 25;
      const where = options.eventType
        ? eq(table.eventType, options.eventType)
        : undefined;

      const [items, total] = await Promise.all([
        dbService.findMany(table, {
          where,
          orderBy: desc(table.createdAt),
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        dbService.count(table, { where }),
      ]);

      return {
        items: items.map((item) => mapToEntity(item, cxt)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    async create(record: NewPrivacyAuditLog) {
      const sensitiveDataEncrypted =
        record.sensitiveData === undefined || record.sensitiveData === null
          ? null
          : cryptoService.encrypt(JSON.stringify(record.sensitiveData));

      await dbService.insert(
        table,
        dbService.initMetadataAndTenant({
          actorUserId: record.actorUserId ?? null,
          actorName: record.actorName ?? null,
          actorProvider: record.actorProvider ?? null,
          eventType: record.eventType,
          subjectType: record.subjectType ?? null,
          subjectId: record.subjectId ?? null,
          summary: record.summary,
          sensitiveDataEncrypted,
        })
      );
    },
  };
}
