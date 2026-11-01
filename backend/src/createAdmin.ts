import dotenv from 'dotenv';
import { AdminBootstrapError, createDevelopmentAdmin } from './services/adminBootstrap';
import { databaseErrorMessage } from './utils/databaseError';

// Normal app connection first; the separate ignored file supplies bootstrap settings.
dotenv.config();
const settings = dotenv.config({ path: '.env.admin' }).parsed;
// Never allow the admin file to silently redirect the normal app database.
if (settings?.MONGODB_URI) {
  console.error('Do not put MONGODB_URI in .env.admin. Use the normal app configuration in .env.');
  process.exitCode = 1;
} else {
  void createDevelopmentAdmin(process.env)
    .then(({ created }) => console.log(created
      ? 'Administrator created with an audit entry. Use the credentials in your private .env.admin file, then remove ADMIN_CREATE_PASSWORD and disable ADMIN_CREATE_ENABLED.'
      : 'Administrator already exists. Its password, name, role and account status were left unchanged.'))
    .catch((error: unknown) => {
      console.error(error instanceof AdminBootstrapError ? error.message : databaseErrorMessage(error));
      process.exitCode = 1;
    });
}
