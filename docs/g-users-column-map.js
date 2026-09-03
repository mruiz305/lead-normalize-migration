/**
 * Índice maestro: columna g_users → tabla/campo destino (TNFG_INTAKE).
 * Fuente para schema-dictionary (React), Word y scripts copy-users / backfill.
 */

const G_USERS_COLUMN_GROUPS = [
  {
    id: 'identity',
    title: 'Identidad y acceso',
    subtitle: 'copy-users → app_user',
    rows: [
      ['id', 'app_user.id_user', 'PK preservada (legacy id)'],
      ['rowId', 'app_user.legacy_row_id', 'Glide rowID'],
      ['name', 'app_user.display_name', ''],
      ['email', 'app_user.email', 'UK; dedup por email → user_hr_period'],
      ['phone', 'app_user.phone + user_channel PHONE_MOBILE', ''],
      ['title', 'app_user.id_job_title → ref_job_title', 'Texto → FK'],
      ['systemAccessLevel', 'app_user.access_level', ''],
      ['office', 'app_user.id_company_office → ref_company_office', 'Código oficina → FK'],
      ['SubOffice', 'app_user.id_sub_office → ref_sub_office', 'Plaza/mercado → FK (catálogo propio)'],
      ['systemDepartment', 'app_user.id_department → ref_department', 'Texto → FK'],
      ['rank', 'app_user.id_rank → ref_rank', 'Texto → FK'],
      ['picture', 'app_user.picture', ''],
      ['hrEeType', 'app_user.hr_ee_type', ''],
      ['dob', 'app_user.dob', ''],
      ['hrStatus', 'app_user.hr_status', 'Vigente; pasadas en user_hr_period'],
      ['hrHired', 'app_user.hired_at', 'Pasada actual'],
      ['hrTermed', 'app_user.termed_at', 'Pasada actual'],
    ],
  },
  {
    id: 'compensation',
    title: 'Compensación HR',
    subtitle: 'copy-users + backfill:app-user-deal-paylocity',
    rows: [
      ['hrDealAmount', 'app_user.hr_deal_amount', ''],
      ['hrBudget', 'app_user.hr_budget', ''],
      ['boostBudget', 'app_user.boost_budget', ''],
      ['managementPay', 'app_user.management_pay', ''],
      [
        'DealGoal',
        'app_user.hr_deal_goal',
        'Fuente principal en prod (~1.5K reps). Prioridad sobre hrDealGoal (casi siempre 0)',
      ],
      ['hrDealGoal', 'app_user.hr_deal_goal', 'Fallback si DealGoal vacío/cero'],
      [
        'DealGoalCustom',
        'app_user.hr_deal_goal_custom',
        'Meta custom Glide (~1.4K reps). Patch jul 2026',
      ],
      [
        'paylocityId',
        'app_user.paylocity_id',
        'Payroll / machine output / rep_machine_output (~1.4K reps). Patch jul 2026',
      ],
    ],
  },
  {
    id: 'hierarchy',
    title: 'Jerarquía operativa',
    subtitle: 'populateHierarchyMembership → hierarchy_membership',
    rows: [
      ['hierarchyDirectorate', 'hierarchy_membership (DIRECTORATE)', 'leader_user_id por email'],
      ['hierarchyRegion', 'hierarchy_membership (REGION)', ''],
      ['hierarchyOffice', 'hierarchy_membership (OFFICE)', ''],
      ['hierarchyPod', 'hierarchy_membership (POD)', ''],
      ['hierarchyTeam', 'hierarchy_membership (TEAM)', ''],
      ['hierarchyDuo', 'hierarchy_membership (DUO)', ''],
      [
        'hierarchySpecialAccessZc',
        '— (pendiente)',
        'Considerar user_access_grant; ~2.8K usuarios en prod',
      ],
      [
        'hierarchySpecialAccessCd',
        '— (pendiente)',
        'Considerar user_access_grant; ~2.8K usuarios en prod',
      ],
    ],
  },
  {
    id: 'contact',
    title: 'Contacto y redes',
    subtitle: 'syncUserChannelsFromGUsers → user_channel',
    rows: [
      ['email', 'user_channel EMAIL_WORK', 'Duplicado lógico con app_user.email'],
      ['phone', 'user_channel PHONE_MOBILE', ''],
      ['fbHandle', 'user_channel SOCIAL_FACEBOOK', ''],
      ['igHandle', 'user_channel SOCIAL_INSTAGRAM', ''],
    ],
  },
  {
    id: 'ops_urls',
    title: 'URLs operativas',
    subtitle: 'copy-users / patch:app-user-doc-urls',
    rows: [
      ['logsIndividualFile', 'app_user.individual_log_url', ''],
      ['rosterIndividualFile', 'app_user.roster_file_url', ''],
      ['machineIndividual', 'app_user.machine_file_url', ''],
      ['leadSheetURL', 'app_user.lead_sheet_url', ''],
      ['individualLeadSheetURL', 'app_user.individual_lead_sheet_url', ''],
    ],
  },
  {
    id: 'not_migrated',
    title: 'Sin migrar (baja prioridad o pendiente diseño)',
    subtitle: 'Estado Glide / UI — no copiados por copy-users',
    rows: [
      ['nick', '—', 'Display alternativo (~2.8K)'],
      ['systemKeyLeadLinker', '—', 'Integración linker (~2.8K)'],
      ['mediaIdMedia', '—', 'Media perfil (~772)'],
      ['shift', '—', 'Preferencia UI'],
      ['chartsHideVisuals*', '—', 'Preferencias dashboard'],
      ['profileShow*', '—', 'Preferencias perfil'],
      ['intakePanelView*', '—', 'Preferencias intake panel'],
      ['agreedtoT&C / signedtoT&C', '—', 'Términos Glide'],
    ],
  },
];

function renderMarkdownSection() {
  const lines = [
    '## Índice completo: columna `g_users` → destino',
    '',
    'Staff representantes (~2.5K filas). Script: `npm run copy-users` · backfill compensación: `npm run backfill:app-user-deal-paylocity`.',
    '',
  ];

  for (const g of G_USERS_COLUMN_GROUPS) {
    lines.push(`### ${g.title}`);
    if (g.subtitle) lines.push(`*${g.subtitle}*`, '');
    lines.push('| Columna g_users | Destino TNFG | Notas |');
    lines.push('|-----------------|-------------------|-------|');
    for (const [src, dest, note] of g.rows) {
      lines.push(`| \`${src}\` | ${dest} | ${note || ''} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { G_USERS_COLUMN_GROUPS, renderMarkdownSection };
