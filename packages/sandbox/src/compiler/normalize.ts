import type { SandboxProps } from '../shared/protocol'
import { SandboxCompileError } from '../host/errors'

export interface NormalizedSandboxGraph {
  entryPath: string
  cssText?: string
  files: Record<string, string>
}

export function normalizeVirtualPath(value: string) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.replace(/\/{2,}/g, '/')
}

export function normalizeSandboxGraph(
  props: SandboxProps
): NormalizedSandboxGraph {
  const files: Record<string, string> = {}

  for (const [name, source] of Object.entries(props.source || {})) {
    files[normalizeVirtualPath(name)] = source
  }

  const hasMainTs = '/main.ts' in files
  const hasMainJs = '/main.js' in files

  if (hasMainTs && hasMainJs) {
    throw new SandboxCompileError(
      'Sandbox source must provide exactly one entry file: "main.ts" or "main.js".'
    )
  }

  const entryPath = hasMainTs ? '/main.ts' : hasMainJs ? '/main.js' : null
  if (!entryPath) {
    throw new SandboxCompileError(
      'Sandbox source must provide exactly one entry file: "main.ts" or "main.js".'
    )
  }

  const cssText = files['/main.css']
  delete files['/main.css']

  return {
    entryPath,
    cssText,
    files,
  }
}
