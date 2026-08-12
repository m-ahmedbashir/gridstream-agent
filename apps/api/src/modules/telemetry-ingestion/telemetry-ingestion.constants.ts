/**
 * Split out from telemetry-ingestion.module.ts on purpose: the module file
 * imports the services below, and if this constant lived there too, each
 * service importing it back would create a circular import. At module-load
 * time that leaves TELEMETRY_QUEUE still `undefined` when the @InjectQueue()
 * decorator runs (decorators execute as the class is defined, before the
 * cycle resolves) — NestJS then silently falls back to a "default" queue
 * token instead of "telemetry", and DI resolution fails at boot with
 * `Nest can't resolve dependencies... "BullQueue_default"`. Caught by
 * actually booting the compiled app, not by typecheck or unit tests (which
 * mock the queue directly and never exercise real DI resolution).
 */
export const TELEMETRY_QUEUE = 'telemetry';
