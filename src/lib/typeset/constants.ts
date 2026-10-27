export interface Constants {
  PLAN_SIZE: number
  ROOT_RATIO: number
  CAP_LINES: number
  INDENT: number
  CAP_CLEARANCE: number
  CAP_SCALE: number
  STRETCH: number
  TRACKING: number
  SHRINK: number
}

const ROOT_FONT_SIZE = 16

export function typesetConstants(prose: { fontSize: string; indent: string }) {
  const ratio = parseFloat(prose.fontSize)
  const planSize = ratio * ROOT_FONT_SIZE
  const indent = parseFloat(prose.indent)
  const constants: Constants = {
    PLAN_SIZE: planSize,
    ROOT_RATIO: ratio,
    CAP_LINES: 3,
    INDENT: indent,
    CAP_CLEARANCE: 1.5 / planSize,
    CAP_SCALE: 10,
    STRETCH: 0.5,
    TRACKING: 0.3 / planSize,
    SHRINK: 1 / 3,
  }
  const source = [
    `export const PLAN_SIZE = ${planSize}`,
    `export const ROOT_RATIO = ${ratio}`,
    'export const CAP_LINES = 3',
    `export const INDENT = ${indent}`,
    'export const CAP_CLEARANCE = 1.5 / PLAN_SIZE',
    'export const CAP_SCALE = 10',
    'export const STRETCH = 0.5',
    'export const TRACKING = 0.3 / PLAN_SIZE',
    'export const SHRINK = 1 / 3',
  ].join('\n')
  return { constants, source }
}
