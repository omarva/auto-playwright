#!/usr/bin/env node
/**
 * Builds the GitHub Pages test-report site from CI artifacts.
 *
 *   node scripts/build-report-site.mjs <collected-dir> <site-dir>
 *
 * <collected-dir> contains one folder per CI job named `results-<language>-<browser>`,
 * each holding that job's `reports/` folder (allure-results, junit, html, cucumber, ...).
 *
 * Output (<site-dir>):
 *   index.html                       dashboard with per-language cards
 *   summary.json                     machine-readable totals
 *   allure/<language>/               Allure report per language (all browsers)
 *   allure/combined/                 one Allure report for everything
 *   native/<language>/<browser>/     each language's own HTML report(s)
 *
 * Allure trend history is carried over between runs by downloading the previous
 * report's history/ folder from the live site (SITE_URL), so trends survive even
 * though every Pages deployment replaces the whole site.
 *
 * Also writes a Markdown summary to $GITHUB_STEP_SUMMARY when present.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [collectedArg = 'collected', siteArg = 'site'] = process.argv.slice(2);
const COLLECTED = path.resolve(collectedArg);
const SITE = path.resolve(siteArg);
const WORK = path.resolve('.allure-work');
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const ALLURE = process.env.ALLURE_BIN ?? 'allure';

const LANGUAGES = {
  typescript: { label: 'TypeScript', runner: 'cucumber-js', icon: 'TS', color: '#3178c6' },
  python: { label: 'Python', runner: 'pytest-bdd', icon: 'PY', color: '#3776ab' },
  java: { label: 'Java', runner: 'Cucumber-JVM', icon: 'JV', color: '#e76f00' },
  dotnet: { label: 'C# / .NET', runner: 'Reqnroll', icon: 'C#', color: '#68217a' },
};
const BROWSER_ORDER = ['chromium', 'firefox', 'webkit'];
const HISTORY_FILES = [
  'history.json',
  'history-trend.json',
  'duration-trend.json',
  'categories-trend.json',
  'retry-trend.json',
];

const CATEGORIES = [
  { name: 'Assertion failures', matchedStatuses: ['failed'], messageRegex: '.*(expect|Expected|assert|Assert).*' },
  { name: 'Timeouts', matchedStatuses: ['failed', 'broken'], messageRegex: '(?s).*(Timeout|timed out|TimeoutError).*' },
  {
    name: 'Network / environment problems',
    matchedStatuses: ['broken', 'failed'],
    messageRegex: '(?s).*(ECONNRESET|ENOTFOUND|net::ERR|ECONNREFUSED|socket hang up|NS_ERROR).*',
  },
  { name: 'Broken tests (code errors)', matchedStatuses: ['broken'] },
  { name: 'Skipped', matchedStatuses: ['skipped'] },
];

const md5 = (value) => crypto.createHash('md5').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function copyDir(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.cpSync(from, to, { recursive: true });
  return true;
}

function parseProperties(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([^#!][^=]*?)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1].replace(/\\ /g, ' ')] = match[2];
  }
  return out;
}

function writeProperties(file, props) {
  const lines = Object.entries(props).map(([k, v]) => `${k.replace(/ /g, '\\ ')}=${v}`);
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

/** Discover `results-<language>-<browser>` artifact folders. */
function discoverRuns() {
  if (!fs.existsSync(COLLECTED)) return [];
  return fs
    .readdirSync(COLLECTED, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => /^results-([a-z]+)-([a-z]+)$/.exec(d.name))
    .filter((m) => m && LANGUAGES[m[1]])
    .map((m) => ({ language: m[1], browser: m[2], dir: path.join(COLLECTED, m[0]) }))
    .sort(
      (a, b) =>
        Object.keys(LANGUAGES).indexOf(a.language) - Object.keys(LANGUAGES).indexOf(b.language) ||
        BROWSER_ORDER.indexOf(a.browser) - BROWSER_ORDER.indexOf(b.browser),
    );
}

/**
 * Copy one job's allure-results into `target`, tagging every result with language and
 * browser. historyId/testCaseId are re-derived so the same scenario on two browsers is
 * two tests (not one test with "retries") and trends stay stable across runs.
 */
