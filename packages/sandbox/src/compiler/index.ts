import ts from 'typescript'
import { preprocessModule } from './module'
import { normalizeSandboxGraph } from './normalize'
import type { SandboxProps, TemplateDescriptor } from '../shared/protocol'
import { SandboxCompileError } from '../host/errors'

export interface CompiledSandboxGraph {
  entryPath: string
  cssText?: string
  modules: Record<string, string>
  descriptors: Record<string, TemplateDescriptor>
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  return diagnostics
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )

      if (!diagnostic.file || diagnostic.start == null) {
        return message
      }

      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      )

      return `${diagnostic.file.fileName}:${line + 1}:${character + 1} ${message}`
    })
    .join('\n')
}

function transpileModule(path: string, source: string) {
  const result = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      sourceMap: false,
      inlineSourceMap: false,
    },
    reportDiagnostics: true,
  })

  const diagnostics =
    result.diagnostics?.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
    ) || []

  if (diagnostics.length) {
    throw new SandboxCompileError(formatDiagnostics(diagnostics))
  }

  return result.outputText
}

export function compileSandboxGraph(
  props: SandboxProps
): CompiledSandboxGraph {
  const normalized = normalizeSandboxGraph(props)
  const modules: Record<string, string> = {}
  const descriptors: Record<string, TemplateDescriptor> = {}

  for (const [path, source] of Object.entries(normalized.files)) {
    const emitted = transpileModule(path, source)
    const processed = preprocessModule(emitted, path)
    modules[path] = processed.code

    for (const descriptor of processed.descriptors) {
      descriptors[descriptor.id] = descriptor
    }
  }

  return {
    entryPath: normalized.entryPath,
    cssText: normalized.cssText,
    modules,
    descriptors,
  }
}
