import type { WeightLog, WeightTargets } from "@glucoplate/types";
import { ApiError } from "../../lib/errors.js";
import { authRepository } from "../auth/auth.repository.js";
import {
  weightRepository,
  type WeightLogRow,
  type WeightTargetRow,
} from "./weight.repository.js";

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
   * The user's record is the source of truth for the targets, and this
   * service keeps its own copy as well. The copy wins, then the user
   * record, then the most recent weight log.
   */
  async getTargets(userId: number): Promise<WeightTargets> {
    const local = await weightRepository.findTarget(userId);
    const user = await authRepository.findById(userId);

    let currentWeight =
      local?.currentWeight ?? user?.currentWeight ?? null;
    const targetWeight = local?.targetWeight ?? user?.targetWeight ?? null;

    if (currentWeight === null) {
      const latest = await weightRepository.latestByUser(userId);
      currentWeight = latest ? latest.weight : null;
    }

    return { currentWeight, targetWeight };
  },

  /**
   * Stores the caller's weight targets.
   *
   * Both the user's record and this service's own copy are written, so the
   * values are the same whichever one is read.
   */
  async updateTargets(
    userId: number,
    body: { currentWeight?: unknown; targetWeight?: unknown },
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

    await authRepository.update(userId, {
      currentWeight,
      targetWeight,
      updatedAt: new Date(),
    });

    return targets;
  },
};
