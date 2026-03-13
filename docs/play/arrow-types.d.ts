declare module '@arrow-js/core' {
  export type ReactiveTarget = Record<PropertyKey, unknown> | unknown[]

  export interface ArrowTemplate {
    (parent: ParentNode): ParentNode
    (): DocumentFragment
    isT: boolean
    key: (key: string | number | undefined) => ArrowTemplate
  }

  export type Reactive<T extends ReactiveTarget> = {
    [P in keyof T]: T[P] extends ReactiveTarget ? Reactive<T[P]> | T[P] : T[P]
  } & {
    $on: <P extends keyof T>(
      property: P,
      callback: (value?: T[P], oldValue?: T[P]) => void
    ) => void
    $off: <P extends keyof T>(
      property: P,
      callback: (value?: T[P], oldValue?: T[P]) => void
    ) => void
  }

  export type Props<T extends ReactiveTarget> = {
    [P in keyof T]: T[P] extends ReactiveTarget ? Props<T[P]> | T[P] : T[P]
  }

  export interface ComponentCall {
    key: (key: string | number | undefined) => ComponentCall
  }

  export interface Component {
    (): ComponentCall
  }

  export interface ComponentWithProps<T extends ReactiveTarget> {
    <S extends Props<T>>(props: S): ComponentCall
  }

  export function html(
    strings: TemplateStringsArray | string[],
    ...expressions: unknown[]
  ): ArrowTemplate
  export { html as t }

  export function reactive<T extends ReactiveTarget>(data: T): Reactive<T>
  export { reactive as r }

  export function watch<F extends (...args: unknown[]) => unknown>(
    effect: F
  ): [returnValue: ReturnType<F>, stop: () => void]
  export function watch<
    F extends (...args: unknown[]) => unknown,
    A extends (arg: ReturnType<F>) => unknown,
  >(effect: F, afterEffect: A): [returnValue: ReturnType<A>, stop: () => void]
  export { watch as w }

  export function nextTick(fn?: CallableFunction): Promise<unknown>

  export function component(factory: () => ArrowTemplate): Component
  export function component<T extends ReactiveTarget>(
    factory: (props: Props<T>) => ArrowTemplate
  ): ComponentWithProps<T>
  export { component as c }

  export function pick<T extends object, K extends keyof T>(
    source: T,
    ...keys: K[]
  ): Pick<T, K>
  export function pick<T extends object>(source: T): T
  export const props: typeof pick
}
