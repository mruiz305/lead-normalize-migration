#!/usr/bin/env node
/**
 * Genera docs/TNFG_Modelo_Normalizado.pptx — diseño corporativo TNFG Representatives
 */
const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');
const { TBLLEADS_COLUMN_GROUPS } = require('../docs/tblLeads-column-map');
const { MIGRATION_PIPELINE, MIGRATION_SOURCES, MIGRATION_CORRESPONDENCE_OVERVIEW } = require('../docs/migration-flow-map');

const OUT = path.join(__dirname, '../docs/TNFG_Modelo_Normalizado.pptx');
const LOGO = path.join(__dirname, '../docs/assets/tnfg-logo.png');
const LOGO_ASPECT = 140 / 388; // h/w tras trim del PNG

async function ensureTransparentLogo() {
  if (!fs.existsSync(LOGO)) return;
  const { processLogoTransparent } = require('./process-logo');
  await processLogoTransparent(LOGO);
}

function addLogo(s, x, y, w) {
  if (!fs.existsSync(LOGO)) return;
  s.addImage({ path: LOGO, x, y, w, h: w * LOGO_ASPECT });
}

const T = {
  navy: '0F2744',
  navyMid: '1E3A5F',
  teal: '0891B2',
  tealDark: '0E7490',
  tealLight: 'E0F7FA',
  slate: '334155',
  muted: '64748B',
  border: 'CBD5E1',
  white: 'FFFFFF',
  bg: 'F8FAFC',
  green: '059669',
  greenBg: 'ECFDF5',
  amber: 'D97706',
  amberBg: 'FFFBEB',
  violet: '7C3AED',
  violetBg: 'F5F3FF',
  rose: 'E11D48',
  roseBg: 'FFF1F2',
};

let slideNum = 0;

function deckChrome(s, pptx, { title, subtitle, section }) {
  slideNum += 1;
  s.background = { color: T.bg };

  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.08,
    fill: { color: T.teal }, line: { color: T.teal },
  });
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0.08, w: 0.12, h: 5.55,
    fill: { color: T.navy }, line: { color: T.navy },
  });

  if (section) {
    s.addText(section.toUpperCase(), {
      x: 0.45, y: 0.28, w: 4, h: 0.25,
      fontSize: 9, bold: true, color: T.teal, charSpacing: 2,
    });
  }

  s.addText(title, {
    x: 0.45, y: section ? 0.52 : 0.35, w: 8.8, h: 0.55,
    fontSize: 26, bold: true, color: T.navy, fontFace: 'Arial',
  });

  if (subtitle) {
    s.addText(subtitle, {
      x: 0.45, y: section ? 1.05 : 0.88, w: 8.8, h: 0.35,
      fontSize: 12, color: T.muted, fontFace: 'Arial',
    });
  }

  s.addShape(pptx.shapes.LINE, {
    x: 0.45, y: subtitle ? 1.42 : 1.05, w: 9.0, h: 0,
    line: { color: T.border, width: 0.75 },
  });

  addLogo(s, 7.15, 0.12, 2.55);

  s.addText('Normalización tblLeads · TNFG', {
    x: 0.45, y: 5.25, w: 5, h: 0.25,
    fontSize: 8, color: T.muted, fontFace: 'Arial',
  });
  s.addText(String(slideNum), {
    x: 9.1, y: 5.25, w: 0.5, h: 0.25,
    fontSize: 8, color: T.muted, align: 'right', fontFace: 'Arial',
  });

  return subtitle ? 1.55 : 1.2;
}

function coverSlide(pptx) {
  slideNum += 1;
  const s = pptx.addSlide();
  s.background = { color: T.navy };

  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { color: T.navyMid, transparency: 40 }, line: { color: T.navy },
  });
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 4.85, w: 10, h: 0.775,
    fill: { color: T.teal }, line: { color: T.teal },
  });
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0.6, y: 1.35, w: 0.08, h: 2.2,
    fill: { color: T.teal }, line: { color: T.teal },
  });

  addLogo(s, 0.85, 0.45, 3.4);

  s.addText('Modelo de Datos\nRepresentatives Normalizado', {
    x: 0.85, y: 1.55, w: 8.5, h: 1.4,
    fontSize: 40, bold: true, color: T.white, fontFace: 'Arial',
  });
  s.addText('Migración tblLeads → TNFG', {
    x: 0.85, y: 3.1, w: 8, h: 0.45,
    fontSize: 18, color: T.tealLight, fontFace: 'Arial',
  });
  s.addText('Arquitectura relacional · Junio 2026', {
    x: 0.85, y: 5.05, w: 8, h: 0.35,
    fontSize: 11, color: T.white, fontFace: 'Arial',
  });
}

function sectionSlide(pptx, num, title, subtitle) {
  slideNum += 1;
  const s = pptx.addSlide();
  s.background = { color: T.navyMid };

  addLogo(s, 7.0, 0.35, 2.6);

  s.addText(String(num).padStart(2, '0'), {
    x: 0.7, y: 1.6, w: 2, h: 1.2,
    fontSize: 72, bold: true, color: T.teal, fontFace: 'Arial',
  });
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0.7, y: 2.85, w: 2.5, h: 0.06,
    fill: { color: T.teal }, line: { color: T.teal },
  });
  s.addText(title, {
    x: 0.7, y: 3.05, w: 8.5, h: 0.8,
    fontSize: 32, bold: true, color: T.white, fontFace: 'Arial',
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.7, y: 3.85, w: 8, h: 0.5,
      fontSize: 14, color: '94A3B8', fontFace: 'Arial',
    });
  }
}

function agendaSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Agenda',
    title: 'Contenido de la presentación',
    subtitle: 'Visión ejecutiva y detalle técnico del modelo destino',
  });

  const items = [
    ['01', 'Contexto y objetivos', 'Por qué normalizar tblLeads'],
    ['02', 'Arquitectura del modelo', 'Capas, entidades y relaciones'],
    ['03', 'Diccionario de tablas', 'Qué almacena cada tabla del modelo'],
    ['04', 'Reglas de negocio', 'Org congelada vs jerarquía actual del usuario'],
    ['05', 'Mapeo de datos', 'Índice columna tblLeads → destino'],
    ['06', 'Estado y roadmap', 'Migración completa y siguientes pasos'],
  ];

  items.forEach(([num, title, desc], i) => {
    const y = top + 0.08 + i * 0.58;
    s.addShape(pptx.shapes.RECTANGLE, {
      x: 0.55, y, w: 8.9, h: 0.52,
      fill: { color: i % 2 === 0 ? T.white : T.tealLight }, line: { color: T.border, pt: 0.5 },
    });
    s.addText(num, {
      x: 0.75, y: y + 0.1, w: 0.6, h: 0.32,
      fontSize: 16, bold: true, color: T.teal, fontFace: 'Arial',
    });
    s.addText(title, {
      x: 1.45, y: y + 0.06, w: 4, h: 0.26,
      fontSize: 13, bold: true, color: T.navy, fontFace: 'Arial',
    });
    s.addText(desc, {
      x: 1.45, y: y + 0.28, w: 7, h: 0.22,
      fontSize: 10, color: T.muted, fontFace: 'Arial',
    });
  });
}

function statCardsSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Contexto',
    title: 'El reto en números',
    subtitle: 'dbProduction.tblLeads — origen legacy del portal de representantes',
  });

  const stats = [
    { val: '189', label: 'Columnas por fila', sub: 'Tabla ancha monolítica' },
    { val: '147K', label: 'Leads en producción', sub: 'Solo lectura en migración' },
    { val: '19+', label: 'Tablas destino', sub: 'Modelo relacional normalizado' },
    { val: '~148K', label: 'Leads migrados', sub: 'TNFG — migración completa (Jun 2026)' },
  ];

  stats.forEach((st, i) => {
    const x = 0.55 + (i % 2) * 4.55;
    const y = top + 0.2 + Math.floor(i / 2) * 1.75;
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y, w: 4.25, h: 1.55,
      fill: { color: T.white }, line: { color: T.border, pt: 0.75 },
      shadow: { type: 'outer', blur: 4, offset: 2, angle: 45, color: '000000', opacity: 0.08 },
    });
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y, w: 4.25, h: 0.06,
      fill: { color: T.teal }, line: { color: T.teal },
    });
    s.addText(st.val, {
      x: x + 0.25, y: y + 0.25, w: 3.8, h: 0.65,
      fontSize: 36, bold: true, color: T.navy, fontFace: 'Arial',
    });
    s.addText(st.label, {
      x: x + 0.25, y: y + 0.85, w: 3.8, h: 0.3,
      fontSize: 13, bold: true, color: T.slate, fontFace: 'Arial',
    });
    s.addText(st.sub, {
      x: x + 0.25, y: y + 1.15, w: 3.8, h: 0.25,
      fontSize: 10, color: T.muted, fontFace: 'Arial',
    });
  });

  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0.55, y: top + 3.75, w: 8.9, h: 0.55,
    fill: { color: T.amberBg }, line: { color: 'FDE68A', pt: 0.5 },
  });
  s.addText('Problema central: una fila mezcla persona, legal, clínica, org, staff y notas — imposible de escalar sin deuda técnica.', {
    x: 0.75, y: top + 3.88, w: 8.5, h: 0.35,
    fontSize: 11, color: T.amber, italic: true, fontFace: 'Arial',
  });
}

function pillarsSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Solución',
    title: 'Cuatro pilares del diseño',
    subtitle: 'Separación clara de responsabilidades',
  });

  const pillars = [
    { title: 'Persona', color: T.green, bg: T.greenBg, items: ['client', 'client_channel', 'client_address', 'lead_party + lead_party_injury_site'] },
    { title: 'Caso', color: T.tealDark, bg: T.tealLight, items: ['lead (núcleo)', 'lead_accident · legal · clinical', 'lead_injury · timeline · lead_insurance', 'lead_org_snapshot (org congelada)'] },
    { title: 'Referencia', color: T.violet, bg: T.violetBg, items: ['ref_attorney · ref_tx_location', 'ref_insurance_carrier (PIP / AT_FAULT)', 'hierarchy_membership + ref_company_office', 'party_kind · staff_kind · ref_severity_level'] },
    { title: 'Operaciones', color: T.rose, bg: T.roseBg, items: ['app_user ← g_users', 'lead_staff · lead_note (snapshot + comment)', 'lead_sync_flag · lead_status_event', 'entity_log · log_detail (I/U/D)'] },
  ];

  pillars.forEach((p, i) => {
    const x = 0.55 + i * 2.28;
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y: top + 0.15, w: 2.15, h: 3.55,
      fill: { color: p.bg }, line: { color: T.border, pt: 0.5 },
    });
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y: top + 0.15, w: 2.15, h: 0.5,
      fill: { color: p.color }, line: { color: p.color },
    });
    s.addText(p.title, {
      x, y: top + 0.22, w: 2.15, h: 0.35,
      fontSize: 13, bold: true, color: T.white, align: 'center', fontFace: 'Arial',
    });
    const bullets = p.items.map((t) => ({ text: t, options: { bullet: { code: '2022' }, breakLine: true } }));
    s.addText(bullets, {
      x: x + 0.12, y: top + 0.75, w: 1.95, h: 2.8,
      fontSize: 10, color: T.slate, valign: 'top', fontFace: 'Arial',
    });
  });
}

function flowSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Arquitectura',
    title: 'Flujo de migración',
    subtitle: 'Proceso independiente del ETL datamart — solo SELECT en producción',
  });

  const steps = MIGRATION_PIPELINE.map((p, i) => ({
    n: String(p.step),
    title: p.label,
    desc: p.target,
    color: [T.navy, T.tealDark, T.tealDark, T.teal, T.amber, T.violet, T.green][i] || T.teal,
  }));

  const cols = 4;
  const cardW = 2.15;
  const gap = 0.15;
  steps.forEach((st, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.55 + col * (cardW + gap);
    const yOff = top + row * 1.85;
    s.addShape(pptx.shapes.OVAL, {
      x: x + 0.75, y: yOff + 0.15, w: 0.45, h: 0.45,
      fill: { color: st.color }, line: { color: st.color },
    });
    s.addText(st.n, {
      x: x + 0.75, y: yOff + 0.2, w: 0.45, h: 0.35,
      fontSize: 12, bold: true, color: T.white, align: 'center', fontFace: 'Arial',
    });
    if (col < cols - 1 && i < steps.length - 1 && Math.floor((i + 1) / cols) === row) {
      s.addShape(pptx.shapes.LINE, {
        x: x + cardW - 0.05, y: yOff + 0.37, w: gap + 0.1, h: 0,
        line: { color: T.border, width: 2, endArrowType: 'arrow' },
      });
    }
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y: yOff + 0.75, w: cardW, h: 0.95,
      fill: { color: T.white }, line: { color: T.border, pt: 0.75 },
    });
    s.addText(st.title, {
      x, y: yOff + 0.82, w: cardW, h: 0.3,
      fontSize: 11, bold: true, color: T.navy, align: 'center', fontFace: 'Arial',
    });
    s.addText(st.desc, {
      x: x + 0.08, y: yOff + 1.12, w: cardW - 0.16, h: 0.45,
      fontSize: 8, color: T.muted, align: 'center', fontFace: 'Arial',
    });
  });

  const boxTop = top + 3.95;
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0.55, y: boxTop, w: 4.2, h: 1.35,
    fill: { color: T.white }, line: { color: T.border, pt: 0.75 },
  });
  s.addText('ORIGEN (solo lectura)', {
    x: 0.75, y: boxTop + 0.07, w: 3.8, h: 0.22,
    fontSize: 9, bold: true, color: T.teal, charSpacing: 1, fontFace: 'Arial',
  });
  s.addText('dbProduction\n· tblLeads (~147K)\n· g_users (~2.5K)\n· tblLeadComments · ref_* catálogos', {
    x: 0.75, y: boxTop + 0.32, w: 3.8, h: 0.95,
    fontSize: 10, color: T.slate, fontFace: 'Arial',
  });

  s.addShape(pptx.shapes.LINE, {
    x: 4.85, y: boxTop + 0.65, w: 0.8, h: 0,
    line: { color: T.teal, width: 2, endArrowType: 'arrow' },
  });

  s.addShape(pptx.shapes.RECTANGLE, {
    x: 5.75, y: boxTop, w: 3.7, h: 1.35,
    fill: { color: T.navy }, line: { color: T.navy },
  });
  s.addText('DESTINO', {
    x: 5.95, y: boxTop + 0.07, w: 3.3, h: 0.22,
    fontSize: 9, bold: true, color: T.tealLight, charSpacing: 1, fontFace: 'Arial',
  });
  s.addText('TNFG\n· lead + lead_* · client*\n· entity_log + log_detail (I/U/D)\n· lead_note (comments sync)', {
    x: 5.95, y: boxTop + 0.32, w: 3.3, h: 0.95,
    fontSize: 10, color: T.white, fontFace: 'Arial',
  });
}

function migrationLegacyMapSlide(pptx) {
  const rows = MIGRATION_SOURCES.map((src) => [
    src.legacy.split('\n')[0],
    src.destinations
      .slice(0, 4)
      .map((d) => d.tables.join(', '))
      .join(' · ')
      + (src.destinations.length > 4 ? ' …' : ''),
  ]);

  proTableSlide(pptx, {
    section: 'Arquitectura',
    title: 'Orígenes legacy → tablas destino',
    subtitle: 'Misma fuente que Schema Dictionary (Migration Flow) y docs/MIGRATION_FLOW.md',
    headers: ['Origen legacy', 'Tablas destino (principal)'],
    colW: [3.2, 5.8],
    bodyFontSize: 8,
    rows,
  });
}

function migrationCorrespondenceErSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Arquitectura',
    title: 'Diagrama ER — correspondencia legacy → TNFG',
    subtitle: 'Cada origen de producción se descompone en tablas del modelo normalizado',
  });

  MIGRATION_CORRESPONDENCE_OVERVIEW.forEach((row, i) => {
    const y = top + 0.05 + i * 0.72;
    s.addShape(pptx.shapes.RECTANGLE, {
      x: 0.55, y, w: 2.4, h: 0.58,
      fill: { color: T.white }, line: { color: T.border, pt: 0.75 },
    });
    s.addText(row.legacy.replace('dbProduction.', ''), {
      x: 0.65, y: y + 0.08, w: 2.2, h: 0.22,
      fontSize: 9, bold: true, color: T.navy, fontFace: 'Consolas',
    });
    s.addText('legacy', {
      x: 0.65, y: y + 0.32, w: 2.2, h: 0.18,
      fontSize: 7, color: T.muted, fontFace: 'Arial',
    });
    s.addShape(pptx.shapes.LINE, {
      x: 3.05, y: y + 0.29, w: 0.55, h: 0,
      line: { color: T.teal, width: 1.5, endArrowType: 'arrow' },
    });
    s.addShape(pptx.shapes.RECTANGLE, {
      x: 3.7, y, w: 5.75, h: 0.58,
      fill: { color: T.tealLight }, line: { color: T.teal, pt: 0.75 },
    });
    s.addText(`${row.targetLabel}  ·  ${row.targetTables.join(' · ')}`, {
      x: 3.82, y: y + 0.12, w: 5.5, h: 0.38,
      fontSize: 8, color: T.slate, fontFace: 'Arial',
    });
  });

  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0.55, y: top + 4.55, w: 8.9, h: 0.55,
    fill: { color: T.white }, line: { color: T.border, pt: 0.75 },
  });
  s.addText('tblLeads → lead (1:1) → lead_accident · lead_legal · client → client_channel (1:N) · lead_party (1:N) · entity_log → log_detail', {
    x: 0.7, y: top + 4.62, w: 8.6, h: 0.4,
    fontSize: 8, color: T.muted, fontFace: 'Arial',
  });
}

function orgCompareSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Reglas de negocio',
    title: 'Jerarquía congelada vs jerarquía actual',
    subtitle: 'El usuario puede moverse de team; el lead conserva la org del momento de creación',
  });

  const cards = [
    {
      title: 'Org del CASO (congelada)',
      color: T.amber,
      bg: T.amberBg,
      where: 'lead_org_snapshot\n(texto legacy + id_company_office)\nlead.id_company_office',
      source: 'Paths tblLeads al crear:\ndirectorate → region → office\n→ pod → team → duo',
      use: 'Reportes históricos\nAtribución congelada\nOrg del caso al registro',
    },
    {
      title: 'Org del USUARIO (actual)',
      color: T.rose,
      bg: T.roseBg,
      where: 'hierarchy_membership\n+ app_user.id_company_office',
      source: 'g_users (sync periódico)\nJerarquía vigente hoy',
      use: 'Perfil del staff\nPermisos y roster actual\nNO usar para org del caso',
    },
  ];

  cards.forEach((c, i) => {
    const x = 0.55 + i * 4.55;
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y: top + 0.1, w: 4.35, h: 3.65,
      fill: { color: c.bg }, line: { color: T.border, pt: 0.75 },
    });
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y: top + 0.1, w: 4.35, h: 0.55,
      fill: { color: c.color }, line: { color: c.color },
    });
    s.addText(c.title, {
      x: x + 0.15, y: top + 0.2, w: 4, h: 0.35,
      fontSize: 13, bold: true, color: T.white, fontFace: 'Arial',
    });
    ['Dónde', 'Origen', 'Usar para'].forEach((lbl, j) => {
      const y = top + 0.85 + j * 1.05;
      s.addText(lbl, {
        x: x + 0.2, y, w: 1.2, h: 0.25,
        fontSize: 9, bold: true, color: c.color, fontFace: 'Arial',
      });
      s.addText([c.where, c.source, c.use][j], {
        x: x + 0.2, y: y + 0.22, w: 3.95, h: 0.75,
        fontSize: 10, color: T.slate, fontFace: 'Arial',
      });
    });
  });
}

