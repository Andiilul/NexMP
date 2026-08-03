export const nexPalette = {
  black: '#020504',
  ink: '#06110f',
  panel: '#0b1715',
  deep: '#00231d',
  teal: '#176b61',
  emerald: '#00b875',
  green: '#00d982',
  white: '#f4fff8',
  muted: '#a9c8bf'
} as const

export type NexPaletteToken = keyof typeof nexPalette
