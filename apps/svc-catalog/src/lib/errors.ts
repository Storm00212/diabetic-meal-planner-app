/**
 * A single error shape for every endpoint.
 *
 * Handlers throw `ApiError`; the error middleware turns it into
 * `{ error, code, requestId }`. Nothing else should write an error response.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Authentication required.") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message = "You do not have access to that resource.") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Not found.") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "conflict", message);
  }
  static internal(message = "Something went wrong.") {
    return new ApiError(500, "internal_error", message);
  }
}
