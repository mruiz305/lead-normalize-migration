/**
 * Igual que tnfg-datamart-etl / PerformanceRosterSenderMail:
 * la expression sale SOLO de tblCronConfig + tblCron (origen).
 * No usa CRON_EXPRESSION del .env.
 */
const cron = require('node-cron');
const { sourcePool } = require('../db');

class CronManager {
  constructor(scriptCode, taskFn, opts = {}) {
    this.scriptCode = scriptCode;
    this.taskFn = taskFn;
    this.watchInterval = opts.watchInterval || 60_000;
    this.currentExpr = null;
    this.task = null;
    this.poller = null;
  }

  async _fetchConfig() {
    const conn = await sourcePool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT c.expression
           FROM tblCronConfig cc
           JOIN tblCron c ON cc.cron_config_id = c.id
          WHERE cc.script_code = ?
            AND c.is_active    = 1
          LIMIT 1`,
        [this.scriptCode]
      );
      return rows[0] || null;
    } finally {
      conn.release();
    }
  }

  async _reloadIfNeeded() {
    const cfg = await this._fetchConfig();
    if (!cfg) {
      console.warn(`No active cron config for "${this.scriptCode}"`);
      return;
    }

    const expression = String(cfg.expression).trim().replace(/\s+/g, ' ');
    if (expression === this.currentExpr) return;

    if (!cron.validate(expression)) {
      console.error(`Cron expression inválida para "${this.scriptCode}": ${expression}`);
      return;
    }

    if (this.task) {
      console.log(`⟳ Updating "${this.scriptCode}" schedule: ${this.currentExpr} → ${expression}`);
      this.task.destroy();
    } else {
      console.log(`✓ Scheduling "${this.scriptCode}" at ${expression}`);
    }

    this.task = cron.schedule(expression, this.taskFn, { scheduled: true });
    this.currentExpr = expression;
  }

  async start() {
    await this._reloadIfNeeded();
    this.poller = setInterval(() => {
      this._reloadIfNeeded().catch((err) =>
        console.error(`Error reloading cron for "${this.scriptCode}":`, err)
      );
    }, this.watchInterval);
  }

  stop() {
    clearInterval(this.poller);
    if (this.task) this.task.destroy();
  }
}

module.exports = CronManager;
