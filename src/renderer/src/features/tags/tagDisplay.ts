export function formatTagName(name: string): string {
  const normalizedName = name.trim().toLocaleLowerCase()
  if (!normalizedName) return ''

  return `${normalizedName.charAt(0).toLocaleUpperCase()}${normalizedName.slice(1)}`
}
