import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout';
import { Button, LoadingSpinner } from '../../components/common';
import { useApi, useMutation } from '../../hooks/useApi';
import { useNotification } from '../../contexts/NotificationContext';

import { config } from '../../config';
import apiClient from '../../services/api';

interface Plugin {
  id: number;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  source: string;
  isBuiltin: boolean;
  oauthProvider?: string;
  settingsSchema?: SettingsField[];
  _count?: { instances: number };
}

interface SettingsField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'toggle' | 'number' | 'multi_select' | 'date' | 'password';
  description?: string;
  required?: boolean;
  encrypted?: boolean;
  default?: any;
  options?: { label: string; value: string }[];
}

interface PluginInstance {
  id: number;
  pluginId: number;
  name?: string;
  settings: Record<string, any>;
  plugin: Plugin;
  oauthToken?: string;
  lastFetchedAt?: string;
  lastError?: string;
}

export function PluginInstanceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notification = useNotification();
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fetchInstance = useCallback(
    () => apiClient.get<{ data: PluginInstance }>(`/plugins/instances/${id}`).then((res) => res.data.data),
    [id]
  );

  const { data: instance, isLoading } = useApi<PluginInstance>(fetchInstance);

  const saveMutation = useMutation<PluginInstance, Record<string, any>>(
    (settings) => apiClient.put<{ data: PluginInstance }>(`/plugins/instances/${id}`, { settings }).then((res) => res.data.data),
    {
      successMessage: 'Settings saved',
      onSuccess: () => {
        setPreviewTimestamp(Date.now());
      },
    }
  );

  // Initialize form values from instance settings
  useEffect(() => {
    if (instance) {
      const schema = instance.plugin.settingsSchema || [];
      const defaults: Record<string, any> = {};
      for (const field of schema) {
        defaults[field.key] = instance.settings[field.key] ?? field.default ?? '';
      }
      setFormValues(defaults);
    }
  }, [instance]);

  // Mark as initialized after first form population (skip auto-save on load)
  useEffect(() => {
    if (instance && Object.keys(formValues).length > 0 && !initialized) {
      // Delay to ensure we don't trigger on the initial population
      const timer = setTimeout(() => setInitialized(true), 100);
      return () => clearTimeout(timer);
    }
  }, [formValues, instance, initialized]);

  // Debounced auto-save + preview refresh on any settings change
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(() => {
      apiClient.put(`/plugins/instances/${id}`, { settings: formValues })
        .then(() => setPreviewTimestamp(Date.now()))
        .catch(() => notification.error('Failed to save settings'));
    }, 800);
    return () => clearTimeout(timer);
  }, [formValues, initialized, id]);

  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleMultiSelectToggle = (key: string, optionValue: string) => {
    setFormValues((prev) => {
      const current: string[] = Array.isArray(prev[key]) ? prev[key] : [];
      const next = current.includes(optionValue)
        ? current.filter((v: string) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [key]: next };
    });
  };

  const handleSave = () => {
    saveMutation.mutate(formValues);
  };

  const handleOAuthConnect = async () => {
    setOauthConnecting(true);
    try {
      const res = await apiClient.get<{ data: { url: string } }>(`/plugins/instances/${id}/oauth/authorize`);
      window.open(res.data.data.url, 'oauth', 'width=600,height=700');
    } catch {
      notification.error('Failed to start OAuth flow');
    } finally {
      setOauthConnecting(false);
    }
  };

  const handleOAuthDisconnect = async () => {
    try {
      await apiClient.post(`/plugins/instances/${id}/oauth/disconnect`);
      notification.success('OAuth disconnected');
    } catch {
      notification.error('Failed to disconnect');
    }
  };

  // Show notification if we just completed OAuth
  useEffect(() => {
    if (searchParams.get('oauth') === 'connected') {
      notification.success('OAuth connected successfully');
    }
  }, []);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!instance) {
    return (
      <MainLayout>
        <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light py-16 px-8 text-center">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Plugin instance not found</h3>
          <Button onClick={() => navigate('/plugins')}>Back to Plugin Library</Button>
        </div>
      </MainLayout>
    );
  }

  const schema = instance.plugin.settingsSchema || [];
  const previewUrl = `${config.apiUrl}/plugins/instances/${id}/render?mode=preview&t=${previewTimestamp}`;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Back Button + Header */}
        <div>
          <button
            onClick={() => navigate('/plugins')}
            className="inline-flex items-center text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Plugin Library
          </button>
          <h1 className="text-3xl font-bold text-text-primary">{instance.plugin.name}</h1>
          {instance.name && (
            <p className="mt-1 text-text-muted">{instance.name}</p>
          )}
        </div>

        {/* Error Banner */}
        {instance.lastError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                {instance.lastError.startsWith('[settings]') ? 'Configuration Required' :
                 instance.lastError.startsWith('[network]') ? 'Network Error' :
                 instance.lastError.startsWith('[ruby]') ? 'Plugin Error' :
                 instance.lastError.startsWith('[template]') ? 'Template Error' : 'Plugin Error'}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {instance.lastError.replace(/^\[(settings|network|ruby|template)\]\s*/, '')}
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                {instance.lastError.startsWith('[settings]') ? 'Fill in the required settings below and save.' :
                 instance.lastError.startsWith('[network]') ? 'Check your API key or try refreshing the preview.' :
                 instance.lastError.startsWith('[ruby]') ? 'This plugin may not be fully compatible yet.' :
                 'Try refreshing the preview.'}
              </p>
            </div>
          </div>
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Settings Form */}
          <div className="lg:col-span-2">
            <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light p-6">
              <h2 className="text-xl font-semibold text-text-primary mb-6">Settings</h2>

              {/* OAuth Connect Section */}
              {instance.plugin.oauthProvider && (
                <div className="mb-6 p-4 rounded-lg border border-border-light bg-bg-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">
                        {instance.oauthToken ? 'Connected' : 'Authentication Required'}
                      </h3>
                      <p className="text-xs text-text-muted mt-1">
                        This plugin requires {instance.plugin.oauthProvider} authorization
                      </p>
                    </div>
                    {instance.oauthToken ? (
                      <button
                        onClick={handleOAuthDisconnect}
                        className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <Button onClick={handleOAuthConnect} disabled={oauthConnecting}>
                        {oauthConnecting ? 'Connecting...' : `Connect ${instance.plugin.oauthProvider}`}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {schema.length === 0 ? (
                <p className="text-text-muted">This plugin has no configurable settings.</p>
              ) : (
                <div className="space-y-5">
                  {schema.map((field) => (
                    <SettingsFieldRenderer
                      key={field.key}
                      field={field}
                      value={formValues[field.key]}
                      onChange={(value) => handleFieldChange(field.key, value)}
                      onMultiSelectToggle={(optionValue) => handleMultiSelectToggle(field.key, optionValue)}
                    />
                  ))}

                  <div className="pt-4 border-t border-border-light">
                    <Button onClick={handleSave} disabled={saveMutation.isLoading}>
                      {saveMutation.isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Save Settings
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview + Info */}
          <div className="space-y-6">
            {/* Preview Panel */}
            <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary">Preview</h3>
                <button
                  onClick={() => setPreviewTimestamp(Date.now())}
                  className="inline-flex items-center text-sm text-accent hover:text-accent/80 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Preview
                </button>
              </div>
              <div className="bg-bg-muted rounded-lg overflow-hidden border border-border-light">
                <img
                  src={previewUrl}
                  alt="Plugin preview"
                  className="w-full h-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Plugin Info */}
            <div className="bg-bg-card rounded-xl shadow-theme-sm border border-border-light p-4">
              <h3 className="text-base font-semibold text-text-primary mb-3">Plugin Info</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Category</dt>
                  <dd>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-bg-muted text-text-secondary border border-border-light">
                      {instance.plugin.category}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Source</dt>
                  <dd className="text-text-secondary font-medium">{instance.plugin.source}</dd>
                </div>
                {instance.plugin.description && (
                  <div>
                    <dt className="text-text-muted mb-1">Description</dt>
                    <dd className="text-text-secondary">{instance.plugin.description}</dd>
                  </div>
                )}
                {instance.lastFetchedAt && (
                  <div className="flex items-center justify-between">
                    <dt className="text-text-muted">Last fetched</dt>
                    <dd className="text-text-secondary">{formatRelativeTime(instance.lastFetchedAt)}</dd>
                  </div>
                )}
                {instance.lastError && (
                  <div>
                    <dt className="text-text-muted mb-1">Last error</dt>
                    <dd className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                      {instance.lastError}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

interface SettingsFieldRendererProps {
  field: SettingsField;
  value: any;
  onChange: (value: any) => void;
  onMultiSelectToggle: (optionValue: string) => void;
}

function SettingsFieldRenderer({ field, value, onChange, onMultiSelectToggle }: SettingsFieldRendererProps) {
  const inputClasses =
    'w-full px-3 py-2.5 rounded-lg border border-border-light bg-bg-input text-text-primary placeholder-text-placeholder focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all';

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {field.description && (
        <p className="text-xs text-text-muted mb-2">{field.description}</p>
      )}

      {/* Text / Password */}
      {(field.type === 'text' || field.type === 'password' || field.encrypted) && (
        <input
          type={field.encrypted || field.type === 'password' ? 'password' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      )}

      {/* Number */}
      {field.type === 'number' && !field.encrypted && (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={inputClasses}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      )}

      {/* Date */}
      {field.type === 'date' && (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )}

      {/* Select */}
      {field.type === 'select' && (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Toggle */}
      {field.type === 'toggle' && (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-bg-muted border border-border-light peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
        </label>
      )}

      {/* Multi Select (Checkboxes) */}
      {field.type === 'multi_select' && (
        <div className="space-y-2">
          {field.options?.map((opt) => {
            const selected: string[] = Array.isArray(value) ? value : [];
            return (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => onMultiSelectToggle(opt.value)}
                  className="rounded border-border-light text-accent focus:ring-accent/20"
                />
                <span className="text-sm text-text-secondary">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
