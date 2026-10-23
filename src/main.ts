import { bootstrap } from './game/bootstrap';
import { installCrashGuard } from './ui/crashOverlay';
import { getHost } from './platform/host';
import { APP_VERSION } from './data/version';
import { SAVE_VERSION } from './persistence/schema';
import { versionLine } from './utils/versionLine';
import { editionFor } from './data/edition';

const edition = editionFor(import.meta.env.MODE);
// The boot mark is set by ./boot.js (classic script in index.html), before any module code runs.
const guard = installCrashGuard({ versionLine: versionLine(APP_VERSION, SAVE_VERSION, edition.label), host: getHost(window) });
try {
  bootstrap({
    edition,
    // Literal MODE comparison: Rollup drops the lazy demo-end chunk (code and CSS) from the full build.
    loadDemoEnd: import.meta.env.MODE === 'demo' ? () => import('./ui/demoEnd') : undefined,
  });
} catch (err) {
  guard.report(err, 'boot');
}
