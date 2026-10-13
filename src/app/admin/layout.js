import Sidebar from '../components/admin/Sidebar';
import AuthGuard from '../components/admin/AuthGuard';

export const metadata = { title: 'Hololingo Admin' };

export default function AdminLayout({ children }) {
  return (
    <AuthGuard>
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--adm-bg)',
        color: 'var(--adm-text)',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100vh',
          background: 'var(--adm-bg)',
          color: 'var(--adm-text)',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
    </AuthGuard>
  );
}