function importAllureResults(run, target) {
  const source = path.join(run.dir, 'allure-results');
  if (!fs.existsSync(source)) return 0;
  fs.mkdirSync(target, { recursive: true });
  const meta = LANGUAGES[run.language];
  let count = 0;
  for (const name of fs.readdirSync(source)) {
    const from = path.join(source, name);
    if (!fs.statSync(from).isFile() || name === 'environment.properties' || name === 'executor.json') continue;
    if (!name.endsWith('-result.json')) {
      fs.copyFileSync(from, path.join(target, name));
      continue;
    }
    const result = readJson(from);
    const key = `${run.language}|${run.browser}|`;
    result.historyId = md5(key + (result.historyId ?? result.fullName ?? result.name));
    result.testCaseId = md5(key + (result.testCaseId ?? result.fullName ?? result.name));
    result.parameters = [
      ...(result.parameters ?? []).filter((p) => p.name !== 'Browser' && p.name !== 'Language'),
      { name: 'Language', value: meta.label },
      { name: 'Browser', value: run.browser },
    ];
    const labels = (result.labels ?? []).filter((l) => !['parentSuite', 'suite', 'language'].includes(l.name));
    const feature = (result.labels ?? []).find((l) => l.name === 'feature')?.value;
    if (!labels.some((l) => l.name === 'subSuite') && feature) labels.push({ name: 'subSuite', value: feature });
    labels.push(
      { name: 'parentSuite', value: meta.label },
      { name: 'suite', value: run.browser },
      { name: 'language', value: meta.label },
      { name: 'tag', value: `browser:${run.browser}` },
    );
    result.labels = labels;
    writeJson(path.join(target, name), result);
    count += 1;
  }
  return count;
}

async function restoreHistory(reportName, resultsDir) {
  if (!SITE_URL) return false;
  const historyDir = path.join(resultsDir, 'history');
  let restored = false;
  for (const file of HISTORY_FILES) {
    try {
      const response = await fetch(`${SITE_URL}/allure/${reportName}/history/${file}`);
      if (!response.ok) continue;
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(path.join(historyDir, file), Buffer.from(await response.arrayBuffer()));
      restored = true;
    } catch {
      // First deployment or site unreachable: start a fresh history.
    }
  }
  return restored;
}

function executorInfo(reportName, title) {
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  return {
    name: 'GitHub Actions',
    type: 'github',
    url: repo ? `${server}/${repo}` : undefined,
    buildOrder: Number(process.env.GITHUB_RUN_NUMBER ?? 0),
    buildName: `${process.env.GITHUB_WORKFLOW ?? 'local'} #${process.env.GITHUB_RUN_NUMBER ?? 0}`,
    buildUrl: repo && runId ? `${server}/${repo}/actions/runs/${runId}` : undefined,
    reportUrl: SITE_URL ? `${SITE_URL}/allure/${reportName}/` : undefined,
    reportName: title,
  };
}

function generateAllure(reportName, resultsDir, title) {
  const out = path.join(SITE, 'allure', reportName);
  const args = ['generate', resultsDir, '--clean', '--name', title, '-o', out];
  // Windows can only launch allure.bat through a shell, which needs manual quoting.
  const windows = process.platform === 'win32';
  const result = windows
    ? spawnSync([ALLURE, ...args].map((a) => `"${a}"`).join(' '), { stdio: 'inherit', shell: true })
    : spawnSync(ALLURE, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`allure generate failed for ${reportName}`);
  const summaryFile = path.join(out, 'widgets', 'summary.json');
  return fs.existsSync(summaryFile) ? readJson(summaryFile) : null;
}

function copyNativeReports(run) {
  const dest = path.join(SITE, 'native', run.language, run.browser);
  const links = [];
  if (copyDir(path.join(run.dir, 'html'), dest)) links.push({ label: 'HTML report', href: `native/${run.language}/${run.browser}/index.html` });
  const cucumberHtml = path.join(run.dir, 'cucumber', 'cucumber.html');
  if (fs.existsSync(cucumberHtml)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(cucumberHtml, path.join(dest, 'cucumber.html'));
    links.push({ label: 'Cucumber', href: `native/${run.language}/${run.browser}/cucumber.html` });
  }
  return links;
}

const emptyStats = () => ({ passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0, total: 0 });

