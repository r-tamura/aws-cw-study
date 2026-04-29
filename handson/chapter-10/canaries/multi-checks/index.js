// Multi-checks canary entrypoint.
//
// When the canary is created with the multi-checks blueprint, the runtime
// (`syn-nodejs-3.0` and later) uses `blueprint-config.json` as the source of
// truth and the runtime-provided `multiCheckCanary` function executes the
// declared HTTP / DNS / SSL / TCP checks.
//
// We still expose a minimal handler so that `Code.fromAsset` packages a
// usable bundle and so that the canary can be invoked even if the blueprint
// runtime is not active (e.g. when validating the asset locally).

const fs = require('fs');
const path = require('path');

let synthetics;
let log;
try {
  // Provided by the Synthetics Lambda runtime layer.
  synthetics = require('Synthetics');
  log = require('SyntheticsLogger');
} catch (_e) {
  // Local validation - runtime modules are absent. No-op shims keep this file loadable.
  synthetics = { executeStep: async (_n, fn) => fn() };
  log = { info: console.log, error: console.error };
}

const CONFIG_PATH = path.join(__dirname, 'blueprint-config.json');

const runMultiChecks = async function () {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  log.info(`Loaded ${config.checks.length} multi-checks definitions`);

  // If the runtime provides the multi-checks helper, delegate to it.
  if (synthetics && typeof synthetics.multiCheckCanary === 'function') {
    return synthetics.multiCheckCanary(config);
  }

  // Otherwise just log the configuration for visibility - the blueprint
  // runtime is what actually executes the checks in production.
  for (const check of config.checks) {
    await synthetics.executeStep(`describe-${check.name}`, async () => {
      log.info(`check name=${check.name} type=${check.type}`);
    });
  }
};

exports.handler = async () => {
  return await runMultiChecks();
};
