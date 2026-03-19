import { reactive } from '@arrow-js/core'
import { sandbox } from './index'

const plain = sandbox({
  source: {
    'main.ts': `export default html\`<div>plain</div>\``,
  },
})

const reactiveConfig = reactive({
  debug: true,
  shadowDOM: false,
  source: {
    'main.ts': `export default html\`<div>reactive</div>\``,
  },
})

const reactiveResult = sandbox(reactiveConfig)

void plain
void reactiveResult
