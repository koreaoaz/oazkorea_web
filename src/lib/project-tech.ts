export const TECH_GROUPS = ['Python', 'AI / ML', 'Web', 'Hardware / Robotics', 'Game Development'] as const
export type TechGroup = typeof TECH_GROUPS[number]
const evidence = [/python|파이썬|pytorch|scikit-learn|numpy|pandas/i, /\b(?:ai|ml|gan|cnn|resnet|ppo|llm|sllm|pytorch|nnU-Net|scikit-learn)\b|머신러닝|딥러닝/i, /javascript|node\.js|puppeteer|웹|온라인몰/i, /arduino|platformio|sram|로봇|반도체/i, /방탈출 게임|시뮬레이션 게임|유니티|\bunity\b/i]
export function stackObject(raw: unknown): Record<string,unknown> {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return {stack: raw ? [raw] : []} }
  }
  if (Array.isArray(raw)) return {stack:raw}
  return raw && typeof raw === 'object' ? {...raw as Record<string,unknown>} : {}
}
/** Extract only authored technology names. Never stringify arbitrary JSON fields. */
export function technologyNames(raw: unknown): string[] {
  const names = new Map<string,string>()
  function visit(value: unknown, depth: number) {
    if (depth > 5 || value == null) return
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return }
    if (typeof value === 'object') {
      if (Object.hasOwn(value,'stack')) visit((value as {stack:unknown}).stack, depth + 1)
      return
    }
    if (typeof value !== 'string') return
    const text = value.trim()
    if (/^[\[{"]/.test(text)) {
      try { visit(JSON.parse(text), depth + 1) } catch { /* Malformed serialized value. */ }
      return
    }
    for (const part of text.split(/[,;|·\n]|\s+\/\s+/)) {
      const name=part.trim()
      if (!name || name.length>100 || /[<>{}\[\]"\x00-\x1f]/.test(name)) continue
      const key=name.normalize('NFC').toLowerCase()
      if(!names.has(key)) names.set(key,name)
    }
  }
  visit(raw,0)
  return [...names.values()]
}

export function techGroups(raw: unknown, descriptions: unknown[] = []): TechGroup[] {
  const data = stackObject(raw)
  if (Array.isArray(data.groups)) return TECH_GROUPS.filter(group => (data.groups as unknown[]).includes(group))
  const source = [...(Array.isArray(data.stack) ? data.stack : []), ...descriptions].filter(s=>typeof s==='string').join(' ')
  return TECH_GROUPS.filter((_,i)=>evidence[i].test(source))
}

