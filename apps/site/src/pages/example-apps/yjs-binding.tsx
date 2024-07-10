import "@iframe-resizer/child"

/* eslint-disable import-x/no-unresolved */
import BrowserOnly from "@docusaurus/BrowserOnly"
/* eslint-enable import-x/no-unresolved */
import { App } from "../../../docs/examples/yjsBinding/app"

const Page = () => (
  <>
    <BrowserOnly>{() => <App />}</BrowserOnly>
  </>
)

export default Page
