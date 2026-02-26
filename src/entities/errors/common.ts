export interface HttpStatusError {
  getStatus(): number;
}

export class DatabaseOperationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class AppInitializationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class IOError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class NotFoundError extends Error implements HttpStatusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 404;
  }
}

export class InputParseError extends Error implements HttpStatusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 400;
  }
}

export class InvalidArgumentsError extends Error implements HttpStatusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 400;
  }
}

export class ConflictingIdentifierError
  extends Error
  implements HttpStatusError
{
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
  getStatus() {
    return 409;
  }
}

type NonPromise<T> = T extends Promise<unknown> ? never : T;

export function isError<T>(obj: NonPromise<T>): obj is Error & NonPromise<T> {
  return obj && !!(obj as unknown as { message: string }).message;
}
