export type {
  SandboxEvents,
  SandboxProps,
} from './shared/protocol'

export type {
  HostToVmMessage,
  SandboxedEventPayload,
  SandboxedEventTargetSnapshot,
  SerializedNode,
  TemplateDescriptor,
  VmPatch,
  VmToHostMessage,
} from './shared/protocol'

import type { ArrowTemplate } from '@arrow-js/core'
import type { SandboxEvents, SandboxProps } from './shared/protocol'
import { sandbox as renderSandbox } from './host/instance'

export function sandbox<T extends {
  source: object
  shadowDOM?: boolean
  onError?: (error: Error | string) => void
  debug?: boolean
}>(
  props: T,
  events?: SandboxEvents
): ArrowTemplate {
  return renderSandbox(props, events)
}
