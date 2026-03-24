export function setAttr(
  node: Element,
  attrName: string,
  value: string | number | boolean | null
) {
  if (attrName === '.innerhtml') attrName = '.innerHTML'
  const isIDL =
    (attrName === 'value' && 'value' in node) ||
    attrName === 'checked' ||
    (attrName[0] === '.' && (attrName = attrName.slice(1)))
  if (isIDL) {
    // @ts-ignore:next-line
    node[attrName as 'value'] = value
    if (node.getAttribute(attrName) != value) value = false
  }
  value !== false
    ? node.setAttribute(attrName, value as string)
    : node.removeAttribute(attrName)
}
