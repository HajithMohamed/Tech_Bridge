import { DemoSeedConfigError, seedDemoAdmin } from './services/demoSeed';

// No implicit .env loading: use explicit shell variables or the dedicated seed:demo command.
void seedDemoAdmin(process.env)
  .then(({ created }) => console.log(created
    ? 'Synthetic demo administrator created. Use the password from your local demo configuration.'
    : 'Demo administrator already exists; its password, role and status were left unchanged.'))
  .catch((error: unknown) => {
    console.error(error instanceof DemoSeedConfigError ? error.message : 'Demo seeding failed. Check the isolated demo configuration; existing accounts were not overwritten.');
    process.exitCode = 1;
  });
