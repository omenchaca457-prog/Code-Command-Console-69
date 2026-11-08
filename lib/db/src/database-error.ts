export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";

  constructor() {
    super("Database persistence is not configured.");
    this.name = "DatabaseUnavailableError";
  }
}
