/**
 * Landing Page Content for DevBar
 *
 * Creates the hero section and documentation overview using DevBar styling.
 */

/**
 * Helper to create a text element
 */
function createTextElement(tag: string, className: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/**
 * Helper to create an anchor element
 */
function createLink(href: string, child: HTMLElement): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.appendChild(child);
  return a;
}

/**
 * Helper to create an image element
 */
function createImage(src: string, alt: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  return img;
}

/**
 * Create the landing page hero section
 */
export function createLandingHero(): HTMLElement {
  const hero = document.createElement('section');
  hero.className = 'landing-hero';

  // Logo/Title
  const title = document.createElement('h1');
  title.className = 'landing-title';
  title.textContent = 'devbar';
  hero.appendChild(title);

  // Tagline
  hero.appendChild(
    createTextElement('p', 'landing-tagline', 'Development toolbar and AI debugging toolkit')
  );

  // Badges
  const badges = document.createElement('div');
  badges.className = 'landing-badges';
  badges.appendChild(
    createLink(
      'https://www.npmjs.com/package/@ytspar/devbar',
      createImage(
        'https://img.shields.io/npm/v/@ytspar/devbar?style=flat-square&color=10b981',
        'devbar npm'
      )
    )
  );
  badges.appendChild(
    createLink(
      'https://www.npmjs.com/package/@ytspar/sweetlink',
      createImage(
        'https://img.shields.io/npm/v/@ytspar/sweetlink?style=flat-square&color=10b981',
        'sweetlink npm'
      )
    )
  );
  badges.appendChild(
    createLink(
      'https://github.com/ytspar/devtools',
      createImage(
        'https://img.shields.io/github/stars/ytspar/devtools?style=flat-square&color=10b981',
        'GitHub stars'
      )
    )
  );
  hero.appendChild(badges);

  // Quick install
  const install = document.createElement('div');
  install.className = 'landing-install';
  const code = document.createElement('code');
  code.textContent = 'pnpm add @ytspar/devbar @ytspar/sweetlink';
  install.appendChild(code);
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText('pnpm add @ytspar/devbar @ytspar/sweetlink');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  });
  install.appendChild(copyBtn);
  hero.appendChild(install);

  return hero;
}

/**
 * Syntax highlighting tokens for code blocks
 */
interface Token {
  type: 'keyword' | 'string' | 'comment' | 'function' | 'property' | 'operator' | 'number' | 'text';
  value: string;
}

/**
 * Simple syntax highlighter for TypeScript/JavaScript
 */
function highlightCode(code: string, language: 'typescript' | 'bash' = 'typescript'): HTMLElement {
  const pre = document.createElement('pre');
  pre.className = 'code-block';
  const codeEl = document.createElement('code');
  codeEl.className = `language-${language}`;

  if (language === 'bash') {
    // Simple bash highlighting
    const lines = code.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('#')) {
        // Comment
        const span = document.createElement('span');
        span.className = 'token-comment';
        span.textContent = line;
        codeEl.appendChild(span);
      } else {
        // Highlight command and flags
        const parts = line.split(/(\s+)/);
        let isFirst = true;
        for (const part of parts) {
          if (part.trim() === '') {
            codeEl.appendChild(document.createTextNode(part));
            continue;
          }
          const span = document.createElement('span');
          if (isFirst && part.trim()) {
            span.className = 'token-function';
            isFirst = false;
          } else if (part.startsWith('--') || part.startsWith('-')) {
            span.className = 'token-property';
          } else if (part.startsWith('"') || part.startsWith("'")) {
            span.className = 'token-string';
          } else {
            span.className = 'token-text';
          }
          span.textContent = part;
          codeEl.appendChild(span);
        }
      }
      codeEl.appendChild(document.createTextNode('\n'));
    }
  } else {
    // TypeScript highlighting
    const tokens = tokenizeTS(code);
    for (const token of tokens) {
      const span = document.createElement('span');
      span.className = `token-${token.type}`;
      span.textContent = token.value;
      codeEl.appendChild(span);
    }
  }

  pre.appendChild(codeEl);
  return pre;
}

/**
 * Tokenize TypeScript code for syntax highlighting
 */