function erEntity(s, pptx, x, y, w, h, name, pk, fks, fill, headerColor) {
  s.addShape(pptx.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: fill }, line: { color: T.border, pt: 1 },
  });
  s.addShape(pptx.shapes.RECTANGLE, {
    x, y, w, h: 0.32,
    fill: { color: headerColor || T.navy }, line: { color: headerColor || T.navy },
  });
  s.addText(name, {
    x, y: y + 0.04, w, h: 0.28,
    fontSize: 10, bold: true, color: T.white, align: 'center', fontFace: 'Arial',
  });
  let body = pk ? `PK  ${pk}` : '';
  if (fks?.length) body += (body ? '\n' : '') + fks.map((f) => `FK  ${f}`).join('\n');
  s.addText(body, {
    x: x + 0.08, y: y + 0.38, w: w - 0.16, h: h - 0.42,
    fontSize: 8, color: T.slate, fontFace: 'Consolas',
  });
}

function erLegend(s, pptx, y, items) {
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5, y, w: 9.0, h: 0.38,
    fill: { color: T.white }, line: { color: T.border, pt: 0.5 },
  });
  items.forEach(([col, lbl], i) => {
    s.addShape(pptx.shapes.RECTANGLE, {
      x: 0.65 + i * 1.48, y: y + 0.1, w: 0.16, h: 0.16,
      fill: { color: col }, line: { color: col },
    });
    s.addText(lbl, {
      x: 0.88 + i * 1.48, y: y + 0.08, w: 1.25, h: 0.2,
      fontSize: 7.5, color: T.slate, fontFace: 'Arial',
    });
  });
}

const ER_SECTIONS = [
  {
    title: 'Organización y jerarquía',
    subtitle: 'Compañía → oficina · membership del staff · org congelada del caso',
    cols: 3, entityW: 2.88, rowH: 0.98,
    legend: [[T.amber, 'Org caso'], [T.rose, 'Staff'], [T.muted, 'Catálogo']],
    note: 'lead_org_snapshot congela directorate/region/office/pod/team/duo + id_company_office. hierarchy_membership = org actual del usuario.',
    entities: [
      { name: 'ref_company', pk: 'id_company', color: T.muted },
      { name: 'ref_company_office', pk: 'id_company_office', fks: ['id_company'], color: T.muted },
      { name: 'hierarchy_level', pk: 'id_hierarchy_level', color: T.muted },
      { name: 'hierarchy_membership', pk: 'membership_id', fks: ['user_id', 'id_company_office', 'leader_user_id'], fill: T.roseBg, color: T.rose },
      { name: 'app_user', pk: 'id_user', fks: ['id_company_office'], fill: T.roseBg, color: T.rose },
      { name: 'user_access_grant', pk: 'grant_id', fks: ['user_id', 'id_hierarchy_level'], fill: T.roseBg, color: T.rose },
      { name: 'user_hr_period', pk: 'period_id', fks: ['id_user'], fill: T.roseBg, color: T.rose },
      { name: 'lead_org_snapshot', pk: 'id_lead', fks: ['id_lead', 'id_company_office'], fill: T.amberBg, color: T.amber },
    ],
  },
  {
    title: 'Personas y participantes',
    subtitle: 'client + canales/dirección · lead_party (lesionado y copasajeros 1–5)',
    cols: 3, entityW: 2.88, rowH: 0.98,
    legend: [[T.green, 'Persona'], [T.amber, 'Party'], [T.muted, 'Catálogo']],
    note: 'Copasajero: client propio + lead_party (TX, cita, severidad, sitios vía lead_party_injury_site).',
    entities: [
      { name: 'client', pk: 'id_client', fks: ['id_linked_user'], fill: T.greenBg, color: T.green },
      { name: 'client_channel', pk: 'id_channel', fks: ['id_client', 'id_channel_type'], fill: T.greenBg, color: T.green },
      { name: 'client_address', pk: 'id_address', fks: ['id_client', 'id_state'], fill: T.greenBg, color: T.green },
      { name: 'party_kind', pk: 'id_party_kind', color: T.muted },
      { name: 'lead_party', pk: 'id_lead_party', fks: ['id_lead', 'id_client', 'id_tx_location'], fill: T.amberBg, color: T.amber },
      { name: 'lead_party_injury_site', pk: '(party,site)', fks: ['id_lead_party', 'id_injury_site'], fill: T.amberBg, color: T.amber },
      { name: 'ref_contact_channel_type', pk: 'id_channel_type', color: T.muted },
      { name: 'ref_state', pk: 'id_state', color: T.muted },
      { name: 'ref_injury_site', pk: 'id_injury_site', color: T.muted },
    ],
  },
  {
    title: 'Núcleo del caso (lead)',
    subtitle: 'Estado, stage, oficina, auditoría · timeline y eventos de status',
    cols: 3, entityW: 2.88, rowH: 0.98,
    legend: [[T.tealDark, 'Caso'], [T.violet, 'Histórico'], [T.muted, 'Catálogo']],
    entities: [
      { name: 'lead', pk: 'id_lead', fks: ['id_lead_status', 'id_stage', 'id_company_office'], fill: T.tealLight, color: T.tealDark },
      { name: 'lead_timeline', pk: 'id_lead', fks: ['id_lead'], fill: T.tealLight, color: T.tealDark },
      { name: 'lead_status_event', pk: 'event_id', fks: ['id_lead', 'changed_by_user_id'], fill: T.violetBg, color: T.violet },
      { name: 'refLeadStatus', pk: 'idLeadStatus', color: T.muted },
      { name: 'ref_lead_stage', pk: 'id_stage', color: T.muted },
      { name: 'refLegalStatus', pk: 'idLegalStatus', color: T.muted },
      { name: 'refClinicalStatus', pk: 'idClinicalStatus', color: T.muted },
    ],
  },
  {
    title: 'Dominios 1:1 del caso',
    subtitle: 'Accidente · legal · clínico · lesiones del lesionado principal',
    cols: 3, entityW: 2.88, rowH: 0.98,
    legend: [[T.violet, 'Dominio 1:1'], [T.muted, 'Catálogo FK']],
    entities: [
      { name: 'lead_accident', pk: 'id_lead', fks: ['id_location_type', 'id_at_fault_type', 'id_*_severity'], fill: T.violetBg, color: T.violet },
      { name: 'lead_legal', pk: 'id_lead', fks: ['id_attorney', 'id_legal_status'], fill: T.violetBg, color: T.violet },
      { name: 'lead_clinical', pk: 'id_lead', fks: ['id_tx_location', 'id_clinical_status'], fill: T.violetBg, color: T.violet },
      { name: 'lead_injury', pk: 'id_lead', fill: T.violetBg, color: T.violet },
      { name: 'lead_injury_site', pk: '(lead,site)', fks: ['id_lead', 'id_injury_site'], fill: T.violetBg, color: T.violet },
      { name: 'ref_attorney', pk: 'id_attorney', fks: ['id_state'], color: T.muted },
      { name: 'ref_tx_location', pk: 'id_tx_location', color: T.muted },
      { name: 'ref_accident_location_type', pk: 'id_location_type', color: T.muted },
      { name: 'ref_at_fault_type', pk: 'id_at_fault_type', color: T.muted },
      { name: 'ref_severity_level', pk: 'id_severity', color: T.muted },
    ],
  },
  {
    title: 'Seguros',
    subtitle: 'Catálogo scope PIP / AT_FAULT · roles PIP, AT_FAULT, PASSENGER',
    cols: 3, entityW: 2.88, rowH: 0.98,
    legend: [[T.teal, 'Seguro'], [T.muted, 'Catálogo']],
    note: 'lead_insurance.id_lead_party enlaza seguro del copasajero. carrier_raw preserva texto legacy.',
    entities: [
      { name: 'ref_insurance_carrier', pk: 'id_carrier', fks: ['catalog_scope'], color: T.muted },
      { name: 'lead_insurance', pk: 'id_lead_insurance', fks: ['id_lead', 'id_carrier', 'id_lead_party'], fill: T.tealLight, color: T.teal },
      { name: 'lead_party', pk: 'id_lead_party', fks: ['id_lead', 'party_sequence'], fill: T.amberBg, color: T.amber },
    ],
  },
  {
    title: 'Operaciones, notas y auditoría',
    subtitle: 'Staff · notas · sync · log transaccional I/U/D',
    cols: 3, entityW: 2.88, rowH: 0.98,
    legend: [[T.rose, 'Operación'], [T.violet, 'Log I/U/D'], [T.muted, 'Auditoría']],
    note: 'entity_log: 1 cabecera por registro (entity_table + entity_pk). log_detail: append-only I/U/D. id_log en filas transaccionales.',
    entities: [
      { name: 'entity_log', pk: 'id_log', fks: ['entity_table', 'entity_pk'], fill: T.violetBg, color: T.violet },
      { name: 'log_detail', pk: 'id_log_detail', fks: ['id_log', 'id_actor_user'], fill: T.violetBg, color: T.violet },
      { name: 'lead_staff', pk: 'id_lead_staff', fks: ['id_lead', 'id_user', 'id_staff_kind'], fill: T.roseBg, color: T.rose },
      { name: 'lead_note', pk: 'id_note', fks: ['id_lead', 'posted_by_user_id'], fill: T.roseBg, color: T.rose },
      { name: 'lead_sync_flag', pk: 'id_sync_flag', fks: ['id_lead'], fill: T.roseBg, color: T.rose },
      { name: 'staff_kind', pk: 'id_staff_kind', color: T.muted },
      { name: 'app_user', pk: 'id_user', fill: T.roseBg, color: T.rose },
    ],
  },
];

