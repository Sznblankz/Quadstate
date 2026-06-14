/**
 * Hard limits of schema version 1. Files declaring `schemaVersion: 1` are
 * always validated against these values regardless of what later schema
 * versions may allow (version-gated, per the architecture plan).
 */
export const SCHEMA_VERSION = 1;

/** Maximum width of any pin or net, in bits. */
export const MAX_BUS_WIDTH = 64;

/** Maximum total input bits of a behavioral truth table (2^16 rows). */
export const MAX_TT_INPUT_BITS = 16;
