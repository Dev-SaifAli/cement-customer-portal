import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const documentationDirectory = resolve(scriptDirectory, '..');
const screenshotDirectory = join(documentationDirectory, 'screenshots');
const outputDirectory = join(documentationDirectory, 'generated');
const configPath = join(scriptDirectory, 'user-guide.config.json');
const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const screenshotMimeTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
]);

const htmlEscape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const markdownEscape = (value) => String(value).replaceAll('|', '\\|');

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 _-]/g, '')
    .replaceAll(' ', '-')
    .replace(/^-+|-+$/g, '');

const numericPrefix = (filename) => {
  const match = filename.match(/^(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const compareScreenshotNames = (left, right) => {
  const prefixDifference = numericPrefix(left) - numericPrefix(right);
  return Number.isNaN(prefixDifference) || prefixDifference === 0
    ? left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    : prefixDifference;
};

const findMissingScreenshotPrefixes = (screenshots) => {
  const prefixes = screenshots.map(numericPrefix).filter(Number.isFinite);
  if (prefixes.length === 0) return [];
  const available = new Set(prefixes);
  const highest = Math.max(...prefixes);
  return Array.from({ length: highest }, (_, index) => index + 1).filter(
    (prefix) => !available.has(prefix)
  );
};

const discoverScreenshots = async () => {
  const entries = await readdir(screenshotDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && supportedExtensions.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort(compareScreenshotNames);
};

const embedScreenshots = async (screenshots) =>
  new Map(
    await Promise.all(
      screenshots.map(async (file) => {
        const extension = extname(file).toLowerCase();
        const mimeType = screenshotMimeTypes.get(extension);
        if (!mimeType) throw new Error(`Cannot embed unsupported screenshot type: ${file}`);
        const contents = await readFile(join(screenshotDirectory, file));
        return [file, `data:${mimeType};base64,${contents.toString('base64')}`];
      })
    )
  );

const loadConfiguration = async () => JSON.parse(await readFile(configPath, 'utf8'));

const humanizeScreenshotName = (filename) => {
  const words = filename
    .replace(/^\d+_+/, '')
    .replace(/\.[^.]+$/, '')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return words
    .replace(/\bPod\b/g, 'POD')
    .replace(/\bShip To\b/g, 'Ship-to')
    .replace(/\bPickup\b/g, 'Pick-Up');
};

const expandScreenshotRanges = (configuration, discoveredScreenshots) => ({
  ...configuration,
  sections: configuration.sections.map((section) => {
    const [start, end] = section.screenshotRange ?? [];
    const screenshots = discoveredScreenshots
      .filter((file) => {
        const prefix = numericPrefix(file);
        return Number.isFinite(prefix) && prefix >= start && prefix <= end;
      })
      .map((file) => {
        const caption = humanizeScreenshotName(file);
        return {
          file,
          caption,
          instruction: `This screen shows ${caption.toLowerCase()} in the implemented ${section.title} workflow. Use the displayed information and available actions to complete or verify this business step.`
        };
      });

    return { ...section, screenshots };
  })
});

const validateConfiguration = (configuration, discoveredScreenshots) => {
  const sectionIds = new Set();
  const mappedFiles = new Set();
  const errors = [];
  const prefixes = discoveredScreenshots.map((file) => numericPrefix(file));

  if (prefixes.some((prefix) => !Number.isFinite(prefix))) {
    errors.push('Every screenshot filename must begin with a numeric prefix.');
  }
  if (new Set(prefixes).size !== prefixes.length) {
    errors.push('Screenshot numeric prefixes must be unique.');
  }

  for (const section of configuration.sections) {
    if (sectionIds.has(section.id)) errors.push(`Duplicate section id: ${section.id}`);
    sectionIds.add(section.id);

    for (const screenshot of section.screenshots) {
      if (mappedFiles.has(screenshot.file)) errors.push(`Screenshot mapped more than once: ${screenshot.file}`);
      mappedFiles.add(screenshot.file);
      if (!discoveredScreenshots.includes(screenshot.file)) {
        errors.push(`Mapped screenshot was not found: ${screenshot.file}`);
      }
    }
  }

  for (const testCase of configuration.uatCases) {
    for (const evidence of testCase.evidence ?? []) {
      if (!discoveredScreenshots.includes(evidence)) {
        errors.push(`UAT evidence was not found (${testCase.id}): ${evidence}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Documentation configuration is invalid:\n- ${errors.join('\n- ')}`);
  }

  return {
    mappedFiles,
    unmappedFiles: discoveredScreenshots.filter((file) => !mappedFiles.has(file))
  };
};

const buildHeadings = (configuration, hasUnmappedEvidence) => {
  const headings = [
    { level: 2, title: 'Document Control' },
    { level: 2, title: 'Document Purpose' },
    { level: 2, title: 'Portal Overview' },
    { level: 2, title: 'User Roles & Responsibilities' },
    { level: 2, title: 'Login & Access' },
    ...configuration.sections.map((section) => ({ level: 2, title: section.title })),
    { level: 2, title: 'End-to-End Workflow' },
    { level: 2, title: 'UAT Testing Guide' },
    { level: 2, title: 'UAT Testing Checklist' },
    { level: 2, title: 'Known Limitations & Pending Features' },
    { level: 2, title: 'UAT Sign-Off' }
  ];

  if (hasUnmappedEvidence) headings.push({ level: 2, title: 'Evidence Awaiting Classification' });
  headings.push({ level: 2, title: 'Screenshot Evidence Register' });
  return headings;
};

const renderMarkdownToc = (headings) =>
  headings
    .map(({ level, title }) => `${'  '.repeat(Math.max(0, level - 2))}- [${title}](#${slugify(title)})`)
    .join('\n');

const renderMarkdownFigure = (screenshot, figureNumber) => {
  const source = `../screenshots/${encodeURI(screenshot.file)}`;
  return [
    `<figure id="figure-${figureNumber}">`,
    `  <img src="${source}" alt="${htmlEscape(screenshot.caption)}" width="100%">`,
    `  <figcaption><strong>Figure ${figureNumber}:</strong> ${htmlEscape(screenshot.caption)} — ${htmlEscape(screenshot.instruction)}</figcaption>`,
    '</figure>'
  ].join('\n');
};

const renderMarkdown = (configuration, discoveredScreenshots, unmappedFiles) => {
  const { document, implementedAreas, pendingAreas, sections, uatCases, roles, loginRoutes } = configuration;
  const headings = buildHeadings(configuration, unmappedFiles.length > 0);
  const missingPrefixes = findMissingScreenshotPrefixes(discoveredScreenshots);
  const lines = [
    `# ${document.title}`,
    '',
    `> ${document.subtitle}`,
    '',
    '## Table of Contents',
    '',
    renderMarkdownToc(headings),
    '',
    '## Document Control',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Document owner | ${markdownEscape(document.owner)} |`,
    `| Prepared for | ${markdownEscape(document.preparedFor)} |`,
    `| Version | ${markdownEscape(document.version)} |`,
    `| Classification | ${markdownEscape(document.classification)} |`,
    `| Generated | ${new Date().toISOString()} |`,
    `| Screenshot evidence | ${discoveredScreenshots.length} file(s) |`,
    `| Screenshot numbering | 01–${String(numericPrefix(discoveredScreenshots.at(-1))).padStart(2, '0')}; ${missingPrefixes.length ? `missing prefix(es): ${missingPrefixes.map((prefix) => String(prefix).padStart(2, '0')).join(', ')}` : 'no gaps'} |`,
    '',
    '## Document Purpose',
    '',
    'This document provides client-facing operating guidance and User Acceptance Testing (UAT) evidence for confirmed AlSafwa Cement Portal functionality. It uses only screenshots captured from the running application and separates implemented functionality from pending or unverified work.',
    '',
    '## Portal Overview',
    '',
    'The AlSafwa Cement Portal provides role-based customer onboarding, customer self-service, Sales review, pricing administration, Hader operations, commercial approval, and portal administration capabilities. The options visible to each user depend on their authenticated role and existing permissions.',
    '',
    '**Confirmed guide areas**',
    '',
    ...implementedAreas.map((area) => `- ${area}`),
    '',
    '## User Roles & Responsibilities',
    '',
    '| Role | Responsibility in this guide |',
    '| --- | --- |',
    ...roles.map(({ role, responsibility }) => `| ${markdownEscape(role)} | ${markdownEscape(responsibility)} |`),
    '',
    '## Login & Access',
    '',
    `Portal base address: [${document.baseUrl}/](${document.baseUrl}/)`,
    '',
    '| Role | Login URL | Access note |',
    '| --- | --- | --- |',
    ...loginRoutes.map(({ role, path, note }) => `| ${markdownEscape(role)} | [${document.baseUrl}${path}](${document.baseUrl}${path}) | ${markdownEscape(note)} |`),
    '',
    '1. Open the login URL assigned to your role.',
    '2. Sign in using credentials issued through the approved administration process.',
    '3. Confirm that the displayed navigation matches your assigned responsibilities.',
    '4. Use only approved UAT data and sign out when testing is complete.',
    '',
    '> Internal operational roles share `/sales/login`; the authenticated role controls the landing page, navigation, and protected routes.',
    '> Security note: Credentials and authentication secrets are intentionally excluded from this document.',
    ''
  ];

  let figureNumber = 1;
  for (const section of sections) {
    lines.push(`## ${section.title}`, '', `**Audience:** ${section.audience}`, '', section.summary, '');
    if (section.steps.length > 0) {
      lines.push('**Procedure**', '');
      section.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      lines.push('');
    }
    if (section.screenshots.length === 0) {
      lines.push('> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**', '');
    } else {
      for (const screenshot of section.screenshots) {
        lines.push(renderMarkdownFigure(screenshot, figureNumber), '');
        figureNumber += 1;
      }
    }
  }

  lines.push(
    '## End-to-End Workflow',
    '',
    '1. A prospective customer submits an organization registration.',
    '2. Sales reviews the application, approves it, and activates the customer account.',
    '3. An authorized customer requests a quotation or submits a direct order.',
    '4. Sales reviews quotation pricing; required pricing approvals are completed before the customer decision.',
    '5. An accepted quotation can be converted into an active contract, and customers can order against remaining contract TON.',
    '6. Sales starts order processing, creating the Hader delivery request for delivery fulfilment.',
    '7. Hader creates, assigns, loads, and dispatches the shipment.',
    '8. Delivery Team starts delivery, marks it delivered, records POD, and closes the shipment.',
    '9. If the actual pricing city differs, Price Manager raises the calculated Ship-to Variance charge for Commercial Director approval.',
    '',
    '## UAT Testing Guide',
    '',
    'Execute each case using an authorized account. Record the observed result and set Status to PASS, FAIL, BLOCKED, or NOT TESTED. Screenshot evidence demonstrates implemented screens but does not by itself claim that a UAT case passed.',
    '',
    '| Test ID | Role | Module | Scenario | Expected Result | Actual Result | Status | Comments |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...uatCases.map((testCase) => `| ${markdownEscape(testCase.id)} | ${markdownEscape(testCase.role)} | ${markdownEscape(testCase.module)} | ${markdownEscape(testCase.scenario)} | ${markdownEscape(testCase.expectedResult)} | _To be completed during UAT_ | NOT TESTED |  |`),
    '',
    '## UAT Testing Checklist',
    '',
    '| Test ID | Module | Scenario | Tester | Date | Status | Comments |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...uatCases.map(
      (testCase) =>
        `| ${markdownEscape(testCase.id)} | ${markdownEscape(testCase.module)} | ${markdownEscape(testCase.scenario)} |  |  | NOT TESTED |  |`
    ),
    '',
    '## Known Limitations & Pending Features',
    '',
    'The following functionality is pending or has not been verified as implemented. It must not be accepted during UAT as completed functionality:',
    '',
    ...pendingAreas.map((area) => `- ${area}`),
    '',
    '## UAT Sign-Off',
    '',
    '| Approval | Name | Role | Signature | Date |',
    '| --- | --- | --- | --- | --- |',
    '| Prepared by |  |  |  |  |',
    '| Business reviewer |  |  |  |  |',
    '| UAT approver |  |  |  |  |',
    '',
    '**Overall UAT decision:** ☐ Accepted &nbsp;&nbsp; ☐ Accepted with conditions &nbsp;&nbsp; ☐ Rejected',
    '',
    '**Sign-off comments:**',
    '',
    '________________________________________________________________________________',
    ''
  );

  if (unmappedFiles.length > 0) {
    lines.push(
      '## Evidence Awaiting Classification',
      '',
      'These real screenshots were discovered but are not mapped to an implemented guide section. They are intentionally excluded from completed procedures until classified in `user-guide.config.json`.',
      '',
      ...unmappedFiles.map((file) => `- ${file}`),
      ''
    );
  }

  lines.push(
    '## Screenshot Evidence Register',
    '',
    '| Sequence | Actual filename | Guide section |',
    '| ---: | --- | --- |'
  );

  const sectionByScreenshot = new Map(
    sections.flatMap((section) => section.screenshots.map((screenshot) => [screenshot.file, section.title]))
  );
  discoveredScreenshots.forEach((file) => {
    lines.push(`| ${numericPrefix(file)} | ${markdownEscape(file)} | ${markdownEscape(sectionByScreenshot.get(file) ?? 'Awaiting classification')} |`);
  });
  lines.push('');

  return lines.join('\n');
};

const renderHtmlFigure = (screenshot, figureNumber, embeddedScreenshots) => {
  const source = embeddedScreenshots.get(screenshot.file);
  if (!source) throw new Error(`Embedded screenshot data is missing: ${screenshot.file}`);
  return `<figure id="figure-${figureNumber}"><img src="${source}" alt="${htmlEscape(screenshot.caption)}" loading="lazy"><figcaption><strong>Figure ${figureNumber}:</strong> ${htmlEscape(screenshot.caption)}<br><span>${htmlEscape(screenshot.instruction)}</span></figcaption></figure>`;
};

const renderHtml = (configuration, discoveredScreenshots, unmappedFiles, embeddedScreenshots) => {
  const { document, implementedAreas, pendingAreas, sections, uatCases, roles, loginRoutes } = configuration;
  const headings = buildHeadings(configuration, unmappedFiles.length > 0);
  const missingPrefixes = findMissingScreenshotPrefixes(discoveredScreenshots);
  const toc = headings
    .map(({ level, title }) => `<li class="toc-level-${level}"><a href="#${slugify(title)}">${htmlEscape(title)}</a></li>`)
    .join('');

  let figureNumber = 1;
  const guideSections = sections
    .map((section) => {
      const procedure = section.steps.length
        ? `<h4>Procedure</h4><ol>${section.steps.map((step) => `<li>${htmlEscape(step)}</li>`).join('')}</ol>`
        : '';
      const evidence = section.screenshots.length
        ? section.screenshots.map((screenshot) => renderHtmlFigure(screenshot, figureNumber++, embeddedScreenshots)).join('')
        : '<aside class="notice"><strong>[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]</strong></aside>';
      return `<section><h2 id="${slugify(section.title)}">${htmlEscape(section.title)}</h2><p class="audience"><strong>Audience:</strong> ${htmlEscape(section.audience)}</p><p>${htmlEscape(section.summary)}</p>${procedure}${evidence}</section>`;
    })
    .join('');

  const roleRowsHtml = roles
    .map(({ role, responsibility }) => `<tr><td>${htmlEscape(role)}</td><td>${htmlEscape(responsibility)}</td></tr>`)
    .join('');
  const loginRowsHtml = loginRoutes
    .map(({ role, path, note }) => `<tr><td>${htmlEscape(role)}</td><td><a href="${htmlEscape(`${document.baseUrl}${path}`)}">${htmlEscape(`${document.baseUrl}${path}`)}</a></td><td>${htmlEscape(note)}</td></tr>`)
    .join('');
  const uatRows = uatCases
    .map((testCase) => `<tr><td>${htmlEscape(testCase.id)}</td><td>${htmlEscape(testCase.role)}</td><td>${htmlEscape(testCase.module)}</td><td>${htmlEscape(testCase.scenario)}</td><td>${htmlEscape(testCase.expectedResult)}</td><td class="completion">To be completed during UAT</td><td>NOT TESTED</td><td></td></tr>`)
    .join('');
  const checklistRows = uatCases
    .map(
      (testCase) => `<tr><td>${htmlEscape(testCase.id)}</td><td>${htmlEscape(testCase.module)}</td><td>${htmlEscape(testCase.scenario)}</td><td></td><td></td><td>NOT TESTED</td><td></td></tr>`
    )
    .join('');

  const sectionByScreenshot = new Map(
    sections.flatMap((section) => section.screenshots.map((screenshot) => [screenshot.file, section.title]))
  );
  const evidenceRows = discoveredScreenshots
    .map((file) => `<tr><td>${numericPrefix(file)}</td><td>${htmlEscape(file)}</td><td>${htmlEscape(sectionByScreenshot.get(file) ?? 'Awaiting classification')}</td></tr>`)
    .join('');

  const unmappedSection = unmappedFiles.length
    ? `<section><h2 id="evidence-awaiting-classification">Evidence Awaiting Classification</h2><p>These real screenshots were discovered but are not mapped to an implemented guide section. They are intentionally excluded from completed procedures until classified in <code>user-guide.config.json</code>.</p><ul>${unmappedFiles.map((file) => `<li>${htmlEscape(file)}</li>`).join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(document.title)}</title>
  <style>
    :root { --primary:#54247a; --primary-soft:#f6f2fa; --text:#1a1b23; --muted:#64748b; --border:#e3e1e8; --surface:#fff; --page:#f8fafc; --warning:#b45309; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--page); color:var(--text); font-family:Manrope,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size:15px; line-height:1.6; }
    main { width:min(1120px,calc(100% - 32px)); margin:32px auto; background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:0 12px 40px rgba(31,20,43,.08); overflow:hidden; }
    .cover { padding:64px; background:linear-gradient(135deg,#2f123f,#54247a); color:#fff; }
    .cover .eyebrow { text-transform:uppercase; letter-spacing:.12em; font-weight:700; opacity:.8; }
    .cover h1 { max-width:760px; margin:12px 0; font-size:42px; line-height:1.15; }
    .cover p { max-width:720px; font-size:18px; opacity:.88; }
    article { padding:48px 64px 72px; }
    h2,h3,h4 { line-height:1.3; scroll-margin-top:20px; }
    h2 { margin:48px 0 18px; color:var(--primary); border-bottom:1px solid var(--border); padding-bottom:10px; }
    h3 { margin:38px 0 12px; }
    h4 { margin:24px 0 8px; }
    a { color:var(--primary); }
    .toc { list-style:none; padding:0; columns:2; column-gap:36px; }
    .toc li { break-inside:avoid; margin:5px 0; }
    .toc-level-3 { padding-left:18px; font-size:14px; }
    .meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; background:var(--border); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
    .meta-grid div { padding:12px 14px; background:var(--surface); }
    .meta-grid strong { display:block; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
    .scope { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
    .scope-card { padding:18px; border:1px solid var(--border); border-radius:12px; }
    .scope-card.pending { border-left:4px solid var(--warning); }
    .notice { margin:18px 0; padding:14px 16px; color:var(--muted); background:var(--primary-soft); border-left:4px solid var(--primary); border-radius:8px; }
    .audience { color:var(--muted); }
    figure { margin:28px 0 40px; break-inside:avoid; }
    figure img { display:block; width:100%; height:auto; border:1px solid var(--border); border-radius:10px; box-shadow:0 8px 24px rgba(31,20,43,.08); }
    figcaption { padding:10px 4px 0; color:var(--text); font-size:14px; }
    figcaption span { color:var(--muted); }
    table { width:100%; border-collapse:collapse; margin:14px 0 22px; font-size:14px; }
    th,td { border:1px solid var(--border); padding:10px 12px; text-align:left; vertical-align:top; }
    th { background:var(--primary-soft); font-weight:650; }
    .uat-case { break-before:page; }
    .completion { height:56px; color:var(--muted); font-style:italic; }
    .table-scroll { overflow-x:auto; }
    .signoff-space { min-height:90px; border-bottom:1px solid var(--border); }
    code { background:var(--primary-soft); padding:2px 5px; border-radius:4px; }
    @media (max-width:760px) { main { width:100%; margin:0; border:0; border-radius:0; } .cover,article { padding:30px 22px; } .cover h1 { font-size:32px; } .toc { columns:1; } .scope,.meta-grid { grid-template-columns:1fr; } }
    @page { size:A4; margin:16mm; }
    @media print { body { background:#fff; font-size:10pt; } main { width:auto; margin:0; border:0; border-radius:0; box-shadow:none; overflow:visible; } .cover { min-height:230mm; display:flex; flex-direction:column; justify-content:center; break-after:page; print-color-adjust:exact; -webkit-print-color-adjust:exact; } article { padding:0; } a { color:inherit; text-decoration:none; } figure img { box-shadow:none; } h2 { break-before:page; } h2:first-of-type { break-before:auto; } }
  </style>
</head>
<body>
<main>
  <header class="cover"><div class="eyebrow">${htmlEscape(document.classification)}</div><h1>${htmlEscape(document.title)}</h1><p>${htmlEscape(document.subtitle)}</p><p>Version ${htmlEscape(document.version)} · ${htmlEscape(document.owner)}</p></header>
  <article>
    <h2>Table of Contents</h2><ol class="toc">${toc}</ol>
    <h2 id="document-control">Document Control</h2>
    <div class="meta-grid"><div><strong>Document owner</strong>${htmlEscape(document.owner)}</div><div><strong>Prepared for</strong>${htmlEscape(document.preparedFor)}</div><div><strong>Version</strong>${htmlEscape(document.version)}</div><div><strong>Classification</strong>${htmlEscape(document.classification)}</div><div><strong>Generated</strong>${htmlEscape(new Date().toISOString())}</div><div><strong>Screenshot evidence</strong>${discoveredScreenshots.length} file(s)</div><div><strong>Screenshot numbering</strong>01–${String(numericPrefix(discoveredScreenshots.at(-1))).padStart(2, '0')}; ${missingPrefixes.length ? `missing prefix(es): ${missingPrefixes.map((prefix) => String(prefix).padStart(2, '0')).join(', ')}` : 'no gaps'}</div></div>
    <h2 id="document-purpose">Document Purpose</h2><p>This document provides client-facing operating guidance and User Acceptance Testing (UAT) evidence for confirmed AlSafwa Cement Portal functionality. It uses only screenshots captured from the running application and separates implemented functionality from pending or unverified work.</p>
    <h2 id="portal-overview">Portal Overview</h2><p>The AlSafwa Cement Portal provides role-based customer onboarding, customer self-service, Sales review, pricing administration, Hader operations, commercial approval, and portal administration capabilities. The options visible to each user depend on their authenticated role and existing permissions.</p><div class="scope-card"><h3>Confirmed guide areas</h3><ul>${implementedAreas.map((area) => `<li>${htmlEscape(area)}</li>`).join('')}</ul></div>
    <h2 id="${slugify('User Roles & Responsibilities')}">User Roles &amp; Responsibilities</h2><table><thead><tr><th>Role</th><th>Responsibility in this guide</th></tr></thead><tbody>${roleRowsHtml}</tbody></table>
    <h2 id="${slugify('Login & Access')}">Login &amp; Access</h2><p>Portal base address: <a href="${htmlEscape(`${document.baseUrl}/`)}">${htmlEscape(`${document.baseUrl}/`)}</a></p><div class="table-scroll"><table><thead><tr><th>Role</th><th>Login URL</th><th>Access note</th></tr></thead><tbody>${loginRowsHtml}</tbody></table></div><ol><li>Open the login URL assigned to your role.</li><li>Sign in using credentials issued through the approved administration process.</li><li>Confirm that the displayed navigation matches your assigned responsibilities.</li><li>Use only approved UAT data and sign out when testing is complete.</li></ol><aside class="notice">Internal operational roles share <code>/sales/login</code>; the authenticated role controls the landing page, navigation, and protected routes. Credentials and authentication secrets are intentionally excluded from this document.</aside>
    ${guideSections}
    <h2 id="end-to-end-workflow">End-to-End Workflow</h2><ol><li>A prospective customer submits an organization registration.</li><li>Sales reviews, approves, and activates the customer account.</li><li>An authorized customer requests a quotation or submits a direct order.</li><li>Sales reviews quotation pricing and required approvals are completed before the customer decision.</li><li>An accepted quotation can become an active contract; customers can order against remaining contract TON.</li><li>Sales starts order processing and Hader prepares, loads, and dispatches the delivery shipment.</li><li>Delivery Team moves the shipment through In Transit and Delivered, records POD, and closes it.</li><li>A genuine Ship-to Variance can be raised by Price Manager for Commercial Director approval.</li></ol>
    <h2 id="uat-testing-guide">UAT Testing Guide</h2><p>Execute each case using an authorized account. Record the observed result and set Status to PASS, FAIL, BLOCKED, or NOT TESTED. Screenshot evidence demonstrates implemented screens but does not by itself claim that a UAT case passed.</p><div class="table-scroll"><table><thead><tr><th>Test ID</th><th>Role</th><th>Module</th><th>Scenario</th><th>Expected Result</th><th>Actual Result</th><th>Status</th><th>Comments</th></tr></thead><tbody>${uatRows}</tbody></table></div>
    <h2 id="uat-testing-checklist">UAT Testing Checklist</h2><div class="table-scroll"><table><thead><tr><th>Test ID</th><th>Module</th><th>Scenario</th><th>Tester</th><th>Date</th><th>Status</th><th>Comments</th></tr></thead><tbody>${checklistRows}</tbody></table></div>
    <h2 id="${slugify('Known Limitations & Pending Features')}">Known Limitations &amp; Pending Features</h2><p>The following functionality is pending or has not been verified as implemented. It must not be accepted during UAT as completed functionality:</p><div class="scope-card pending"><ul>${pendingAreas.map((area) => `<li>${htmlEscape(area)}</li>`).join('')}</ul></div>
    <h2 id="uat-sign-off">UAT Sign-Off</h2><table><thead><tr><th>Approval</th><th>Name</th><th>Role</th><th>Signature</th><th>Date</th></tr></thead><tbody><tr><td>Prepared by</td><td></td><td></td><td></td><td></td></tr><tr><td>Business reviewer</td><td></td><td></td><td></td><td></td></tr><tr><td>UAT approver</td><td></td><td></td><td></td><td></td></tr></tbody></table><p><strong>Overall UAT decision:</strong> ☐ Accepted &nbsp;&nbsp; ☐ Accepted with conditions &nbsp;&nbsp; ☐ Rejected</p><p><strong>Sign-off comments:</strong></p><div class="signoff-space"></div>
    ${unmappedSection}
    <section><h2 id="screenshot-evidence-register">Screenshot Evidence Register</h2><table><thead><tr><th>Sequence</th><th>Actual filename</th><th>Guide section</th></tr></thead><tbody>${evidenceRows}</tbody></table></section>
  </article>
</main>
</body>
</html>`;
};

const main = async () => {
  const discoveredScreenshots = await discoverScreenshots();
  const embeddedScreenshots = await embedScreenshots(discoveredScreenshots);
  const configuration = expandScreenshotRanges(await loadConfiguration(), discoveredScreenshots);
  const { mappedFiles, unmappedFiles } = validateConfiguration(configuration, discoveredScreenshots);
  const markdown = renderMarkdown(configuration, discoveredScreenshots, unmappedFiles);
  const html = renderHtml(configuration, discoveredScreenshots, unmappedFiles, embeddedScreenshots);

  await mkdir(outputDirectory, { recursive: true });
  const markdownPath = join(outputDirectory, 'AlSafwa_Cement_Portal_User_Guide_and_UAT.md');
  const htmlPath = join(outputDirectory, 'AlSafwa_Cement_Portal_User_Guide_and_UAT.html');
  await Promise.all([
    writeFile(markdownPath, `${markdown}\n`, 'utf8'),
    writeFile(htmlPath, html, 'utf8')
  ]);

  console.log(`Discovered ${discoveredScreenshots.length} screenshot(s).`);
  console.log(`Mapped ${mappedFiles.size} screenshot(s).`);
  const missingPrefixes = findMissingScreenshotPrefixes(discoveredScreenshots);
  console.log(`Screenshot numbering: 01-${String(numericPrefix(discoveredScreenshots.at(-1))).padStart(2, '0')}; ${missingPrefixes.length ? `missing prefix(es): ${missingPrefixes.map((prefix) => String(prefix).padStart(2, '0')).join(', ')}` : 'no gaps'}.`);
  console.log(`Generated ${configuration.uatCases.length} UAT case(s).`);
  console.log(`Documented ${configuration.loginRoutes.length} role login route(s).`);
  console.log(`Generated ${relative(process.cwd(), markdownPath)}.`);
  console.log(`Generated ${relative(process.cwd(), htmlPath)}.`);
  if (unmappedFiles.length > 0) {
    console.warn(`${unmappedFiles.length} screenshot(s) require classification in user-guide.config.json:`);
    unmappedFiles.forEach((file) => console.warn(`- ${file}`));
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
