import { createInterface } from 'readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(q) {
  return new Promise(resolve => rl.question(q, resolve))
}

const url = await ask('接口地址: ')
const token = await ask('API Token(没有则留空): ')
const text = await ask('待翻译内容: ')
const source_lang = await ask('源语言(留空自动检测): ') || 'auto'
const target_lang = await ask('目标语言(默认chinese): ') || 'chinese'

rl.close()

const headers = { 'Content-Type': 'application/json' }
if (token) headers['Authorization'] = `Bearer ${token}`

const res = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify({ source_lang, target_lang, text_list: [text] }),
})

const data = await res.json()
console.log(JSON.stringify(data, null, 2))
