import { component, pick } from './component'
import { html, svg } from './html'
import { reactive, watch } from './reactive'
import { nextTick, onCleanup } from './common'

export {
  component,
  component as c,
  html,
  svg,
  html as t,
  pick,
  pick as props,
  reactive,
  reactive as r,
  watch,
  watch as w,
  onCleanup,
}

export { nextTick }

export type {
  ArrowExpression,
  ArrowRenderable,
  ArrowTemplate,
  ArrowTemplateKey,
  ParentNode,
} from './html'

export type {
  AsyncComponentOptions,
  Component,
  ComponentCall,
  ComponentWithProps,
  Emit,
  EventMap,
  Events,
  Props,
} from './component'

export type {
  Computed,
  PropertyObserver,
  Reactive,
  ReactiveTarget,
} from './reactive'
