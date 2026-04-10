import type { HttpStatusError } from "./common";

interface ErrorOptions {
  cause?: unknown;
}
export class AuthenticationError extends Error implements HttpStatusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 401;
  }
}

export class UnauthenticatedError extends Error implements HttpStatusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 401;
  }
}

export class UnauthorizedError extends Error implements HttpStatusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 403;
  }
}
