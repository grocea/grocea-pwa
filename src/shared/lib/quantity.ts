import type { MeasurementFamily, Unit } from '../../domain/types'

const unitFactors: Record<Unit, bigint> = { mg: 1n, g: 1_000n, kg: 1_000_000n, ml: 1_000n, L: 1_000_000n, item: 1_000n }
export const familyUnits: Record<MeasurementFamily, Unit[]> = { mass: ['mg', 'g', 'kg'], volume: ['ml', 'L'], count: ['item'] }

export function parseQuantity(value: string, unit: Unit): bigint | null {
  const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d{1,6}))?$/)
  if (!match) return null
  const [, sign, whole, fraction = ''] = match
  const denominator = 10n ** BigInt(fraction.length)
  const numerator = BigInt(`${whole}${fraction}`) * unitFactors[unit]
  const absolute = (numerator + denominator / 2n) / denominator
  return sign === '-' ? -absolute : absolute
}

const trimDecimal = (value: string) => value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
function formatWithFactor(quantity: bigint, factor: bigint, unit: Unit) {
  const negative = quantity < 0n
  const absolute = negative ? -quantity : quantity
  const whole = absolute / factor
  const remainder = absolute % factor
  const fraction = ((remainder * 1_000n + factor / 2n) / factor).toString().padStart(3, '0')
  const number = trimDecimal(`${negative ? '-' : ''}${whole}.${fraction}`)
  return `${number} ${unit === 'item' && number !== '1' ? 'items' : unit}`
}

export function formatQuantity(quantity: bigint, family: MeasurementFamily) {
  const absolute = quantity < 0n ? -quantity : quantity
  if (family === 'mass') return absolute >= unitFactors.kg ? formatWithFactor(quantity, unitFactors.kg, 'kg') : absolute >= unitFactors.g ? formatWithFactor(quantity, unitFactors.g, 'g') : formatWithFactor(quantity, 1n, 'mg')
  if (family === 'volume') return absolute >= unitFactors.L ? formatWithFactor(quantity, unitFactors.L, 'L') : formatWithFactor(quantity, unitFactors.ml, 'ml')
  return formatWithFactor(quantity, unitFactors.item, 'item')
}

export function formatQuantityInUnit(quantity: bigint, unit: Unit) {
  return formatWithFactor(quantity, unitFactors[unit], unit)
}

export const defaultUnit = (family: MeasurementFamily): Unit => family === 'mass' ? 'kg' : family === 'volume' ? 'L' : 'item'
export const scaleQuantity = (quantity: bigint, servings: number, baseServings: number) => quantity * BigInt(servings) / BigInt(baseServings)
