export class ScuroSdkError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class MissingDeploymentLabelError extends ScuroSdkError {
  constructor(label: string) {
    super("MISSING_DEPLOYMENT_LABEL", `Missing deployment label: ${label}`, { label });
  }
}

export class UnknownEnumValueError extends ScuroSdkError {
  constructor(enumName: string, value: number | bigint) {
    super("UNKNOWN_ENUM_VALUE", `Unknown enum value for ${enumName}: ${value.toString()}`, {
      enumName,
      value: value.toString()
    });
  }
}

export class InvalidLifecycleStateError extends ScuroSdkError {
  constructor(message: string, details?: unknown) {
    super("INVALID_LIFECYCLE_STATE", message, details);
  }
}

export class ExpiredDeadlineError extends ScuroSdkError {
  constructor(deadlineAt: bigint) {
    super("EXPIRED_DEADLINE", `Deadline has expired at ${deadlineAt.toString()}`, {
      deadlineAt: deadlineAt.toString()
    });
  }
}

export class MissingWalletClientError extends ScuroSdkError {
  constructor() {
    super("MISSING_WALLET_CLIENT", "A wallet client is required for this write operation.");
  }
}

export class UnsupportedFactoryFamilyError extends ScuroSdkError {
  constructor(family: string) {
    super("UNSUPPORTED_FACTORY_FAMILY", `Unsupported factory family: ${family}`, { family });
  }
}