function tokenizeTS(code: string): Token[] {
  const tokens: Token[] = [];
  const keywords = [
    'import',
    'export',
    'from',
    'const',
    'let',
    'var',
    'if',
    'else',
    'return',
    'function',
    'default',
    'async',
    'await',
  ];

  let i = 0;
  while (i < code.length) {
    // Comments
    if (code.slice(i, i + 2) === '//') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Strings
    if (code[i] === "'" || code[i] === '"' || code[i] === '`') {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++;
        j++;
      }
      tokens.push({ type: 'string', value: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Words (keywords, identifiers)
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);

      // Check if followed by ( for function calls
      let nextNonSpace = j;
      while (nextNonSpace < code.length && code[nextNonSpace] === ' ') nextNonSpace++;

      if (keywords.includes(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (code[nextNonSpace] === '(') {
        tokens.push({ type: 'function', value: word });
      } else if (code[i - 1] === '.') {
        tokens.push({ type: 'property', value: word });
      } else {
        tokens.push({ type: 'text', value: word });
      }
      i = j;
      continue;
    }

    // Operators
    if (/[{}()[\];:,.<>=+\-*/&|!?]/.test(code[i])) {
      tokens.push({ type: 'operator', value: code[i] });
      i++;
      continue;
    }

    // Whitespace and other
    tokens.push({ type: 'text', value: code[i] });
    i++;
  }

  return tokens;
}

/**
 * Create the features overview section - DevBar toolbar features
 */
export function createFeaturesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'landing-features';

  section.appendChild(createTextElement('h2', 'section-heading', 'DevBar Toolbar'));

  const features = [
    {
      title: 'Breakpoint Indicator',
      description:
        'Shows current Tailwind CSS breakpoint (sm, md, lg, xl, 2xl) with viewport dimensions.',
    },
    {
      title: 'Core Web Vitals',
      description:
        'Real-time FCP, LCP, CLS, and INP metrics. Monitor performance without opening DevTools.',
    },
    {
      title: 'Console Badges',
      description:
        'Visual error and warning counts. Quickly spot issues without checking the console.',
    },
    {
      title: 'One-Click Screenshots',
      description:
        'Capture full page or element screenshots. Copies to clipboard or saves to disk.',
    },
    {
      title: 'Custom Controls',
      description:
        'Register app-specific debug buttons. Add "Clear Cache", "Reset State", or any action.',
    },
    {
      title: 'Theme System',
      description: 'Dark/light modes with system preference detection. Multiple accent colors.',
    },
  ];

  const grid = document.createElement('div');
  grid.className = 'features-grid';

  for (const feature of features) {
    const card = document.createElement('div');
    card.className = 'feature-card';

    card.appendChild(createTextElement('h3', 'feature-title', feature.title));
    card.appendChild(createTextElement('p', 'feature-description', feature.description));

    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/**
 * Create the Sweetlink features section - AI agent toolkit
 */
export function createSweetlinkSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'landing-features sweetlink-features';

  section.appendChild(createTextElement('h2', 'section-heading', 'Sweetlink AI Bridge'));

  const features = [
    {
      title: 'Token-Efficient Screenshots',
      description:
        'Compressed images via WebSocket. ~1,000 tokens vs ~15,000 for CDP. Saves context window.',
    },
    {
      title: 'Console Log Streaming',
      description:
        'Real-time log capture with filtering. Errors, warnings, and info with timestamps.',
    },
    {
      title: 'HMR Auto-Capture',
      description:
        'Automatic screenshots on hot reload. AI sees changes immediately after code edits.',
    },
    {
      title: 'Design Review',
      description:
        'Claude Vision integration for automated UI analysis. Catches visual bugs and accessibility issues.',
    },
    {
      title: 'CLI for AI Agents',
      description:
        'Commands that AI assistants can run: screenshot, logs, query, refresh. Built for automation.',
    },
    {
      title: 'WebSocket Bridge',
      description:
        'Real-time bidirectional communication. Auto-reconnect with exponential backoff.',
    },
  ];

  const grid = document.createElement('div');
  grid.className = 'features-grid';

  for (const feature of features) {
    const card = document.createElement('div');
    card.className = 'feature-card';

    card.appendChild(createTextElement('h3', 'feature-title', feature.title));
    card.appendChild(createTextElement('p', 'feature-description', feature.description));

    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/**
 * Create the packages overview section
 */
export function createPackagesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'landing-packages';

  section.appendChild(createTextElement('h2', 'section-heading', 'Packages'));

  const packages = [
    {
      name: '@ytspar/devbar',
      description: 'Compact development toolbar. Framework-agnostic vanilla JS.',
      features: [
        'Tailwind breakpoint + viewport size',
        'Core Web Vitals (FCP, LCP, CLS, INP)',
        'Console error/warning badges',
        'Screenshot capture to clipboard',
        'Extensible custom controls',
        'Dark/light theme with accents',
      ],
    },
    {
      name: '@ytspar/sweetlink',
      description: 'WebSocket bridge for AI agent browser debugging.',
      features: [
        'Token-efficient screenshots (~1k tokens)',
        'Console log capture + streaming',
        'HMR auto-screenshot on code changes',
        'Claude Vision design review',
        'CLI commands for automation',
        'Vite plugin for zero-config setup',
      ],
    },
  ];

  const grid = document.createElement('div');
  grid.className = 'packages-grid';

  for (const pkg of packages) {
    const card = document.createElement('div');
    card.className = 'package-card';

    card.appendChild(createTextElement('h3', 'package-name', pkg.name));
    card.appendChild(createTextElement('p', 'package-description', pkg.description));

    const list = document.createElement('ul');
    list.className = 'package-features';
    for (const feature of pkg.features) {
      const li = document.createElement('li');
      li.textContent = feature;
      list.appendChild(li);
    }
    card.appendChild(list);

    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/**
 * Create the quick start section with syntax-highlighted code
 */
export function createQuickStartSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'landing-quickstart';

  section.appendChild(createTextElement('h2', 'section-heading', 'Quick Start'));

  const steps = document.createElement('div');
  steps.className = 'quickstart-steps';

  // Step 1: Install
  const installStep = document.createElement('div');
  installStep.className = 'quickstart-step';
  installStep.appendChild(createTextElement('h3', 'step-title', '1. Install'));
  installStep.appendChild(highlightCode(`pnpm add @ytspar/devbar @ytspar/sweetlink`, 'bash'));
  steps.appendChild(installStep);

  // Step 2: Vite setup
  const viteStep = document.createElement('div');
  viteStep.className = 'quickstart-step';
  viteStep.appendChild(createTextElement('h3', 'step-title', '2. Add Vite Plugin'));
  viteStep.appendChild(
    highlightCode(
      `// vite.config.ts
import { sweetlink } from '@ytspar/sweetlink/vite'

export default defineConfig({
  plugins: [sweetlink()]
})`,
      'typescript'
    )
  );
  steps.appendChild(viteStep);

  // Step 3: DevBar setup
  const devbarStep = document.createElement('div');
  devbarStep.className = 'quickstart-step';
  devbarStep.appendChild(createTextElement('h3', 'step-title', '3. Initialize DevBar'));
  devbarStep.appendChild(
    highlightCode(
      `// main.ts
import { initGlobalDevBar } from '@ytspar/devbar'

if (import.meta.env.DEV) {
  initGlobalDevBar()
}`,
      'typescript'
    )
  );
  steps.appendChild(devbarStep);

  // Step 4: CLI usage
  const cliStep = document.createElement('div');
  cliStep.className = 'quickstart-step';
  cliStep.appendChild(createTextElement('h3', 'step-title', '4. Use CLI'));
  cliStep.appendChild(
    highlightCode(
      `pnpm sweetlink screenshot   # Capture page
pnpm sweetlink logs         # Get console output
pnpm sweetlink refresh      # Reload browser`,
      'bash'
    )
  );
  steps.appendChild(cliStep);

  section.appendChild(steps);
  return section;
}

/**
 * Create the demo section divider
 */
export function createDemoSectionDivider(): HTMLElement {
  const divider = document.createElement('div');
  divider.className = 'demo-divider';

  const line1 = document.createElement('div');
  line1.className = 'divider-line';
  divider.appendChild(line1);

  divider.appendChild(createTextElement('span', 'divider-text', 'Interactive Demo'));

  const line2 = document.createElement('div');
  line2.className = 'divider-line';
  divider.appendChild(line2);

  return divider;
}
