import { useEffect } from "react"
import "./lang.css"

export type Lang = "en" | "vi"

export function LangSwitch({ language, setLanguage, tone = "light" }: { language: Lang; setLanguage: (l: Lang) => void; tone?: "light" | "dark" }) {
  const opts: [Lang, string, string][] = [["en", "EN", "English"], ["vi", "VI", "Tiếng Việt"]]
  return (
    <div className={`lang-switch lang-${tone}`} role="group" aria-label="Language / Ngôn ngữ" data-no-translate>
      {opts.map(([l, short, full]) => (
        <button key={l} type="button" lang={l} title={full} aria-label={full} aria-pressed={language === l} onClick={() => setLanguage(l)}>
          <span>{short}</span>
        </button>
      ))}
    </div>
  )
}

const ATTRS = ["placeholder", "aria-label", "title", "alt"]
const norm = (s: string) => s.replace(/\s+/g, " ").trim()

// Translates rendered text and a few attributes by exact (whitespace-normalised) match.
// Originals are remembered so switching back to English restores them.
export function useDomTranslation(language: Lang, dict: Record<string, string>) {
  useEffect(() => {
    const textRec = new WeakMap<Text, { en: string; vi: string }>()
    const attrRec = new WeakMap<Element, Record<string, { en: string; vi: string }>>()
    const lookup = (raw: string) => {
      const key = norm(raw)
      const hit = dict[key]
      if (!hit) return null
      const lead = raw.match(/^\s*/)?.[0] ?? ""
      const trail = raw.match(/\s*$/)?.[0] ?? ""
      return lead + hit + trail
    }
    const doText = (n: Text) => {
      const rec = textRec.get(n)
      const cur = n.nodeValue ?? ""
      if (rec && cur === rec.vi) { if (language === "en") n.nodeValue = rec.en; return }
      if (language !== "vi") { textRec.delete(n); return }
      const vi = lookup(cur)
      if (vi) { textRec.set(n, { en: cur, vi }); n.nodeValue = vi } else textRec.delete(n)
    }
    const doAttrs = (el: Element) => {
      for (const a of ATTRS) {
        if (!el.hasAttribute(a)) continue
        const cur = el.getAttribute(a) ?? ""
        const recs = attrRec.get(el) ?? {}
        const rec = recs[a]
        if (rec && cur === rec.vi) { if (language === "en") el.setAttribute(a, rec.en); continue }
        if (language !== "vi") { delete recs[a]; continue }
        const vi = lookup(cur)
        if (vi) { recs[a] = { en: cur, vi }; attrRec.set(el, recs); el.setAttribute(a, vi) } else delete recs[a]
      }
    }
    const walk = (root: Node) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
      let n: Node | null = w.currentNode
      while (n) {
        if (n.nodeType === 3) {
          const p = (n as Text).parentElement
          if (p && !["SCRIPT", "STYLE", "TEXTAREA"].includes(p.tagName) && !p.closest("[data-no-translate]")) doText(n as Text)
        } else if (n.nodeType === 1 && !(n as Element).closest("[data-no-translate]")) doAttrs(n as Element)
        n = w.nextNode()
      }
    }
    const obs = new MutationObserver(() => {
      obs.disconnect()
      walk(document.body)
      obs.observe(document.body, config)
    })
    const config: MutationObserverInit = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }
    walk(document.body)
    obs.observe(document.body, config)
    document.documentElement.lang = language
    return () => obs.disconnect()
  }, [language, dict])
}
