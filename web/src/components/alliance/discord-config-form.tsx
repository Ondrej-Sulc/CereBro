"use client";

import { useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { AllianceDiscordConfig, DiscordChannelOption, DiscordRoleOption } from "@/app/actions/alliance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DiscordConfigFormProps = {
  initialConfig: AllianceDiscordConfig;
  roles: DiscordRoleOption[];
  channels: DiscordChannelOption[];
  onSave: (config: AllianceDiscordConfig) => Promise<{ queuedRoleSync: boolean }>;
  saving?: boolean;
};

const NONE = "__none__";

const ROLE_FIELDS: { key: keyof AllianceDiscordConfig; label: string }[] = [
  { key: "officerRole", label: "Officer role" },
  { key: "plannerRole", label: "Planner role" },
  { key: "battlegroup1Role", label: "Battlegroup 1 role" },
  { key: "battlegroup2Role", label: "Battlegroup 2 role" },
  { key: "battlegroup3Role", label: "Battlegroup 3 role" },
];

const CHANNEL_FIELDS: { key: keyof AllianceDiscordConfig; label: string }[] = [
  { key: "battlegroup1ChannelId", label: "Battlegroup 1 channel" },
  { key: "battlegroup2ChannelId", label: "Battlegroup 2 channel" },
  { key: "battlegroup3ChannelId", label: "Battlegroup 3 channel" },
  { key: "warVideosChannelId", label: "War videos channel" },
  { key: "deathChannelId", label: "Deaths channel" },
];

export function DiscordConfigForm({ initialConfig, roles, channels, onSave, saving = false }: DiscordConfigFormProps) {
  const [config, setConfig] = useState<AllianceDiscordConfig>(initialConfig);

  const roleIds = useMemo(() => new Set(roles.map((role) => role.id)), [roles]);
  const channelIds = useMemo(() => new Set(channels.map((channel) => channel.id)), [channels]);

  const setField = (field: keyof AllianceDiscordConfig, value: string) => {
    setConfig((current) => ({
      ...current,
      [field]: value === NONE ? null : value,
    }));
  };

  const valueFor = (field: keyof AllianceDiscordConfig) => config[field] ?? NONE;

  const renderUnknownRole = (roleId: string | null) => {
    if (!roleId || roleIds.has(roleId)) return null;
    return <SelectItem value={roleId}>Unknown role: {roleId}</SelectItem>;
  };

  const renderUnknownChannel = (channelId: string | null) => {
    if (!channelId || channelIds.has(channelId)) return null;
    return <SelectItem value={channelId}>Unknown channel: {channelId}</SelectItem>;
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Roles</h3>
          <p className="text-xs text-slate-500">Discord roles mapped to alliance permissions and battlegroups.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLE_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-slate-400">{label}</Label>
              <Select value={valueFor(key)} onValueChange={(value) => setField(key, value)} disabled={saving}>
                <SelectTrigger className="bg-slate-950 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not configured</SelectItem>
                  {renderUnknownRole(config[key])}
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Channels</h3>
          <p className="text-xs text-slate-500">Default Discord destinations for alliance war sharing.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHANNEL_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-slate-400">{label}</Label>
              <Select value={valueFor(key)} onValueChange={(value) => setField(key, value)} disabled={saving}>
                <SelectTrigger className="bg-slate-950 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not configured</SelectItem>
                  {renderUnknownChannel(config[key])}
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>#{channel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => onSave(config)} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Discord Configuration
        </Button>
      </div>
    </div>
  );
}
