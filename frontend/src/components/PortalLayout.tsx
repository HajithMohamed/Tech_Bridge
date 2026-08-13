import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import Footer from './landing/Footer';

const PortalLayout = () => {
  const { pathname } = useLocation();
  const pageOwnsHeader = pathname === '/my-activity'
    || pathname === '/provider'
    || pathname === '/provider/profile'
    || pathname === '/resources/list';

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {!pageOwnsHeader && <AppHeader />}
      <div className="flex-grow">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

export default PortalLayout;
