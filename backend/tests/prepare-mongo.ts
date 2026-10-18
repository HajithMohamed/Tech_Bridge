import { MongoBinary } from 'mongodb-memory-server-core';
import { mongoBinary } from './support/database';

// Explicit provisioning step; test suites themselves never download binaries.
process.env.MONGOMS_RUNTIME_DOWNLOAD = 'true';
MongoBinary.getPath(mongoBinary)
  .then(() => console.log(`MongoDB ${mongoBinary.version} test binary is ready.`))
  .catch(() => { console.error('Unable to provision MongoDB. Check download access or the documented system-binary override.'); process.exitCode = 1; });
