import { requestPasswordReset } from '../api/authApi';
import AuthFlowShell from '../components/auth/AuthFlowShell';
import EmailRequestForm from '../components/auth/EmailRequestForm';

export default function ForgotPasswordPage() {
  return <AuthFlowShell title="Reset your password" description="Enter the email address you use for TechBridge. If the account is eligible, we will send a link to choose a new password."><EmailRequestForm submit={requestPasswordReset} label="Send reset link" /></AuthFlowShell>;
}
