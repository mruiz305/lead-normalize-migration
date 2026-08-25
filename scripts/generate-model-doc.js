#!/usr/bin/env node
/**
 * Genera docs/MODELO_Y_MAPEO.docx con estilo corporativo TNFG (portada, TOC, headers).
 */
const fs = require('fs');
const path = require('path');
const { convertMarkdownToDocx } = require('@mohtasham/md-to-docx');

const { renderMarkdownSection } = require('../docs/tblLeads-column-map');

const ROOT = path.join(__dirname, '..');
const MD_PATH = path.join(ROOT, 'docs/MODELO_Y_MAPEO.md');
const OUT_PATH = path.join(ROOT, 'docs/MODELO_Y_MAPEO.docx');
const LOGO_PATH = path.join(ROOT, 'docs/assets/tnfg-logo.png');

const TNFG = {
  navy: '0F2744',
  teal: '0891B2',
  slate: '334155',
  muted: '64748B',
  codeBg: 'F1F5F9',
  calloutBg: 'E0F7FA',
};

const baseStyle = {
  fontFamily: 'Arial',
  paragraphSize: 22,
  paragraphSpacing: 140,
  lineSpacing: 1.15,
  headingSpacing: 240,
  heading1Size: 36,
  heading2Size: 28,
  heading3Size: 24,
  heading4Size: 22,
  listItemSize: 22,
  codeBlockSize: 18,
  paragraphAlignment: 'JUSTIFIED',
  headingAlignment: 'LEFT',
  tableLayout: 'fixed',
  tocFontSize: 22,
  tocHeading1FontSize: 24,
  tocHeading2FontSize: 22,
  calloutStyles: {
    note: {
      borderColor: TNFG.teal,
      backgroundColor: TNFG.calloutBg,
      titleColor: TNFG.navy,
    },
    important: {
      borderColor: TNFG.navy,
      backgroundColor: 'FFFBEB',
      titleColor: TNFG.navy,
    },
  },
};

function logoMarkdown() {
  if (!fs.existsSync(LOGO_PATH)) return '';
  return `![](${LOGO_PATH.replace(/\\/g, '/')})\n\n`;
}

function buildCoverSection() {
  return `${logoMarkdown()}# Modelo de Datos Intake Normalizado

---

**Migración tblLeads → TNFG**

Documentación técnica · Qué es cada tabla y mapeo desde producción

*The No-Fault Group · Data Engineering*

Junio 2026
`;
}

function syncColumnMapToMarkdown() {
  const md = fs.readFileSync(MD_PATH, 'utf8');
  const block = `<!-- COLUMN_MAP -->\n${renderMarkdownSection()}\n<!-- /COLUMN_MAP -->`;
  const updated = md.includes('<!-- COLUMN_MAP -->')
    ? md.replace(/<!-- COLUMN_MAP -->[\s\S]*?<!-- \/COLUMN_MAP -->/, block)
    : md.replace('## Resumen numérico', `${block}\n\n## Resumen numérico`);
  if (updated !== md) fs.writeFileSync(MD_PATH, updated);
}

function buildBodySection(rawMd) {
  const body = rawMd.replace(/^# .+\n\n?/, '');
  return `[TOC]

# Introducción

> [!NOTE]
> Este documento describe el **modelo relacional destino** para reemplazar la tabla ancha \`tblLeads\` (~189 columnas). Origen: \`dbProduction\` (solo lectura). Destino: \`TNFG\`.

> [!IMPORTANT]
> **Glosario rápido:** *intake* = ingreso del caso · *party* = participante (lesionado/copasajero) · *channel* = teléfono o email de contacto.

---

${body}`;
}

async function main() {
  syncColumnMapToMarkdown();
  const rawMd = fs.readFileSync(MD_PATH, 'utf8');
  const blob = await convertMarkdownToDocx('', {
    style: baseStyle,
    template: {
      page: {
        margin: { top: 1260, right: 1080, bottom: 1260, left: 1260 },
      },
    },
    codeHighlighting: {
      enabled: true,
      showLanguageLabel: true,
      languages: ['sql'],
      theme: {
        background: TNFG.codeBg,
        border: 'CBD5E1',
        default: TNFG.slate,
        keyword: TNFG.navy,
        string: TNFG.teal,
        comment: TNFG.muted,
      },
    },
    sections: [
      {
        markdown: buildCoverSection(),
        titlePage: true,
        footers: { default: null },
        headers: { default: null },
        pageNumbering: { display: 'none' },
        style: {
          paragraphAlignment: 'CENTER',
          paragraphSize: 24,
          heading1Size: 40,
          heading1Alignment: 'CENTER',
        },
      },
      {
        markdown: buildBodySection(rawMd),
        type: 'NEXT_PAGE',
        titlePage: true,
        headers: {
          default: {
            text: 'Modelo normalizado TNFG · TNFG',
            alignment: 'RIGHT',
          },
          first: {
            text: 'Modelo normalizado TNFG',
            alignment: 'RIGHT',
          },
        },
        footers: {
          default: {
            text: 'Documentación técnica — ',
            pageNumberDisplay: 'current',
            alignment: 'CENTER',
          },
        },
        pageNumbering: { start: 1, formatType: 'decimal' },
        style: {
          paragraphAlignment: 'JUSTIFIED',
          paragraphSize: 22,
        },
      },
    ],
  });

  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(OUT_PATH, buffer);
  console.log(`✓ Word profesional generado: ${OUT_PATH}`);
  console.log(`  (${(buffer.length / 1024).toFixed(0)} KB · portada + índice + contenido)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