function statsFrom(summary) {
  return { ...emptyStats(), ...(summary?.statistic ?? {}) };
}

function passRate(stats) {
  const executed = stats.total - stats.skipped;
  return executed > 0 ? Math.round((stats.passed / executed) * 1000) / 10 : 0;
}

function donut(stats, size = 132) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const segments = [
    ['passed', 'var(--ok)'],
    ['failed', 'var(--bad)'],
    ['broken', 'var(--warn)'],
    ['skipped', 'var(--muted)'],
  ];
  let offset = 0;
  const total = Math.max(stats.total, 1);
  const arcs = segments
    .map(([key, color]) => {
      const len = (stats[key] / total) * c;
      const arc = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}"/>`;
      offset += len;
      return len > 0 ? arc : '';
    })
    .join('');
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${passRate(stats)}% passed">
    <g transform="rotate(-90 60 60)"><circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--track)" stroke-width="14"/>${arcs}</g>
    <text x="60" y="58" text-anchor="middle" class="donut-value">${passRate(stats)}%</text>
    <text x="60" y="76" text-anchor="middle" class="donut-label">passed</text></svg>`;
}

function renderDashboard(model) {
  const { totals, languages, generatedAt, run } = model;
  const status = totals.failed + totals.broken === 0 ? 'ok' : 'bad';
  const cards = languages
    .map((lang) => {
      const browsers = lang.browsers
        .map(
          (b) => `<li><span class="browser">${escapeHtml(b.browser)}</span>
            <span class="pill ${b.stats.failed + b.stats.broken ? 'bad' : 'ok'}">${b.stats.passed}/${b.stats.total - b.stats.skipped}</span>
            ${b.links.map((l) => `<a href="${l.href}">${escapeHtml(l.label)}</a>`).join('')}</li>`,
        )
        .join('');
      return `<article class="card" style="--accent:${lang.meta.color}">
        <header><span class="badge">${lang.meta.icon}</span><div><h2>${escapeHtml(lang.meta.label)}</h2><p>${escapeHtml(lang.meta.runner)} · Playwright</p></div></header>
        <div class="card-body">${donut(lang.stats)}
          <dl><div><dt>Passed</dt><dd class="ok">${lang.stats.passed}</dd></div><div><dt>Failed</dt><dd class="bad">${lang.stats.failed}</dd></div>
          <div><dt>Broken</dt><dd class="warn">${lang.stats.broken}</dd></div><div><dt>Skipped</dt><dd>${lang.stats.skipped}</dd></div></dl></div>
        <ul class="browsers">${browsers}</ul>
        <a class="cta" href="allure/${lang.key}/index.html">Open Allure report →</a>
      </article>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test Report Dashboard</title>
