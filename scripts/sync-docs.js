'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'website', 'docs');

const SOURCES = [
    {
        from: 'README.md',
        to: 'intro.md',
        title: 'Introduction',
        slug: '/',
        sidebarPosition: 1,
    },
    {
        from: 'LIB.md',
        to: 'lib.md',
        title: 'Library API',
        sidebarPosition: 2,
    },
    {
        from: 'LANGUAGE.md',
        to: 'language.md',
        title: 'Template language',
        sidebarPosition: 3,
    },
    {
        from: 'HELPERS.md',
        to: 'helpers.md',
        title: 'Built-in helpers',
        sidebarPosition: 4,
    },
    {
        from: 'CONTRIBUTING.md',
        to: 'contributing.md',
        title: 'Contributing',
        sidebarPosition: 5,
    },
];

const MUSTACHE_COMPAT_DIR = 'mustache-compat';
const MUSTACHE_COMPAT_TITLE_OVERRIDES = {
    'README.md': 'Overview',
};

const FILE_LINK_REWRITES = [
    { pattern: /\bmustache-compat\/README\.md/g, replacement: '/docs/mustache-compat' },
    { pattern: /\bmustache-compat\/([a-z0-9-]+)\.md/g, replacement: '/docs/mustache-compat/$1' },
    { pattern: /\.\.\/README\.md/g, replacement: '/docs/' },
    { pattern: /\.\.\/LIB\.md/g, replacement: '/docs/lib' },
    { pattern: /\.\.\/LANGUAGE\.md/g, replacement: '/docs/language' },
    { pattern: /\.\.\/HELPERS\.md/g, replacement: '/docs/helpers' },
    { pattern: /(?:\.\/)?LIB\.md/g, replacement: '/docs/lib' },
    { pattern: /(?:\.\/)?LANGUAGE\.md/g, replacement: '/docs/language' },
    { pattern: /(?:\.\/)?HELPERS\.md/g, replacement: '/docs/helpers' },
    { pattern: /(?:\.\/)?CONTRIBUTING\.md/g, replacement: '/docs/contributing' },
    { pattern: /(?:\.\/)?README\.md/g, replacement: '/docs/' },
];

const MUSTACHE_COMPAT_LINK_REWRITES = [
    { pattern: /\]\(README\.md/g, replacement: '](/docs/mustache-compat' },
    { pattern: /\]\(([a-z0-9-]+)\.md/g, replacement: '](/docs/mustache-compat/$1' },
];

const ANCHOR_REWRITES = [
    { pattern: /#Cloning-Bigodin\b/g, replacement: '#cloning-bigodin' },
];

function rewriteLinks(body, extraRewrites = []) {
    let out = body;
    for (const { pattern, replacement } of FILE_LINK_REWRITES) {
        out = out.replace(pattern, replacement);
    }
    for (const { pattern, replacement } of extraRewrites) {
        out = out.replace(pattern, replacement);
    }
    for (const { pattern, replacement } of ANCHOR_REWRITES) {
        out = out.replace(pattern, replacement);
    }
    return out;
}

function stripLeadingTitle(body) {
    const m = body.match(/^\s*#\s+([^\n]+)\n+/);
    if (!m) {
        return { body, title: null };
    }
    return { body: body.slice(m[0].length), title: m[1].trim() };
}

function buildFrontmatter(meta) {
    const lines = ['---'];
    lines.push(`title: ${JSON.stringify(meta.title)}`);
    if (meta.slug) {
        lines.push(`slug: ${JSON.stringify(meta.slug)}`);
    }
    if (typeof meta.sidebarPosition === 'number') {
        lines.push(`sidebar_position: ${meta.sidebarPosition}`);
    }
    if (meta.sidebarLabel) {
        lines.push(`sidebar_label: ${JSON.stringify(meta.sidebarLabel)}`);
    }
    lines.push(`# Auto-generated from ${meta.from}; edit the source file in the repo root.`);
    lines.push('---');
    lines.push('');
    return lines.join('\n');
}

function writeDoc(meta) {
    const sourcePath = path.join(ROOT, meta.from);
    if (!fs.existsSync(sourcePath)) {
        console.warn(`[sync-docs] skipping missing source: ${meta.from}`);
        return;
    }
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const { body } = stripLeadingTitle(raw);
    const out = buildFrontmatter(meta) + rewriteLinks(body);
    const outPath = path.join(OUT_DIR, meta.to);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, out);
    console.log(`[sync-docs] ${meta.from} -> website/docs/${meta.to}`);
}

function syncMustacheCompat() {
    const sourceDir = path.join(ROOT, MUSTACHE_COMPAT_DIR);
    if (!fs.existsSync(sourceDir)) {
        return;
    }
    const outDir = path.join(OUT_DIR, MUSTACHE_COMPAT_DIR);
    fs.mkdirSync(outDir, { recursive: true });

    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
    let position = 1;
    for (const file of files.sort()) {
        const isReadme = file === 'README.md';
        const sourcePath = path.join(sourceDir, file);
        const raw = fs.readFileSync(sourcePath, 'utf8');
        const { body, title: extractedTitle } = stripLeadingTitle(raw);
        const title = MUSTACHE_COMPAT_TITLE_OVERRIDES[file]
            || extractedTitle
            || file.replace(/\.md$/, '');
        const slug = isReadme ? '/mustache-compat' : undefined;
        const meta = {
            from: `${MUSTACHE_COMPAT_DIR}/${file}`,
            to: path.join(MUSTACHE_COMPAT_DIR, isReadme ? 'index.md' : file),
            title,
            slug,
            sidebarPosition: isReadme ? 0 : position++,
        };
        const out = buildFrontmatter(meta) + rewriteLinks(body, MUSTACHE_COMPAT_LINK_REWRITES);
        const outPath = path.join(OUT_DIR, meta.to);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, out);
        console.log(`[sync-docs] ${meta.from} -> website/docs/${meta.to}`);
    }

    const categoryFile = path.join(outDir, '_category_.json');
    fs.writeFileSync(
        categoryFile,
        JSON.stringify({
            label: 'Mustache spec compatibility',
            position: 6,
            link: { type: 'doc', id: 'mustache-compat/index' },
        }, null, 2) + '\n',
    );
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const meta of SOURCES) {
    writeDoc(meta);
}
syncMustacheCompat();
