import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';
import Footer from './landing/Footer';

const PortalLayout = () => {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <AppHeader />
      <div className="flex-grow">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

export default PortalLayout;
