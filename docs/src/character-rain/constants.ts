// Arrow-themed JavaScript tokens grouped by syntax role (for coloring)
export const TOKEN_GROUPS = {
  keyword:    ['const', 'let', 'if', 'else', 'return', 'async', 'await', 'import', 'export', 'new', 'typeof'],
  punctuation: ['{}', '[]', '()', ';', '?.', '...', '</>'],
  operator:   ['=>', '===', '!==', '&&', '||', '??', '++', '+='],
  template:   ['${}', '@click', '@input', 'html`', '${()=>'],
  function:   ['map', 'watch', 'reactive', 'html', 'component'],
  builtin:    ['true', 'false', 'null', 'this'],
  comment:    ['//'],
} as const

export type TokenRole = keyof typeof TOKEN_GROUPS

export const ALL_TOKENS: { char: string; role: TokenRole }[] = []
for (const [role, tokens] of Object.entries(TOKEN_GROUPS)) {
  for (const char of tokens) {
    ALL_TOKENS.push({ char, role: role as TokenRole })
  }
}

// Monochrome palette — same color for all roles
export const TOKEN_COLORS: Record<'dark' | 'light', Record<TokenRole, string>> = {
  dark: {
    keyword:     '#ffb000',
    punctuation: '#ffb000',
    operator:    '#ffb000',
    template:    '#ffb000',
    comment:     '#ffb000',
    function:    '#ffb000',
    builtin:     '#ffb000',
  },
  light: {
    keyword:     '#71717a',
    punctuation: '#71717a',
    operator:    '#71717a',
    template:    '#71717a',
    comment:     '#71717a',
    function:    '#71717a',
    builtin:     '#71717a',
  },
}

export const FONT = '16px "JetBrains Mono", monospace'

export const OPACITY = {
  dark:  { min: 0.12, max: 0.28 },
  light: { min: 0.1, max: 0.24 },
}

export const PHYSICS = {
  gravity: { x: 0, y: 0.12 },
  characterFriction: 0,
  characterRestitution: 0.55,
  characterDensity: 0.0006,
  characterFrictionAir: 0.012,
  colliderFriction: 0,
  colliderRestitution: 0.5,
  cursorRadius: 80,
  cursorRepelStrength: 0.008,
  cursorRepelRadius: 120,
  spawnAngularVelocity: 0.08,
}

export const SPAWN = {
  interval: 150,
  spawnMargin: -0.05,
  spawnY: -30,
  despawnMargin: 50,
  lifetimeMin: 4000,   // ms before fade starts
  lifetimeMax: 16000,
  fadeDuration: 2000,  // ms to fade from full to zero
}

export const MOBILE_BREAKPOINT = 768

export const MOBILE_SPAWN = {
  interval: 300,
}

export const RESIZE_DEBOUNCE = 250
export const DPR_CAP = 2
