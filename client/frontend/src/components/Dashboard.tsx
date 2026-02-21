import { useState, useEffect } from "react";
import type { HealthStatus, UserSettings, Provider } from "../types";
import { getHealth, getSettings, updateSettings } from "../lib/localApi";
import { useProviders } from "../hooks/useProviders";
import ProviderBadge from "./ProviderBadge";

interface DashboardProps {
  onSettingsChange?: (settings: UserSettings) => void;
}

export default function Dashboard({ onSettingsChange }: DashboardProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [settings, _setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: providers } = useProviders();

  const setSettings = (s: UserSettings) => {
    _setSettings(s);
    onSettingsChange?.(s);
  };

  useEffect(() => {
    async function load() {
      try {
        const [h, s] = await Promise.all([getHealth(), getSettings()]);
        setHealth(h);
        setSettings(s);
      } catch {
        // Will show as disconnected
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* System Status */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          System Status
        </h2>
        <StatusCard
          label="Gateway Server"
          ok={health?.gateway_reachable ?? false}
          detail={health?.gateway_server ?? "unknown"}
        />
      </section>

      {/* Providers */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Available Providers
        </h2>
        {providers ? (
          <div className="grid gap-2">
            {providers.map((p: Provider) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-gray-800/50 border border-gray-800 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <ProviderBadge name={p.name} tier={p.tier} />
                  <span className="text-xs text-gray-500">{p.id}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{p.x402_price}</span>
                  <span className="text-gray-600">
                    {p.capabilities.domains.join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Cannot reach gateway server
          </p>
        )}
      </section>

      {/* Settings */}
      {settings && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Settings
          </h2>
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 space-y-4">
            {/* PII Mode */}
            <SettingRow label="PII Mode">
              <select
                value={settings.pii_mode}
                onChange={async (e) => {
                  const val = e.target.value as "none" | "permissive" | "strict" | "user_select";
                  const updated = await updateSettings({ pii_mode: val });
                  setSettings(updated);
                }}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              >
                <option value="none">None — no PII filtering</option>
                <option value="permissive">Permissive — mask critical only</option>
                <option value="strict">Strict — mask all detected</option>
                <option value="user_select">User Select — choose each time</option>
              </select>
            </SettingRow>

            {/* Max Budget per Request */}
            <SettingRow label="Max Budget per Request">
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <NumberInput
                  value={settings.max_budget_per_request}
                  min={0.001}
                  step={0.001}
                  onCommit={async (val) => {
                    const updated = await updateSettings({ max_budget_per_request: val });
                    setSettings(updated);
                  }}
                />
                <span className="text-xs text-gray-500">USDC</span>
              </div>
            </SettingRow>

            {/* Monthly Max Budget */}
            <SettingRow label="Monthly Max Budget">
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <NumberInput
                  value={settings.monthly_max_budget}
                  min={0}
                  step={0.1}
                  onCommit={async (val) => {
                    const updated = await updateSettings({ monthly_max_budget: val });
                    setSettings(updated);
                  }}
                />
                <span className="text-xs text-gray-500">USDC</span>
              </div>
            </SettingRow>

            {/* Extended Thinking */}
            <SettingRow label="Extended Thinking">
              <CheckboxToggle
                checked={settings.extended_thinking}
                onChange={async (val) => {
                  setSettings({ ...settings, extended_thinking: val });
                  const updated = await updateSettings({ extended_thinking: val });
                  setSettings(updated);
                }}
              />
            </SettingRow>

            {/* Web Search */}
            <SettingRow label="Web Search">
              <CheckboxToggle
                checked={settings.web_search}
                onChange={async (val) => {
                  setSettings({ ...settings, web_search: val });
                  const updated = await updateSettings({ web_search: val });
                  setSettings(updated);
                }}
              />
            </SettingRow>

            {/* 0G Inference */}
            <div className="border-t border-gray-700 pt-4 mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-200">0G Compute Inference</span>
                <CheckboxToggle
                  checked={settings.use_0g_inference}
                  onChange={async (val) => {
                    setSettings({ ...settings, use_0g_inference: val });
                    const updated = await updateSettings({ use_0g_inference: val });
                    setSettings(updated);
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mb-3">
                AI-powered smart routing via OpenAI-compatible inference (e.g. Together AI).
                Classifies domain, complexity, and thinking needs — complexity auto-adjusts tier.
              </p>
              {settings.use_0g_inference && (
                <div className="space-y-2">
                  <SettingRow label="API Key">
                    <input
                      type="password"
                      value={settings.zero_g_api_key}
                      placeholder="Together AI key (tgp_v1_…)"
                      onChange={async (e) => {
                        const updated = await updateSettings({ zero_g_api_key: e.target.value });
                        setSettings(updated);
                      }}
                      className="w-48 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                  </SettingRow>
                  <SettingRow label="Base URL">
                    <input
                      type="text"
                      value={settings.zero_g_base_url}
                      placeholder="https://api.together.xyz/v1"
                      onChange={async (e) => {
                        const updated = await updateSettings({ zero_g_base_url: e.target.value });
                        setSettings(updated);
                      }}
                      className="w-48 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                  </SettingRow>
                  <SettingRow label="Model">
                    <input
                      type="text"
                      value={settings.zero_g_model}
                      placeholder="meta-llama/Llama-3.3-70B-Instruct-Turbo"
                      onChange={async (e) => {
                        const updated = await updateSettings({ zero_g_model: e.target.value });
                        setSettings(updated);
                      }}
                      className="w-48 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                    />
                  </SettingRow>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusCard({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-2 h-2 rounded-full ${
            ok ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-xs text-gray-500">{detail}</span>
    </div>
  );
}

function NumberInput({
  value,
  min,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  step: number;
  onCommit: (val: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Sync display value when parent setting changes (e.g. after successful save)
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const val = parseFloat(draft);
    if (!isNaN(val) && val >= min) {
      onCommit(val);
    } else {
      setDraft(String(value)); // revert to last valid value
    }
  };

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(String(value));
      }}
      className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-blue-500"
    />
  );
}

function CheckboxToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className="text-gray-300">{checked ? "Enabled" : "Disabled"}</span>
    </label>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">{label}</span>
      {children}
    </div>
  );
}
