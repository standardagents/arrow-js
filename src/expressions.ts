import { setAttr } from './dom'
import { ArrowExpression } from './html'

export const expressionPool: Array<number | ArrowExpression> = []
const expressionObservers: CallableFunction[] = []
const textBindings: Array<Text | Comment> = []
const attrBindings: Element[] = []
const attrBindingNames: string[] = []
const freeExpressionPointers: number[][] = []
let cursor = 0

/**
 * Creates an updatable expression.
 * @param literalExpression - An arrow function that returns a renderable.
 * @returns
 */
export function storeExpressions(expSlots: ArrowExpression[]): number {
  const len = expSlots.length
  const bucket = freeExpressionPointers[len]
  const pointer = bucket?.length ? bucket.pop()! : cursor
  expressionPool[pointer] = len
  for (let i = 0; i < len; i++) {
    expressionPool[pointer + i + 1] = expSlots[i]
  }
  if (pointer === cursor) {
    cursor += len + 1
  }
  return pointer
}

/**
 * Updates a given expression to a different one.
 * @param source - The id of the expression to update.
 * @param to - The id of the expression to update to.
 */
export function updateExpressions(
  sourcePointer: number,
  toPointer: number
): void {
  if (sourcePointer === toPointer) return
  const len = expressionPool[sourcePointer] as number
  for (let i = 1; i <= len; i++) {
    writeExpression(toPointer + i, expressionPool[sourcePointer + i] as ArrowExpression)
  }
}

export function replaceExpressions(
  pointer: number,
  expSlots: ArrowExpression[]
): void {
  const len = expressionPool[pointer] as number
  for (let i = 0; i < len; i++) {
    writeExpression(pointer + i + 1, expSlots[i])
  }
}

/**
 * Register an observer to call when a given expression is updated.
 * @param pointer - The pointer of the expression to update.
 * @param observer - The observer to call when the expression is updated.
 */
export function onExpressionUpdate(
  pointer: number,
  observer: CallableFunction
): void {
  expressionObservers[pointer] = observer
}

export function bindExpressionText(pointer: number, node: Text | Comment): void {
  textBindings[pointer] = node
}

export function bindExpressionAttr(
  pointer: number,
  node: Element,
  attrName: string
): void {
  attrBindings[pointer] = node
  attrBindingNames[pointer] = attrName
}

function writeExpression(pointer: number, value: ArrowExpression): void {
  expressionPool[pointer] = value
  const observer = expressionObservers[pointer]
  if (observer) {
    observer(value)
    return
  }
  const text = textBindings[pointer]
  if (text) {
    if (text.nodeValue != value) text.nodeValue = value as string
    return
  }
  const attr = attrBindings[pointer]
  if (attr) {
    setAttr(
      attr,
      attrBindingNames[pointer],
      value as string | number | boolean | null
    )
  }
}

/**
 * Releases a pointer back into the expression free list for exact-size reuse.
 * This is only safe for template instances that never bound DOM observers.
 * @param pointer - The expression pointer to release.
 */
export function releaseExpressions(pointer: number): void {
  const len = expressionPool[pointer] as number | undefined
  if (len === undefined) return
  for (let i = 0; i <= len; i++) {
    delete expressionPool[pointer + i]
    delete expressionObservers[pointer + i]
    delete textBindings[pointer + i]
    delete attrBindings[pointer + i]
    delete attrBindingNames[pointer + i]
  }
  ;(freeExpressionPointers[len] ??= []).push(pointer)
}
