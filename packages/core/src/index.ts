import { component, pick } from './component'
import { html } from './html'
import { reactive, watch } from './reactive'

export {
  component,
  component as c,
  html,
  html as t,
  pick,
  pick as props,
  reactive,
  reactive as r,
  watch,
  watch as w,
}

export { nextTick } from './common'

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
