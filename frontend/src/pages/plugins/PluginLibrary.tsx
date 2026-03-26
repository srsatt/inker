import { MainLayout } from '../../components/layout';

export function PluginLibrary() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">Plugins</h1>
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 mb-4">Coming Soon</span>
        <p className="text-text-muted text-center max-w-md leading-relaxed">
          Plugins will bring homelab integrations directly to your e-ink display — server monitoring, smart home dashboards, network stats, and more. Built for the self-hosted community.
        </p>
      </div>
    </MainLayout>
  );
}
