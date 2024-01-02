import BrowserOnly from "@docusaurus/BrowserOnly"
import Head from "@docusaurus/Head"
import { App } from "../../../docs/examples/yjsBinding/app"

const Page = () => (
  <>
    <Head>
      <script src="/script/iframeResizer.contentWindow.min.js"></script>
    </Head>
    <BrowserOnly>{() => <App />}</BrowserOnly>
  </>
)

export default Page
