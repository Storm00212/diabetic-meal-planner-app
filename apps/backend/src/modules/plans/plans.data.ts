import type { Dish, PublicUser } from "@glucoplate/types";
import { ApiError } from "../../lib/errors.js";
import { authRepository } from "../auth/auth.repository.js";
import { toPublicUser } from "../auth/auth.service.js";
import { dishRepository } from "../dish/dish.repository.js";
import { toDish } from "../dish/dish.service.js";

/**
 * The data the planner needs, read straight from the database.
 *
 * The catalogue and the user record used to live in other services and had to
 * be fetched over HTTP — with a cache, a timeout and a fallback, because a
 * sleeping downstream service must not make the caller wait. Now that
 * everything is one process and one database, those are two ordinary queries.
 */

/** The dish catalogue: the shared Kenyan one plus the caller's own dishes. */
export async function fetchCatalogue(userId: number): Promise<Dish[]> {
  const rows = await dishRepository.findVisibleTo(userId);
  return rows.map(toDish);
}

/** The signed-in user's clinical limits. */
export async function fetchUser(userId: number): Promise<PublicUser> {
  const user = await authRepository.findById(userId);
  if (!user) throw ApiError.notFound("User not found.");
  return toPublicUser(user);
}
