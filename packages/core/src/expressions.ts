import { ArrowExpression } from './html'

export const expressionPool: Array<number | ArrowExpression> = []
const expressionObservers: CallableFunction[] = []
const freeExpressionPointers: number[][] = []
let cursor = 0

export function createExpressionBlock(len: number): number {
  const bucket = freeExpressionPointers[len]
  const pointer = bucket?.length ? bucket.pop()! : cursor
  expressionPool[pointer] = len
  if (pointer === cursor) cursor += len + 1
  return pointer
}

export function storeExpressions(expSlots: ArrowExpression[]): number {
  const len = expSlots.length
  const pointer = createExpressionBlock(len)
  writeExpressions(expSlots, pointer)
  return pointer
}

export function writeExpressions(
  expSlots: ArrowExpression[],
  pointer: number
): void {
  const len = expressionPool[pointer] as number
  for (let i = 1; i <= len; i++) {
    const nextValue = expSlots[i - 1]
    const target = pointer + i
    if (Object.is(expressionPool[target], nextValue)) continue
    expressionPool[target] = nextValue
    expressionObservers[target]?.(nextValue)
  }
}

export function updateExpressions(
  sourcePointer: number,
  toPointer: number
): void {
  if (sourcePointer === toPointer) return
  const len = expressionPool[sourcePointer] as number
  for (let i = 1; i <= len; i++) {
    const target = toPointer + i
    const nextValue = expressionPool[sourcePointer + i]
    if (Object.is(expressionPool[target], nextValue)) continue
    expressionPool[target] = nextValue
    expressionObservers[target]?.(nextValue)
  }
}

export function onExpressionUpdate(
  pointer: number,
  observer?: CallableFunction
): void {
  if (observer) {
    expressionObservers[pointer] = observer
    return
  }
  delete expressionObservers[pointer]
}

export function releaseExpressions(pointer: number): void {
  const len = expressionPool[pointer] as number | undefined
  if (len === undefined) return
  for (let i = 0; i <= len; i++) {
    delete expressionPool[pointer + i]
    delete expressionObservers[pointer + i]
  }
  ;(freeExpressionPointers[len] ??= []).push(pointer)
}
