import shared from "./shared.module.css"

// Syntax-colored spans for hand-written code samples.
export const k = (s: string) => <span className={shared.tokKeyword}>{s}</span>
export const str = (s: string) => <span className={shared.tokString}>{s}</span>
export const deco = (s: string) => <span className={shared.tokDecorator}>{s}</span>
export const type = (s: string) => <span className={shared.tokType}>{s}</span>
export const comment = (s: string) => <span className={shared.tokComment}>{s}</span>
