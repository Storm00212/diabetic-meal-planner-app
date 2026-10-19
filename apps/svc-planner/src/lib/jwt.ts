import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";
import { ApiError } from "./errors.js";

export type AccessTokenClaims = {
  /** User id, as a string (JWT `sub` must be a string). */
  sub: string;
  email: string;
  role: string;
};

function secret(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

/** Signs a stateless access token. */
export async function signAccessToken(user: {
  id: number;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuer("glucoplate")
    .setAudience("glucoplate-api")
    .setIssuedAt()
    .setExpirationTime(`${config.tokenTtlSeconds}s`)
    .sign(secret());
}

/**
 * Verifies a token.
 *
 * Every service in the monorepo runs this same check, so a token minted by
 * svc-auth is accepted by svc-catalog, svc-planner and svc-health.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "glucoplate",
      audience: "glucoplate-api",
      algorithms: ["HS256"],
    });

    if (!payload.sub) return null;

    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      role: String(payload.role ?? "user"),
    };
  } catch {
    return null;
  }
}

/** Reads a bearer token out of an `Authorization` header. */
export function readBearerToken(header: string | undefined | null): string | null {
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Throws a 401 unless the token is valid. */
export async function requireClaims(
  header: string | undefined | null,
): Promise<AccessTokenClaims> {
  const token = readBearerToken(header);
  if (!token) throw ApiError.unauthorized("Missing bearer token.");

  const claims = await verifyAccessToken(token);
  if (!claims) throw ApiError.unauthorized("Invalid or expired access token.");

  return claims;
}