<meta name="description" content="Playwright + Cucumber test results across TypeScript, Python, Java and C#">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f7fb;--panel:#ffffff;--text:#0f172a;--sub:#475569;--line:#e2e8f0;--track:#e9edf3;--ok:#16a34a;--bad:#dc2626;--warn:#d97706;--muted:#94a3b8;--hero1:#2563eb;--hero2:#7c3aed}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b1020;--panel:#121a2e;--text:#e5e9f5;--sub:#94a3b8;--line:#22304d;--track:#1f2a44;--ok:#22c55e;--bad:#f87171;--warn:#fbbf24;--muted:#64748b}}
:root[data-theme="dark"]{--bg:#0b1020;--panel:#121a2e;--text:#e5e9f5;--sub:#94a3b8;--line:#22304d;--track:#1f2a44;--ok:#22c55e;--bad:#f87171;--warn:#fbbf24;--muted:#64748b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
a{color:inherit}.wrap{max-width:1180px;margin:0 auto;padding:0 16px}
.hero{background:linear-gradient(135deg,var(--hero1),var(--hero2));color:#fff;padding:48px 0 88px}
.hero h1{margin:0 0 6px;font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-.02em}.hero p{margin:0;opacity:.9}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.meta span,.meta a{background:rgba(255,255,255,.16);border-radius:999px;padding:4px 12px;font-size:13px;text-decoration:none}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:-56px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:0 8px 24px rgba(15,23,42,.06)}
.stat b{display:block;font-size:30px;font-weight:800;letter-spacing:-.02em}.stat small{color:var(--sub);text-transform:uppercase;letter-spacing:.06em;font-size:11px;font-weight:600}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
.status{display:inline-flex;align-items:center;gap:8px;font-weight:700}.status::before{content:"";width:10px;height:10px;border-radius:50%;background:currentColor}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;margin:28px 0}
.card{background:var(--panel);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px}
.card header{display:flex;gap:12px;align-items:center}.card h2{margin:0;font-size:18px}.card header p{margin:0;color:var(--sub);font-size:13px}
.badge{width:40px;height:40px;border-radius:10px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px}
.card-body{display:flex;align-items:center;gap:16px}.card dl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;flex:1}
.card dt{color:var(--sub);font-size:12px}.card dd{margin:0;font-weight:700;font-size:18px}
.donut-value{font-size:20px;font-weight:800;fill:var(--text)}.donut-label{font-size:10px;fill:var(--sub)}
.browsers{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}.browsers li{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
.browser{font-weight:600;min-width:72px;text-transform:capitalize}.browsers a{font-size:13px;color:var(--sub)}.browsers a:hover{color:var(--text)}
.pill{font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px;background:var(--track)}
.cta{margin-top:auto;display:block;text-align:center;text-decoration:none;font-weight:600;border-radius:10px;padding:10px;background:var(--accent);color:#fff}
.combined{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px}
.combined a{font-weight:600;text-decoration:none;background:var(--text);color:var(--bg);padding:10px 16px;border-radius:10px}
footer{color:var(--sub);font-size:13px;padding:24px 0 40px}
</style></head><body>
<section class="hero"><div class="wrap"><h1>Playwright × Cucumber test report</h1>
<p>One shared Gherkin suite running in four languages and three browser engines.</p>
<div class="meta"><span class="status" style="color:#fff">${status === 'ok' ? 'All green' : 'Failures detected'}</span>
<span>${escapeHtml(generatedAt)}</span>${run.commit ? `<span>commit ${escapeHtml(run.commit)}</span>` : ''}
${run.url ? `<a href="${run.url}">CI run #${escapeHtml(run.number)}</a>` : ''}${run.repo ? `<a href="${run.repo}">Repository</a>` : ''}</div></div></section>
<main class="wrap">
<section class="summary">
<div class="stat"><small>Pass rate</small><b class="${status}">${passRate(totals)}%</b></div>
<div class="stat"><small>Total</small><b>${totals.total}</b></div>
<div class="stat"><small>Passed</small><b class="ok">${totals.passed}</b></div>
<div class="stat"><small>Failed</small><b class="bad">${totals.failed}</b></div>
<div class="stat"><small>Broken</small><b class="warn">${totals.broken}</b></div>
<div class="stat"><small>Skipped</small><b>${totals.skipped}</b></div>
</section>
<section class="grid">${cards}</section>
<section class="combined"><div><strong>Combined Allure report</strong><br><span style="color:var(--sub)">Every language and browser in one place, grouped as Language → Browser → Feature.</span></div>
<a href="allure/combined/index.html">Open combined report →</a></section>
</main>
<footer class="wrap">Generated by scripts/build-report-site.mjs · Allure trend history is kept across runs.</footer>
</body></html>`;
}

function stepSummary(model) {
  const rows = model.languages.flatMap((lang) =>
    lang.browsers.map((b) => {
      const icon = b.stats.failed + b.stats.broken ? '❌' : '✅';
      return `| ${icon} | ${lang.meta.label} | ${b.browser} | ${b.stats.passed} | ${b.stats.failed} | ${b.stats.broken} | ${b.stats.skipped} | ${b.stats.total} |`;
    }),
  );
  const t = model.totals;
  return [
    `## 🎭 Playwright × Cucumber results: ${passRate(t)}% passed`,
    '',
    '| | Language | Browser | Passed | Failed | Broken | Skipped | Total |',
    '|---|---|---|---:|---:|---:|---:|---:|',
    ...rows,
    `| | **All** | | **${t.passed}** | **${t.failed}** | **${t.broken}** | **${t.skipped}** | **${t.total}** |`,
    '',
    SITE_URL ? `📊 [Open the report dashboard](${SITE_URL}/)` : '📦 Download the `test-report-site` artifact for the full reports.',
    '',
  ].join('\n');
}

