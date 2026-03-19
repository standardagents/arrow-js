export interface SandboxProps {
  source: Record<string, string>
  shadowDOM?: boolean
  onError?: (error: Error | string) => void
  debug?: boolean
}

export interface SandboxEvents {
  output?: (payload: unknown) => void
}

export type SandboxConsoleMethod =
  | 'assert'
  | 'clear'
  | 'count'
  | 'countReset'
  | 'debug'
  | 'dir'
  | 'dirxml'
  | 'error'
  | 'group'
  | 'groupCollapsed'
  | 'groupEnd'
  | 'info'
  | 'log'
  | 'table'
  | 'time'
  | 'timeEnd'
  | 'timeLog'
  | 'trace'
  | 'warn'

export interface SandboxedEventTargetSnapshot {
  tagName?: string
  id?: string
  value?: string
  checked?: boolean
}

export interface SandboxedEventPayload {
  type: string
  currentTargetId: string
  targetId?: string
  currentTarget?: SandboxedEventTargetSnapshot
  target?: SandboxedEventTargetSnapshot
  srcElement?: SandboxedEventTargetSnapshot
  value?: string
  checked?: boolean
  key?: string
  clientX?: number
  clientY?: number
  button?: number
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

export type TemplateValuePart =
  | {
      kind: 'static'
      value: string
    }
  | {
      kind: 'expr'
      exprIndex: number
    }

export interface AttributeBindingDescriptor {
  name: string
  parts: TemplateValuePart[]
}

export interface EventBindingDescriptor {
  eventType: string
  exprIndex: number
}

export interface RefBindingDescriptor {
  exprIndex: number
}

export interface ElementDescriptor {
  kind: 'element'
  tag: string
  staticAttributes: Record<string, string>
  dynamicAttributes: AttributeBindingDescriptor[]
  eventBindings: EventBindingDescriptor[]
  refBinding?: RefBindingDescriptor
  children: TemplateNodeDescriptor[]
}

export interface TextDescriptor {
  kind: 'text'
  value: string
}

export interface TextBindingDescriptor {
  kind: 'text-binding'
  parts: TemplateValuePart[]
}

export interface RegionDescriptor {
  kind: 'region'
  exprIndex: number
}

export interface FragmentDescriptor {
  kind: 'fragment'
  children: TemplateNodeDescriptor[]
}

export type TemplateNodeDescriptor =
  | FragmentDescriptor
  | ElementDescriptor
  | TextDescriptor
  | TextBindingDescriptor
  | RegionDescriptor

export interface TemplateDescriptor {
  id: string
  root: TemplateNodeDescriptor
}

export interface SerializedElementNode {
  kind: 'element'
  id: string
  tag: string
  attrs: Record<string, string | boolean>
  events: Record<string, string>
  children: SerializedNode[]
}

export interface SerializedTextNode {
  kind: 'text'
  id: string
  text: string
}

export interface SerializedRegionNode {
  kind: 'region'
  id: string
  children: SerializedNode[]
}

export interface SerializedFragmentNode {
  kind: 'fragment'
  children: SerializedNode[]
}

export type SerializedNode =
  | SerializedFragmentNode
  | SerializedElementNode
  | SerializedTextNode
  | SerializedRegionNode

export type VmPatch =
  | {
      type: 'set-text'
      nodeId: string
      text: string
    }
  | {
      type: 'set-attribute'
      nodeId: string
      name: string
      value: string | boolean
    }
  | {
      type: 'remove-attribute'
      nodeId: string
      name: string
    }
  | {
      type: 'set-event-binding'
      nodeId: string
      eventType: string
      handlerId: string
    }
  | {
      type: 'clear-event-binding'
      nodeId: string
      eventType: string
    }
  | {
      type: 'replace-region'
      regionId: string
      children: SerializedNode[]
    }

export interface VmInitPayload {
  entryPath: string
  descriptors: Record<string, TemplateDescriptor>
  debug?: boolean
}

export type HostToVmMessage =
  | {
      type: 'init'
      payload: VmInitPayload
    }
  | {
      type: 'event'
      payload: {
        handlerId: string
        event: SandboxedEventPayload
      }
    }
  | {
      type: 'destroy'
    }

export type VmToHostMessage =
  | {
      type: 'ready'
    }
  | {
      type: 'render'
      tree: SerializedNode
    }
  | {
      type: 'patch'
      patches: VmPatch[]
    }
  | {
      type: 'error'
      error: string
    }
  | {
      type: 'log'
      method: SandboxConsoleMethod
      args: unknown[]
    }
  | {
      type: 'output'
      payload: unknown
    }
