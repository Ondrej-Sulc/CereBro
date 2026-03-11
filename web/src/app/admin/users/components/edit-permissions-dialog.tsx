"use client"

import { useState } from "react"
import { updateBotUserPermissions } from "../actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AVAILABLE_PERMISSIONS } from "@/lib/permissions"

interface EditPermissionsDialogProps {
  botUserId: string;
  initialPermissions: string[];
  userName: string;
  isBotAdmin: boolean;
}

export function EditPermissionsDialog({ botUserId, initialPermissions, userName, isBotAdmin: initialIsBotAdmin }: EditPermissionsDialogProps) {
  const [open, setOpen] = useState(false)
  const [permissions, setPermissions] = useState<string[]>(initialPermissions)
  const [isBotAdmin, setIsBotAdmin] = useState(initialIsBotAdmin)
  const [isPending, setIsPending] = useState(false)
  const { toast } = useToast()

  const handleToggle = (permId: string, checked: boolean) => {
    if (checked) {
      setPermissions([...permissions, permId])
    } else {
      setPermissions(permissions.filter(id => id !== permId))
    }
  }

  const handleSave = async () => {
    setIsPending(true)
    const result = await updateBotUserPermissions(botUserId, { permissions, isBotAdmin })
    setIsPending(false)
    if (result.success) {
      toast({ title: "Permissions updated successfully" })
      setOpen(false)
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-medium border">
          <Settings className="w-3 h-3 mr-1" />
          {initialIsBotAdmin ? "Full Admin" : `${permissions.length} Perms`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Permissions</DialogTitle>
          <DialogDescription>
            Manage specific admin access for {userName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-row items-start space-x-3 space-y-0 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <Checkbox 
                    id="isBotAdmin" 
                    checked={isBotAdmin} 
                    onCheckedChange={(c) => setIsBotAdmin(c === true)}
                />
                <div className="space-y-1 leading-none">
                    <label
                        htmlFor="isBotAdmin"
                        className="text-sm font-bold text-purple-900 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Full Bot Admin
                    </label>
                    <p className="text-sm text-purple-700/70">
                        Has complete, unrestricted access to all admin features.
                    </p>
                </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Granular Permissions</span>
            </div>
          </div>

          <div className="grid gap-3 opacity-100 transition-opacity duration-200" style={{ opacity: isBotAdmin ? 0.5 : 1 }}>
            {AVAILABLE_PERMISSIONS.map((perm) => (
                <div key={perm.id} className="flex flex-row items-start space-x-3 space-y-0">
                    <Checkbox 
                        id={perm.id} 
                        checked={isBotAdmin || permissions.includes(perm.id)} 
                        disabled={isBotAdmin}
                        onCheckedChange={(c) => handleToggle(perm.id, c === true)}
                    />
                    <div className="space-y-1 leading-none">
                        <label
                            htmlFor={perm.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {perm.label}
                        </label>
                        <p className="text-sm text-muted-foreground">
                            {perm.description}
                        </p>
                    </div>
                </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
