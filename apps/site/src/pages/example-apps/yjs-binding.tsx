import BrowserOnly from "@docusaurus/BrowserOnly"
import { App } from "@site/docs/examples/yjsBinding/app"

const Page = () => <BrowserOnly>{() => <App />}</BrowserOnly>

export default Page
