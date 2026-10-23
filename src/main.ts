// ESM imports are evaluated before this body, so this mark runs after the import graph; the bootMs gate measures nav to first frame.
performance.mark('wedtmd:boot');
import { bootstrap } from './game/bootstrap';

bootstrap();
