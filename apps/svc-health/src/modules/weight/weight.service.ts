import type { WeightLog, WeightTargets } from "@glucoplate/types";
import { ApiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { config } from "../../config.js";
import {
  weightRepository,
  type WeightLogRow,
  type WeightTargetRow,
} from "./weight.repository.js";

/** The part of the auth service's user record this service cares about. */
type AuthUserLike = {
  currentWeight?: number | null;
  targetWeight?: number | null;
};

/** Turns a stored row into the shared `WeightLog` contract. */
function toWeightLog(row: WeightLogRow): WeightLog {
  return {
    id: row.id,
    userId: row.userId,
    weight: row.weight,
    date: row.date.toISOString(),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Today at UTC midnight — the default day for a new weight log. */
export function todayUtcMidnight(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Parses a user supplied day into a UTC midnight date.
 *
 * The column is a `date`, so the time of day never matters. Returns `null`
 * when the value cannot be understood.
 */
export function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;

  const text = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = dateOnly ? new Date(`${text}T00:00:00.000Z`) : new Date(text);

  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

/** Reads the caller's weight from the auth service, which owns the user. */
async function fetchAuthUser(
  authorization: string | undefined,
): Promise<AuthUserLike | null> {
  try {
    const response = await fetch(`${config.svcAuthUrl}/api/auth/me`, {
      headers: { Authorization: authorization ?? "" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn("svc-auth /api/auth/me returned a non-OK status", {
        status: response.status,
      });
      return null;
    }

    const payload = (await response.json()) as
      | (AuthUserLike & { user?: AuthUserLike })
      | null;

    if (!payload || typeof payload !== "object") return null;

    return payload.user ?? payload;
  } catch (error) {
    logger.warn("svc-auth /api/auth/me is unreachable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Asks the auth service to store the weight targets as well.
 *
 * `PATCH /api/settings` on svc-auth does not accept the weight fields yet,
 * so the call is best effort: a failure here must never lose the targets,
 * because this service keeps its own copy of them.
 */
async function pushTargetsToAuth(
  authorization: string | undefined,
  targets: WeightTargets,
): Promise<void> {
  try {
    const response = await fetch(`${config.svcAuthUrl}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization ?? "",
      },
      body: JSON.stringify({
        currentWeight: targets.currentWeight,
        targetWeight: targets.targetWeight,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn("svc-auth /api/settings rejected the weight targets", {
        status: response.status,
      });
    }
  } catch (error) {
    logger.warn("svc-auth /api/settings is unreachable", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Reads a weight from a request body, rejecting anything unusable. */
function parseWeight(value: unknown, field = "weight"): number {
  const weight = Number(value);

  if (!Number.isFinite(weight) || weight <= 0) {
    throw ApiError.badRequest(`A positive ${field} in kilograms is required.`);
  }

  return weight;
}

export const weightService = {
  /** Every weight log for the caller, newest day first. */
  async listLogs(userId: number): Promise<WeightLog[]> {
    const rows = await weightRepository.listByUser(userId);
    return rows.map(toWeightLog);
  },

  /** Records a new weight log for the caller. */
  async createLog(
    userId: number,
    body: { weight?: unknown; date?: unknown; note?: unknown },
  ): Promise<WeightLog> {
    const weight = parseWeight(body.weight);

    const parsedDate = body.date === undefined ? null : parseDate(body.date);
    if (body.date !== undefined && body.date !== null && body.date !== "" && !parsedDate) {
      throw ApiError.badRequest("date must be a valid date.");
    }

    const note = body.note === undefined || body.note === null
      ? ""
      : String(body.note).slice(0, 500);

    const row = await weightRepository.create({
      userId,
      weight,
      date: parsedDate ?? todayUtcMidnight(),
      note,
    });

    return toWeightLog(row);
  },

  /**
   * The caller's weight targets.
   *
   * The values live on the user record in svc-auth, so they are read from
   * there. This service keeps its own copy too, because svc-auth does not
   * accept the weight fields yet. The copy wins, then the auth service, then
   * the most recent weight log.
   */
  async getTargets(
    userId: number,
    authorization: string | undefined,
  ): Promise<WeightTargets> {
    const local = await weightRepository.findTarget(userId);
    const auth = await fetchAuthUser(authorization);

    let currentWeight =
      local?.currentWeight ?? auth?.currentWeight ?? null;
    const targetWeight = local?.targetWeight ?? auth?.targetWeight ?? null;

    if (currentWeight === null) {
      const latest = await weightRepository.latestByUser(userId);
      currentWeight = latest ? latest.weight : null;
    }

    return { currentWeight, targetWeight };
  },

  /**
   * Stores the caller's weight targets.
   *
   * The local row is the source of truth; the auth service is told as well,
   * but it may ignore the fields.
   */
  async updateTargets(
    userId: number,
    body: { currentWeight?: unknown; targetWeight?: unknown },
    authorization: string | undefined,
  ): Promise<WeightTargets> {
    const local: WeightTargetRow | null =
      await weightRepository.findTarget(userId);

    const currentWeight =
      body.currentWeight === undefined
        ? (local?.currentWeight ?? null)
        : body.currentWeight === null
          ? null
          : parseWeight(body.currentWeight, "currentWeight");

    const targetWeight =
      body.targetWeight === undefined
        ? (local?.targetWeight ?? null)
        : body.targetWeight === null
          ? null
          : parseWeight(body.targetWeight, "targetWeight");

    const targets: WeightTargets = { currentWeight, targetWeight };

    await weightRepository.upsertTarget(userId, {
      currentWeight,
      targetWeight,
    });

    logger.warn(
      "svc-auth /api/settings does not persist weight targets yet; stored them locally",
      { userId },
    );

    await pushTargetsToAuth(authorization, targets);

    return targets;
  },
};
