import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, '../grocea-backend/openapi/openapi.json')
const target = resolve(root, 'src/api/generated.ts')
const document = JSON.parse(await readFile(source, 'utf8'))

function schemaType(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown'
  if (schema.$ref) return `schemas[${JSON.stringify(schema.$ref.split('/').at(-1))}]`
  if (schema.const !== undefined) return JSON.stringify(schema.const)
  if (schema.enum) return schema.enum.map(value => JSON.stringify(value)).join(' | ')
  if (schema.anyOf) return schema.anyOf.map(schemaType).join(' | ')
  if (schema.allOf) return schema.allOf.map(schemaType).join(' & ')
  if (schema.type === 'array') return `Array<${schemaType(schema.items)}>`
  if (schema.type === 'object' || schema.properties) {
    const required = new Set(schema.required ?? [])
    const properties = Object.entries(schema.properties ?? {}).map(([name, value]) => {
      const optional = required.has(name) ? '' : '?'
      return `${JSON.stringify(name)}${optional}: ${schemaType(value)}`
    })
    if (schema.additionalProperties) properties.push(`[key: string]: ${schemaType(schema.additionalProperties)}`)
    return properties.length ? `{ ${properties.join('; ')} }` : 'Record<string, unknown>'
  }
  if (schema.type === 'integer' || schema.type === 'number') return 'number'
  if (schema.type === 'boolean') return 'boolean'
  if (schema.type === 'null') return 'null'
  if (schema.type === 'string') return 'string'
  return 'unknown'
}

const entries = Object.entries(document.components?.schemas ?? {})
  .map(([name, schema]) => `  ${JSON.stringify(name)}: ${schemaType(schema)}`)
  .join('\n')
const output = `// Generated from grocea-backend/openapi/openapi.json. Do not edit by hand.
export interface components {
  schemas: schemas
}

export interface schemas {
${entries}
}
`
await writeFile(target, output)