function erSectionSlide(pptx, sec) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Diagrama ER',
    title: sec.title,
    subtitle: sec.subtitle,
  });
  const cols = sec.cols || 3;
  const ew = sec.entityW || 2.85;
  const gapX = 0.22;
  const rowH = sec.rowH || 0.95;

  sec.entities.forEach((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.5 + col * (ew + gapX);
    const y = top + 0.05 + row * rowH;
    const fkCount = e.fks?.length || 0;
    const h = Math.min(1.15, Math.max(0.68, 0.36 + fkCount * 0.13));
    erEntity(s, pptx, x, y, ew, h, e.name, e.pk, e.fks, e.fill || 'F1F5F9', e.color || T.muted);
  });

  if (sec.legend) erLegend(s, pptx, top + 3.15, sec.legend);
  if (sec.note) {
    s.addText(sec.note, {
      x: 0.5, y: top + 3.58, w: 9.0, h: 0.35,
      fontSize: 9, color: T.muted, italic: true, fontFace: 'Arial',
    });
  }
}

function erDiagramSlides(pptx) {
  ER_SECTIONS.forEach((sec) => erSectionSlide(pptx, sec));
}

function proTableSlide(pptx, { section, title, subtitle, headers, rows, colW, bodyFontSize = 9 }) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, { section, title, subtitle });

  const tableRows = [
    headers.map((h) => ({
      text: h,
      options: {
        bold: true, fill: { color: T.navy }, color: T.white,
        fontSize: 10, fontFace: 'Arial', valign: 'middle',
      },
    })),
    ...rows.map((r, ri) =>
      r.map((c, ci) => ({
        text: String(c),
        options: {
          fontSize: ci === 0 ? bodyFontSize : bodyFontSize,
          fontFace: ci === 0 ? 'Consolas' : 'Arial',
          bold: ci === 0,
          color: ci === 0 ? T.tealDark : T.slate,
          fill: { color: ri % 2 === 0 ? T.white : T.bg },
          valign: 'middle',
        },
      }))
    ),
  ];

  s.addTable(tableRows, {
    x: 0.5, y: top + 0.1, w: 9.0,
    colW: colW || headers.map(() => 9 / headers.length),
    border: { type: 'solid', color: T.border, pt: 0.5 },
    autoPage: false,
  });
}

