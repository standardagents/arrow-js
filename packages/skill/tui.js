import process from 'node:process'

/**
 * Interactive multi-select list for terminal.
 * Returns an array of selected item IDs, or an empty array on skip/cancel.
 */
export async function multiSelect({ items, preselected = [] }) {
  if (!process.stdin.isTTY) {
    return preselected.length > 0 ? [...preselected] : []
  }

  return new Promise((resolve) => {
    const { stdout, stdin } = process
    let cursor = 0
    const selected = new Set(preselected)
    let lineCount = 0

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    stdout.write('\x1b[?25l')

    const maxName = Math.max(...items.map((i) => i.name.length))

    function buildRows() {
      const rows = ['']
      rows.push('  \x1b[1;33mArrow Skill Installer\x1b[0m')
      rows.push('')
      rows.push('  Select agents to install for:')
      rows.push('')

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const active = i === cursor
        const checked = selected.has(item.id)
        const ptr = active ? '\x1b[36m❯\x1b[0m' : ' '
        const dot = checked ? '\x1b[32m●\x1b[0m' : '\x1b[2m○\x1b[0m'
        const name = active ? `\x1b[1m${item.name}\x1b[0m` : item.name
        const pad = ' '.repeat(maxName - item.name.length + 3)
        const desc = `\x1b[2m${item.description}\x1b[0m`
        rows.push(`  ${ptr} ${dot} ${name}${pad}${desc}`)
      }

      rows.push('')
      rows.push(
        '  \x1b[2m↑↓ navigate  space toggle  a all  enter confirm  esc skip\x1b[0m'
      )
      rows.push('')
      return rows
    }

    function render() {
      if (lineCount > 1) {
        stdout.write(`\x1b[${lineCount - 1}A`)
      }
      stdout.write('\r')

      const rows = buildRows()
      for (let i = 0; i < rows.length; i++) {
        stdout.write(`\x1b[2K${rows[i]}`)
        if (i < rows.length - 1) stdout.write('\n')
      }
      lineCount = rows.length
    }

    function finish(result) {
      if (lineCount > 1) {
        stdout.write(`\x1b[${lineCount - 1}A`)
      }
      stdout.write('\r\x1b[J\x1b[?25h')
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onKey)
      resolve(result)
    }

    function onKey(data) {
      const s = data.toString()

      if (s === '\x1b[A' || s === 'k') {
        cursor = cursor > 0 ? cursor - 1 : items.length - 1
      } else if (s === '\x1b[B' || s === 'j') {
        cursor = cursor < items.length - 1 ? cursor + 1 : 0
      } else if (s === ' ') {
        const id = items[cursor].id
        if (selected.has(id)) selected.delete(id)
        else selected.add(id)
      } else if (s === 'a') {
        if (selected.size === items.length) selected.clear()
        else items.forEach((i) => selected.add(i.id))
      } else if (s === '\r' || s === '\n') {
        finish([...selected])
        return
      } else if (s === '\x1b') {
        finish([])
        return
      } else if (s === '\x03') {
        finish([])
        process.exit(130)
        return
      } else {
        return
      }

      render()
    }

    stdin.on('data', onKey)
    render()
  })
}
