import { bootstrap } from './game/bootstrap';
import { installCrashGuard } from './ui/crashOverlay';
import { getHost } from './platform/host';
import { APP_VERSION } from './data/version';
import { SAVE_VERSION } from './persistence/schema';
import { versionLine } from './utils/versionLine';

// The boot mark is set by ./boot.js (classic script in index.html), before any module code runs.
const guard = installCrashGuard({ versionLine: versionLine(APP_VERSION, SAVE_VERSION), host: getHost(window) });
try {
  bootstrap();
} catch (err) {
  guard.report(err, 'boot');
}