/** Diccionario completo: tabla → qué datos guarda */
const TABLE_DICTIONARY = [
  {
    title: 'Catálogos de referencia (producción)',
    subtitle: 'Copiados desde dbProduction · lookup por FK',
    rows: [
      ['ref_attorney', 'Catálogo', 'Abogados assignables: display_name, contract group, estado, emails'],
      ['refTXLocations', 'Catálogo', 'Clínicas / sitios TX: nombre, grupo, dirección, geolocalización'],
      ['refLeadStatus', 'Catálogo', 'Estados del lead: New Lead, Came In, Dropped, Locked Down…'],
      ['refClinicalStatus', 'Catálogo', 'Estados clínicos: Pending, Treating, Finalized, Dropped…'],
      ['refLegalStatus', 'Catálogo', 'Estados legales: Pending, Signed, Settled, No Case…'],
      ['ref_lead_stage', 'Catálogo', 'Etapa comercial del lead: Prospect, Owned'],
      ['ref_insurance_carrier', 'Catálogo', 'Aseguradoras PIP + AT_FAULT (catalog_scope)'],
      ['ref_company', 'Catálogo', 'Compañías TNFG (1800 NO FAULT, 305, ICP…)'],
      ['ref_company_office', 'Catálogo', 'Oficinas con ID estable: office_code CFL, MIA…'],
    ],
  },
  {
    title: 'Metadatos, org y persona',
    subtitle: 'Estructura app + contactos del caso',
    rows: [
      ['party_kind', 'Metadato', 'Tipos de participante: INJURED, CO_PASSENGER, DRIVER, WITNESS…'],
      ['staff_kind', 'Metadato', 'Roles de staff: SUBMITTER, INTAKE, CREATOR, UPDATER…'],
      ['hierarchy_level', 'Metadato', 'Niveles org: OFFICE → POD → TEAM → DUO (+ DIRECTORATE/REGION en snapshot)'],
      ['hierarchy_membership', 'Org', 'Jerarquía actual del staff: office, líder, is_leader'],
      ['user_access_grant', 'Org', 'Permisos explícitos adicionales (scope temporal o delegado)'],
      ['user_hr_period', 'Usuario', 'Pasadas HR cerradas (reingresos / bajas históricas)'],
      ['client', 'Persona', 'Datos demográficos: nombre, DOB, menor, idioma, id_linked_user'],
      ['client_channel', 'Persona', 'Teléfonos y emails; primary + variantes legacy (source_tag)'],
      ['client_address', 'Persona', 'Dirección postal: calle, ciudad, ref_state, ZIP'],
      ['app_user', 'Usuario', 'Staff (g_users): HR, compensación (DealGoal→hr_deal_goal, paylocity_id), jerarquía ACTUAL'],
    ],
  },
  {
    title: 'Lead — núcleo y dominios 1:1',
    subtitle: 'Un registro por caso · PK = id_lead (idLead legacy)',
    rows: [
      ['lead', 'Caso', 'Núcleo del caso: status, stage, oficina, origen, VIP/hot, create/update audit'],
      ['lead_accident', 'Dominio', 'Accidente: fecha DOA, estado, at-fault, rideshare, vehículo, police report'],
      ['lead_legal', 'Dominio', 'Legal: abogado FK, status, firmas, DocuSign, abogado previo'],
      ['lead_clinical', 'Dominio', 'Clínico: clínica TX, status, citas, IDOT/LDOT, seguros texto legacy'],
      ['lead_injury', 'Dominio', 'Lesiones: descripción, fractura, ambulancia, hospital, X-ray/MRI/CT'],
      ['lead_timeline', 'Dominio', 'Ciclo de vida: came in, locked down, dropped, callback, razones'],
      ['lead_org_snapshot', 'Dominio', 'Org congelada al crear: texto legacy tblLeads + id_company_office'],
      ['lead_party', 'Relación', 'Persona ↔ lead: lesionado o copasajero 1–5, TX, cita, severidad'],
      ['lead_party_injury_site', 'Relación', 'Sitios de lesión del copasajero (M:N con ref_injury_site)'],
      ['lead_insurance', 'Relación', 'Seguros PIP / AT_FAULT / PASSENGER; FK carrier + id_lead_party'],
      ['lead_injury_site', 'Relación', 'Sitios de lesión del lesionado principal'],
    ],
  },
  {
    title: 'Staff, integraciones y auditoría',
    subtitle: 'Operación del caso · log transaccional',
    rows: [
      ['lead_staff', 'Operación', 'Staff asignado: submitter, intake, creator, updater → app_user'],
      ['lead_sync_flag', 'Operación', 'Flags de integración: COR, AFF, ATTY, emails procesados…'],
      ['lead_note', 'Operación', 'Notas: intake/accident/hospital (snapshot) + comment (tblLeadComments)'],
      ['entity_log', 'Auditoría', 'Cabecera log por registro: entity_table + entity_pk UNIQUE, line_count ≈ LgCant'],
      ['log_detail', 'Auditoría', 'Detalle append-only I/U/D: before/after JSON, actor, módulo, transacción'],
    ],
  },
];

function tableDictionarySlides(pptx) {
  TABLE_DICTIONARY.forEach((block, idx) => {
    proTableSlide(pptx, {
      section: `Diccionario ${idx + 1}/${TABLE_DICTIONARY.length}`,
      title: block.title,
      subtitle: block.subtitle,
      headers: ['Tabla', 'Tipo', 'Qué almacena'],
      colW: [2.3, 1.0, 5.7],
      bodyFontSize: 8.5,
      rows: block.rows,
    });
  });
}

function columnMappingSlides(pptx) {
  const CHUNK = 14;
  TBLLEADS_COLUMN_GROUPS.forEach((group, gi) => {
    for (let i = 0; i < group.rows.length; i += CHUNK) {
      const chunk = group.rows.slice(i, i + CHUNK);
      const pages = Math.ceil(group.rows.length / CHUNK);
      const part = pages > 1 ? ` (${Math.floor(i / CHUNK) + 1}/${pages})` : '';
      proTableSlide(pptx, {
        section: `Índice columnas ${gi + 1}/${TBLLEADS_COLUMN_GROUPS.length}`,
        title: `tblLeads → destino: ${group.title}${part}`,
        subtitle: group.subtitle,
        headers: ['Columna tblLeads', 'Destino TNFG', 'Notas'],
        colW: [2.05, 3.85, 3.1],
        bodyFontSize: 7,
        rows: chunk.map(([src, dest, note]) => [src, dest, note || '']),
      });
    }
  });
}

function mappingSummarySlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Mapeo',
    title: 'Resumen tblLeads → destino',
    subtitle: '~178 columnas migradas · ~11 omitidas (redundantes o legacy)',
  });

  const groups = [
    { label: 'Persona', color: T.green, cols: 'firstName, lastName, dob, phone, email, street…', dest: 'client · client_channel · client_address' },
    { label: 'Caso', color: T.tealDark, cols: 'idLead, leadStatus, sourceType, isVIP, creator…', dest: 'lead + FKs a status / stage / office / user' },
    { label: 'Org congelada', color: T.amber, cols: 'directorate, region, team, pod, duo, officeLabel…', dest: 'lead_org_snapshot + ref_company_office' },
    { label: 'Seguros', color: T.teal, cols: 'pipInsurance, atfaultInsurance, psngrNInsurance', dest: 'ref_insurance_carrier + lead_insurance' },
    { label: 'Accidente', color: T.violet, cols: 'doa, atFaultType, policeReport, rideshare…', dest: 'lead_accident' },
    { label: 'Legal / Clínico', color: T.violet, cols: 'attorney, legalStatus, txLocation, clinicalStatus…', dest: 'lead_legal · lead_clinical (FK catálogos)' },
    { label: 'Copasajeros', color: T.green, cols: 'psngr1…5 (nombre, tel, TX, injuries)', dest: 'client + lead_party + lead_party_injury_site' },
    { label: 'Staff / Notas', color: T.rose, cols: 'submitter, intakeSpecialist, leadNotes, tblLeadComments', dest: 'lead_staff · lead_note (comment)' },
  ];

  groups.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 4.55;
    const y = top + 0.05 + row * 0.78;
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y, w: 4.35, h: 0.7,
      fill: { color: T.white }, line: { color: T.border, pt: 0.5 },
    });
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y, w: 0.08, h: 0.7,
      fill: { color: g.color }, line: { color: g.color },
    });
    s.addText(g.label, {
      x: x + 0.2, y: y + 0.06, w: 4, h: 0.22,
      fontSize: 10, bold: true, color: g.color, fontFace: 'Arial',
    });
    s.addText(`tblLeads: ${g.cols}`, {
      x: x + 0.2, y: y + 0.26, w: 4.05, h: 0.2,
      fontSize: 7.5, color: T.muted, fontFace: 'Arial',
    });
    s.addText(`→  ${g.dest}`, {
      x: x + 0.2, y: y + 0.44, w: 4.05, h: 0.22,
      fontSize: 8, bold: true, color: T.slate, fontFace: 'Arial',
    });
  });
}

function statusSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Estado',
    title: 'Migración completada',
    subtitle: 'TNFG @ 34.58.244.128 — Junio 2026',
  });

  const metrics = [
    ['~148K', 'Leads migrados', 'Modelo normalizado completo'],
    ['~352K', 'Comentarios', 'tblLeadComments → lead_note (comment)'],
    ['~41K', 'Seguros party', 'lead_insurance.id_lead_party (copasajeros)'],
    ['397+', 'Aseguradoras', 'ref_insurance_carrier (PIP + AT_FAULT)'],
  ];

  metrics.forEach((m, i) => {
    const x = 0.55 + (i % 2) * 4.55;
    const y = top + 0.15 + Math.floor(i / 2) * 1.05;
    s.addShape(pptx.shapes.RECTANGLE, {
      x, y, w: 4.35, h: 0.85,
      fill: { color: T.white }, line: { color: T.teal, pt: 1 },
    });
    s.addText(m[0], {
      x: x + 0.2, y: y + 0.1, w: 1.5, h: 0.55,
      fontSize: 22, bold: true, color: T.teal, fontFace: 'Arial',
    });
    s.addText(m[1], {
      x: x + 1.75, y: y + 0.12, w: 2.4, h: 0.3,
      fontSize: 12, bold: true, color: T.navy, fontFace: 'Arial',
    });
    s.addText(m[2], {
      x: x + 1.75, y: y + 0.42, w: 2.4, h: 0.3,
      fontSize: 9, color: T.muted, fontFace: 'Arial',
    });
  });

  s.addText('Comandos: bootstrap · copy-catalogs · copy-users · migrate · sync:lead-comments · validate', {
    x: 0.55, y: top + 2.35, w: 8.9, h: 0.3,
    fontSize: 11, bold: true, color: T.navy, fontFace: 'Arial',
  });

  const steps = ['npm run bootstrap', 'npm run migrate', 'npm run sync:lead-comments', 'npm run validate', 'npm run docs:word'];
  steps.forEach((cmd, i) => {
    s.addShape(pptx.shapes.RECTANGLE, {
      x: 0.55 + i * 1.78, y: top + 2.75, w: 1.68, h: 0.55,
      fill: { color: T.navy }, line: { color: T.navy },
    });
    s.addText(cmd, {
      x: 0.55 + i * 1.78, y: top + 2.88, w: 1.68, h: 0.35,
      fontSize: 7, color: T.white, align: 'center', fontFace: 'Consolas',
    });
  });
}

function roadmapSlide(pptx) {
  const s = pptx.addSlide();
  const top = deckChrome(s, pptx, {
    section: 'Roadmap',
    title: 'Próximos pasos',
    subtitle: 'Hacia producción del modelo normalizado',
  });

  const items = [
    { phase: 'Corto plazo', tasks: ['Aprobación del modelo con stakeholders', 'Spot checks vs tblLeads origen', 'Validaciones por oficina / team (org snapshot)'] },
    { phase: 'Mediano plazo', tasks: ['APIs de la app nueva sobre TNFG', 'Vista tblLeads_flat para transición', 'Índices adicionales según queries de app'] },
    { phase: 'Opcional', tasks: ['Sync incremental post go-live', 'Enriquecer catálogo de aseguradoras', 'Deprecar dependencias de tblLeads wide'] },
  ];

  items.forEach((block, i) => {
    const y = top + 0.1 + i * 1.15;
    s.addShape(pptx.shapes.RECTANGLE, {
      x: 0.55, y, w: 2.0, h: 0.95,
      fill: { color: T.navy }, line: { color: T.navy },
    });
    s.addText(block.phase, {
      x: 0.65, y: y + 0.28, w: 1.8, h: 0.4,
      fontSize: 11, bold: true, color: T.white, align: 'center', fontFace: 'Arial',
    });
    block.tasks.forEach((t, j) => {
      s.addShape(pptx.shapes.RECTANGLE, {
        x: 2.7, y: y + j * 0.32, w: 6.75, h: 0.28,
        fill: { color: j === 0 ? T.tealLight : T.white }, line: { color: T.border, pt: 0.25 },
      });
      s.addText(t, {
        x: 2.85, y: y + j * 0.32 + 0.04, w: 6.5, h: 0.22,
        fontSize: 10, color: T.slate, fontFace: 'Arial',
      });
    });
  });
}

