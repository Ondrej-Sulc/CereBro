"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Link as LinkIcon } from "lucide-react";
import { AsyncPlayerSearchCombobox } from "@/components/comboboxes/AsyncPlayerSearchCombobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { linkSupportDonationToPlayerAction } from "./actions";

export type UnlinkedSupportDonation = {
  id: string;
  amountMinor: number;
  currency: string;
  supporterName: string | null;
  supporterEmail: string | null;
  createdAtIso: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
};

function formatCurrencyMinor(amountMinor: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function LinkSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Linking..." : "Link player"}
    </Button>
  );
}

function LinkDonationDialog({ donation }: { donation: UnlinkedSupportDonation }) {
  const [open, setOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedPlayerName, setSelectedPlayerName] = useState("");

  function resetSelection(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedPlayerId("");
      setSelectedPlayerName("");
    }
  }

  async function linkDonationFormAction(formData: FormData) {
    await linkSupportDonationToPlayerAction(formData);
  }

  return (
    <Dialog open={open} onOpenChange={resetSelection}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LinkIcon className="h-3.5 w-3.5" />
          Link player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link support payment</DialogTitle>
          <DialogDescription>
            This links the selected payment and related unlinked Stripe rows to the selected Player profile. Existing linked rows are not changed.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {donation.supporterName?.trim() || "Anonymous supporter"}
              </p>
              {donation.supporterEmail && (
                <p className="text-xs text-muted-foreground">{donation.supporterEmail}</p>
              )}
            </div>
            <p className="font-semibold tabular-nums">
              {formatCurrencyMinor(donation.amountMinor, donation.currency)}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(donation.createdAtIso)}</span>
            <Badge variant="secondary" className="h-5 text-[10px]">
              {donation.stripeSubscriptionId ? "recurring" : "one-time"}
            </Badge>
            {donation.stripeSubscriptionStatus && (
              <span className="capitalize">{donation.stripeSubscriptionStatus.replace("_", " ")}</span>
            )}
          </div>
        </div>

        <form action={linkDonationFormAction} className="space-y-4">
          <input type="hidden" name="donationId" value={donation.id} />
          <input type="hidden" name="playerId" value={selectedPlayerId} />

          <div className="space-y-2">
            <label className="text-sm font-medium">Player profile</label>
            <AsyncPlayerSearchCombobox
              value={selectedPlayerName}
              onSelect={(id, name) => {
                setSelectedPlayerId(id);
                setSelectedPlayerName(name);
              }}
              placeholder="Search player..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => resetSelection(false)}>
              Cancel
            </Button>
            <LinkSubmitButton disabled={!selectedPlayerId} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnlinkedDonationLinker({ donations }: { donations: UnlinkedSupportDonation[] }) {
  if (donations.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No unlinked succeeded payments found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Supporter</th>
            <th className="py-2 pr-4 font-medium">Payment</th>
            <th className="py-2 pr-4 font-medium">Stripe</th>
            <th className="py-2 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((donation) => (
            <tr key={donation.id} className="border-b border-border/40 last:border-0 align-top">
              <td className="py-3 pr-4">
                <div className="font-medium">
                  {donation.supporterName?.trim() || <span className="italic text-muted-foreground">Anonymous</span>}
                </div>
                {donation.supporterEmail && (
                  <div className="text-xs text-muted-foreground">{donation.supporterEmail}</div>
                )}
              </td>
              <td className="py-3 pr-4">
                <div className="font-medium tabular-nums">
                  {formatCurrencyMinor(donation.amountMinor, donation.currency)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(donation.createdAtIso)}</span>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {donation.stripeSubscriptionId ? "recurring" : "one-time"}
                  </Badge>
                </div>
              </td>
              <td className="py-3 pr-4">
                <div className="space-y-1 font-mono text-xs text-muted-foreground">
                  {donation.stripeCustomerId && <div>{donation.stripeCustomerId}</div>}
                  {donation.stripeSubscriptionId && <div>{donation.stripeSubscriptionId}</div>}
                  {!donation.stripeCustomerId && !donation.stripeSubscriptionId && (
                    <span className="italic">No Stripe ids</span>
                  )}
                </div>
              </td>
              <td className="py-3 text-right">
                <LinkDonationDialog donation={donation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
