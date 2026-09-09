/** Evita que src/config.js falle si no hay .env al cargar pipeline/catálogos. */
process.env.MIG_TARGET_HOST ||= "127.0.0.1";
process.env.MIG_TARGET_DATABASE ||= "tnfg_intake_test";
process.env.MIG_TARGET_USER ||= "test";
process.env.MIG_TARGET_PASSWORD ||= "";