function closingSlide(pptx) {
  slideNum += 1;
  const s = pptx.addSlide();
  s.background = { color: T.navy };

  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 2.5, w: 10, h: 0.06,
    fill: { color: T.teal }, line: { color: T.teal },
  });
  addLogo(s, 3.5, 0.55, 3.2);
  s.addText('Gracias', {
    x: 0.5, y: 1.65, w: 9, h: 0.9,
    fontSize: 44, bold: true, color: T.white, align: 'center', fontFace: 'Arial',
  });
  s.addText('Documentación técnica: docs/MODELO_Y_MAPEO.md', {
    x: 0.5, y: 2.85, w: 9, h: 0.35,
    fontSize: 13, color: T.tealLight, align: 'center', fontFace: 'Arial',
  });
  s.addText('lead-normalize-migration · TNFG', {
    x: 0.5, y: 3.35, w: 9, h: 0.3,
    fontSize: 11, color: '64748B', align: 'center', fontFace: 'Arial',
  });
}

async function main() {
  slideNum = 0;
  await ensureTransparentLogo();
  if (!fs.existsSync(LOGO)) {
    console.warn('⚠ Logo no encontrado:', LOGO);
  }
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'TNFG Data Engineering';
  pptx.title = 'Modelo de Datos Representatives Normalizado';
  pptx.subject = 'Migración tblLeads → TNFG';

  coverSlide(pptx);
  agendaSlide(pptx);

  sectionSlide(pptx, 1, 'Contexto y objetivos', 'De tabla ancha a modelo relacional escalable');
  statCardsSlide(pptx);
  pillarsSlide(pptx);

  sectionSlide(pptx, 2, 'Arquitectura del modelo', 'Entidades, relaciones y flujo de migración');
  flowSlide(pptx);
  migrationLegacyMapSlide(pptx);
  migrationCorrespondenceErSlide(pptx);
  erDiagramSlides(pptx);

  sectionSlide(pptx, 3, 'Diccionario de tablas', 'Qué almacena cada entidad del modelo destino');
  tableDictionarySlides(pptx);

  sectionSlide(pptx, 4, 'Reglas de negocio', 'Ownership del caso vs perfil del usuario');
  orgCompareSlide(pptx);

  sectionSlide(pptx, 5, 'Mapeo de datos', 'tblLeads → tablas destino');
  mappingSummarySlide(pptx);
  columnMappingSlides(pptx);

  proTableSlide(pptx, {
    section: 'Detalle',
    title: 'lead_org_snapshot — Jerarquía congelada al crear',
    subtitle: '1:1 con lead · texto legacy + id_company_office · No cambia si g_users cambia',
    headers: ['Campo destino', 'tblLeads', 'Descripción'],
    colW: [2.4, 2.4, 4.2],
    rows: [
      ['directorate / directorate_name', 'directorate / directorateName', 'Directorate congelado (texto)'],
      ['region / region_name', 'region / regionName', 'Región congelada (texto)'],
      ['office_code / office_name', 'officeLabel / officeName', 'Oficina del caso (texto)'],
      ['id_company_office', 'officeLabel → catálogo', 'FK ref_company_office si mapea'],
      ['pod / team / duo (+ *_name)', 'pod, team, duo', 'Niveles inferiores congelados'],
    ],
  });

  proTableSlide(pptx, {
    section: 'Detalle',
    title: 'lead_insurance — Seguros estructurados',
    subtitle: 'Catálogo ref_insurance_carrier · roles PIP / AT_FAULT / PASSENGER',
    headers: ['Campo destino', 'tblLeads', 'Descripción'],
    colW: [2.2, 2.8, 4.0],
    rows: [
      ['insurance_role = PIP', 'pipInsurance', 'Seguro PIP del lesionado'],
      ['insurance_role = AT_FAULT', 'atfaultInsurance', 'Seguro del at-fault'],
      ['insurance_role = PASSENGER', 'psngr1…5 Insurance', 'party_sequence 1–5'],
      ['id_carrier', '→ ref_insurance_carrier', 'FK catálogo normalizado'],
      ['carrier_raw', 'texto original', 'Valor legacy preservado'],
    ],
  });

  proTableSlide(pptx, {
    section: 'Detalle',
    title: 'hierarchy_membership — Jerarquía actual del staff',
    subtitle: 'Sync desde g_users · OFFICE usa ref_company_office · POD/TEAM/DUO usan leader_user_id',
    headers: ['Nivel', 'level_code', 'Cómo se representa'],
    colW: [1.5, 2.2, 5.3],
    rows: [
      ['OFFICE', 'OFFICE', 'id_company_office + leader_user_id opcional'],
      ['POD', 'POD', 'leader_user_id = jefe del pod; is_leader distingue miembros'],
      ['TEAM', 'TEAM', 'Mismo patrón: líder + reportes'],
      ['DUO', 'DUO', 'Parejas operativas (duo leader)'],
      ['—', 'is_leader', '1 = jefe en ese nivel; 0 = miembro'],
      ['—', 'vs lead_org_snapshot', 'Membership = org HOY; snapshot = org al crear el caso'],
    ],
  });

  proTableSlide(pptx, {
    section: 'Detalle',
    title: 'lead + client — Campos clave',
    subtitle: 'Transformaciones principales',
    headers: ['Destino', 'Origen tblLeads', 'Notas'],
    colW: [2.2, 2.8, 4.0],
    rows: [
      ['lead.id_lead', 'idLead', 'PK preservada'],
      ['lead.id_lead_status', 'leadStatus', '→ FK refLeadStatus'],
      ['lead.submitter_user_id', 'submitter', 'Email → app_user'],
      ['client + channel', 'firstName, phone, email…', '1:N teléfonos con source_tag'],
      ['lead_party', 'psngr1…5', 'Copasajeros como CO_PASSENGER'],
    ],
  });

  proTableSlide(pptx, {
    section: 'Detalle',
    title: 'Columnas no migradas',
    subtitle: 'Redundantes, typos legacy o fuera de alcance fase 1',
    headers: ['Columnas', 'Motivo'],
    colW: [4.5, 4.5],
    rows: [
      ['regionLabel, officeKey, dou…', 'Variantes / typos legacy'],
      ['attyFirm, attyContractGroup', 'Ya en ref_attorney'],
      ['funder, accessLevel, LD Sent', 'Operativo legacy — fase 2'],
      ['Client Name', 'Duplicado de name'],
    ],
  });

  sectionSlide(pptx, 6, 'Estado y roadmap', 'Migración completa — camino a producción app');
  statusSlide(pptx);
  roadmapSlide(pptx);
  closingSlide(pptx);

  await pptx.writeFile({ fileName: OUT });
  console.log(`✓ Presentación profesional generada (${slideNum} diapositivas):`);
  console.log(' ', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
