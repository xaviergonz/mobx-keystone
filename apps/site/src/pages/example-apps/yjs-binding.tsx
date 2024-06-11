/* eslint-disable import-x/no-unresolved */
import BrowserOnly from "@docusaurus/BrowserOnly"
import Head from "@docusaurus/Head"
/* eslint-enable import-x/no-unresolved */
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
