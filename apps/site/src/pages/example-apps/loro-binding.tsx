import BrowserOnly from "@docusaurus/BrowserOnly"
import { App } from "../../../docs/examples/loroBinding/app"

const Page = () => (
  <>
    <BrowserOnly>{() => <App />}</BrowserOnly>
  </>
)

export default Page
