export function setAttr(
  node: Element,
  attrName: string,
  value: string | number | boolean | null
) {
  const isIDL =
    (attrName === 'value' && 'value' in node) ||
    attrName === 'checked' ||
    (attrName.startsWith('.') && (attrName = attrName.substring(1)))
  if (isIDL) {
    // @ts-ignore:next-line
    node[attrName as 'value'] = value
    if (node.getAttribute(attrName) != value) value = false
  }
  value !== false
    ? node.setAttribute(attrName, value as string)
    : node.removeAttribute(attrName)
}
