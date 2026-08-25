/**
 * Backfill TNFG_INTAKE.app_user.id_persona desde SECURITY user_external_links.
 */

const config = require('../config');

async function linkAppUserPersona({ dryRun = false } = {}) {
  const secDb = config.security.database;
  const tgtDb = config.target.database;
  const { withSecurity, withTarget, closeAll } = require('../db');

  let linked = 0;
  let already = 0;
  let origins = 0;

  await withSecurity(async (secConn) => {
    const [originRows] = await secConn.query(
      `SELECT user_id, external_id
       FROM \`${secDb}\`.user_external_links
       WHERE source_system = 'INTAKE_APP_USER'`
    );
    origins = originRows.length;
    if (!originRows.length) {
      await closeAll();
      return { origins: 0, linked: 0, already: 0, missingUser: 0, dryRun };
    }

    await withTarget(async (tgtConn) => {
      const [[{ hasCol }]] = await tgtConn.query(
        `SELECT COUNT(*) AS hasCol FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_user' AND COLUMN_NAME = 'id_persona'`,
        [tgtDb]
      );
      if (!hasCol) {
        throw new Error(
          'Falta columna app_user.id_persona — ejecutá: npm run patch:app-user-persona'
        );
      }

      const [[{ alreadyLinked }]] = await tgtConn.query(
        `SELECT COUNT(*) AS alreadyLinked FROM \`${tgtDb}\`.app_user WHERE id_persona IS NOT NULL`
      );
      already = Number(alreadyLinked);

      if (dryRun) {
        const ph = originRows.map(() => '?').join(',');
        const ids = originRows.map((r) => Number(r.external_id));
        const [[{ wouldLink }]] = await tgtConn.query(
          `SELECT COUNT(*) AS wouldLink FROM \`${tgtDb}\`.app_user
           WHERE id_user IN (${ph}) AND (id_persona IS NULL OR id_persona = 0)`,
          ids
        );
        linked = Number(wouldLink);
        return;
      }

      const BATCH = 500;
      for (let i = 0; i < originRows.length; i += BATCH) {
        const chunk = originRows.slice(i, i + BATCH);
        const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
        const ids = chunk.flatMap((r) => [Number(r.external_id), r.user_id]);
        const inPh = chunk.map(() => '?').join(',');
        const inIds = chunk.map((r) => Number(r.external_id));

        const [result] = await tgtConn.query(
          `UPDATE \`${tgtDb}\`.app_user
           SET id_persona = CASE id_user ${cases} END
           WHERE id_user IN (${inPh})`,
          [...ids, ...inIds]
        );
        linked += result.affectedRows;
      }

      const [[{ totalLinked }]] = await tgtConn.query(
        `SELECT COUNT(*) AS totalLinked FROM \`${tgtDb}\`.app_user WHERE id_persona IS NOT NULL`
      );
      already = Number(totalLinked);
    });
  });

  await closeAll();
  return { origins, linked, totalWithPersona: already, dryRun };
}

module.exports = { linkAppUserPersona };