async function main() {
  const runs = discoverRuns();
  if (runs.length === 0) {
    console.error(`No results-<language>-<browser> folders found in ${COLLECTED}`);
    process.exit(1);
  }
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.rmSync(SITE, { recursive: true, force: true });
  fs.mkdirSync(SITE, { recursive: true });

  const byLanguage = new Map();
  for (const run of runs) {
    if (!byLanguage.has(run.language)) byLanguage.set(run.language, []);
    byLanguage.get(run.language).push(run);
  }

  const reports = [
    ...[...byLanguage.entries()].map(([key, langRuns]) => ({ key, title: `${LANGUAGES[key].label} · Playwright + Cucumber`, runs: langRuns })),
    { key: 'combined', title: 'All languages · Playwright + Cucumber', runs },
  ];

  const summaries = {};
  for (const report of reports) {
    const dir = path.join(WORK, report.key);
    let imported = 0;
    const env = {};
    for (const run of report.runs) {
      imported += importAllureResults(run, dir);
      for (const [k, v] of Object.entries(parseProperties(path.join(run.dir, 'allure-results', 'environment.properties')))) {
        if (k === 'Browser') continue;
        env[k] = env[k] && !env[k].split(', ').includes(v) ? `${env[k]}, ${v}` : v;
      }
    }
    if (imported === 0) continue;
    env.Browsers = [...new Set(report.runs.map((r) => r.browser))].join(', ');
    if (report.key === 'combined') env.Languages = [...byLanguage.keys()].map((k) => LANGUAGES[k].label).join(', ');
    writeProperties(path.join(dir, 'environment.properties'), env);
    writeJson(path.join(dir, 'categories.json'), CATEGORIES);
    writeJson(path.join(dir, 'executor.json'), executorInfo(report.key, report.title));
    const restored = await restoreHistory(report.key, dir);
    console.log(`▶ ${report.key}: ${imported} results${restored ? ' (+history)' : ''}`);
    summaries[report.key] = generateAllure(report.key, dir, report.title);
  }

  // Per-browser stats come from the raw results so each cell in the dashboard is exact.
  const languages = [...byLanguage.entries()].map(([key, langRuns]) => ({
    key,
    meta: LANGUAGES[key],
    stats: statsFrom(summaries[key]),
    browsers: langRuns.map((run) => ({ browser: run.browser, stats: rawStats(run), links: copyNativeReports(run) })),
  }));

  const totals = statsFrom(summaries.combined);
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY;
  const model = {
    totals,
    languages,
    generatedAt: new Date().toUTCString(),
    run: {
      number: process.env.GITHUB_RUN_NUMBER ?? 'local',
      commit: process.env.GITHUB_SHA?.slice(0, 7),
      url: repo ? `${server}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
      repo: repo ? `${server}/${repo}` : undefined,
    },
  };

  fs.writeFileSync(path.join(SITE, 'index.html'), renderDashboard(model));
  writeJson(path.join(SITE, 'summary.json'), {
    generatedAt: model.generatedAt,
    run: model.run,
    totals,
    passRate: passRate(totals),
    languages: languages.map((l) => ({ language: l.key, stats: l.stats, browsers: l.browsers.map((b) => ({ browser: b.browser, stats: b.stats })) })),
  });
  fs.writeFileSync(path.join(SITE, '.nojekyll'), '');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, stepSummary(model));
  console.log(`✔ Site written to ${SITE} - ${totals.passed}/${totals.total} passed`);
}

/** Final status per test (latest attempt wins), counted straight from allure-results. */
function rawStats(run) {
  const dir = path.join(run.dir, 'allure-results');
  const stats = emptyStats();
  if (!fs.existsSync(dir)) return stats;
  const latest = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('-result.json')) continue;
    const r = readJson(path.join(dir, name));
    const id = r.historyId ?? r.fullName ?? r.name;
    const prev = latest.get(id);
    if (!prev || (r.stop ?? 0) > (prev.stop ?? 0)) latest.set(id, r);
  }
  for (const r of latest.values()) {
    const key = ['passed', 'failed', 'broken', 'skipped'].includes(r.status) ? r.status : 'unknown';
    stats[key] += 1;
    stats.total += 1;
  }
  return stats;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
