/**
 * SettingsPage.tsx — Settings page wrapper
 *
 * Renders the SettingsPanel component with standard page header layout.
 */
import SettingsPanel from '@/components/SettingsPanel'

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gradient tracking-tight">Settings</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Configure model parameters, connected servers, and speech settings.
        </p>
      </div>

      {/* Main Settings Panel */}
      <SettingsPanel />
    </div>
  )
}
