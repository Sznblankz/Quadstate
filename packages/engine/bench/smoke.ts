/** Print the determinism smoke digest (run on any platform to compare). */
import { SMOKE_DIGEST, runDeterminismSmoke } from "../src/smoke.js";

const first = runDeterminismSmoke();
const second = runDeterminismSmoke();
console.log(`digest:   ${first}`);
console.log(`repeat:   ${second} (${first === second ? "stable" : "UNSTABLE!"})`);
console.log(`expected: ${SMOKE_DIGEST} (${first === SMOKE_DIGEST ? "MATCH" : "MISMATCH"})`);
