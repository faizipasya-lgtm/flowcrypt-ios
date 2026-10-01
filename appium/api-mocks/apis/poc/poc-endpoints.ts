/* PoC recorder for the FlowCrypt iOS attachment-link test:
 * the "attacker host" endpoint. The mock Api base class logs every request
 * line (ms | status METHOD url) to stdout, which is the server-side evidence
 * that the app fetched the attacker-controlled URL automatically. */
import { HandlersDefinition } from '../../lib/api';

export const getPocRecorderEndpoints = (): HandlersDefinition => ({
  '/poc-fetch/probe.bin': async () => 'A'.repeat(128),
});
