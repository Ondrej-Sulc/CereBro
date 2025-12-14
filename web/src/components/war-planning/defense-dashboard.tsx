"use client";

import { useState, useMemo } from "react";
import { WarDefensePlan, WarMapType } from "@prisma/client";
import Link from "next/link";
import { 
  Plus, 
  Shield, 
  Calendar, 
  ArrowRight, 
  LayoutDashboard,
  Trash2,
  Rocket
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { createDefensePlan, deleteDefensePlan } from "@/app/planning/defense-actions";
import { useToast } from "@/hooks/use-toast";
import { useFormStatus } from "react-dom";

interface DefenseDashboardProps {
  plans: WarDefensePlan[];
  userTimezone?: string | null;
  isOfficer?: boolean;
}

// Separate component for submit button to use useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button 
      type="submit" 
      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/20 transition-all duration-300 transform hover:scale-[1.02]"
      disabled={pending}
    >
      {pending ? "Creating..." : (
        <>
          <Rocket className="mr-2 h-4 w-4" />
          Create Plan
        </>
      )}
    </Button>
  );
}

export default function DefenseDashboard({
  plans,
  userTimezone,
  isOfficer,
}: DefenseDashboardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMapType, setSelectedMapType] = useState<WarMapType>(WarMapType.STANDARD);
  
  // Sort plans by updated date desc
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [plans]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            War Defense Planner
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Strategize and manage alliance war defense placements.
          </p>
        </div>
        
        {isOfficer && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-glow transition-all">
                <Plus className="mr-2 h-5 w-5" />
                New Defense Plan
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800">
                <DialogHeader>
                <DialogTitle>Create Defense Plan</DialogTitle>
                <DialogDescription>
                    Create a new defense layout to start assigning defenders.
                </DialogDescription>
                </DialogHeader>
                <form action={createDefensePlan} className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Plan Name</Label>
                    <Input
                        id="name"
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. Season 48 Base"
                        className="bg-slate-900 border-slate-800"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="mapType">Map Type</Label>
                    <Select name="mapType" defaultValue={selectedMapType} onValueChange={(val) => {
                        if (Object.values(WarMapType).includes(val as WarMapType)) {
                            setSelectedMapType(val as WarMapType);
                        } else {
                            // Optionally handle invalid value, e.g., set to a default or log error
                            console.warn("Invalid WarMapType selected:", val);
                        }
                    }}>
                        <SelectTrigger className="bg-slate-900 border-slate-800">
                            <SelectValue placeholder="Select Map Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                            <SelectItem value={WarMapType.STANDARD}>Standard Map (50 Nodes)</SelectItem>
                            <SelectItem value={WarMapType.BIG_THING}>Big Thing (10 Nodes)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex justify-end pt-4">
                    <SubmitButton />
                </div>
                </form>
            </DialogContent>
            </Dialog>
        )}
      </div>

      <Separator className="bg-slate-800" />

      {/* Plans Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-semibold text-indigo-400">
          <LayoutDashboard className="h-6 w-6" />
          <h2>Defense Plans</h2>
        </div>
        
        {sortedPlans.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-800 rounded-lg bg-slate-950/50 text-center text-slate-500">
            <p>No defense plans found. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} userTimezone={userTimezone} isOfficer={isOfficer} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlanCard({ plan, userTimezone, isOfficer }: { plan: WarDefensePlan; userTimezone?: string | null; isOfficer?: boolean }) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const dateString = useMemo(() => {
    try {
        return new Date(plan.updatedAt).toLocaleDateString(undefined, {
            timeZone: userTimezone || undefined
        });
    } catch (e) {
        // Fallback if timezone is invalid
        return new Date(plan.updatedAt).toLocaleDateString();
    }
  }, [plan.updatedAt, userTimezone]);

  return (
    <Card className="bg-slate-950/40 hover:bg-slate-950/60 hover:border-indigo-500/50 border-slate-800 overflow-hidden transition-all duration-300 group shadow-lg hover:shadow-indigo-500/10">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
           <div className="space-y-1">
             <CardTitle className="text-xl flex items-center gap-2 text-slate-200 group-hover:text-indigo-300 transition-colors">
                <Shield className="h-5 w-5 text-indigo-500" />
                {plan.name}
             </CardTitle>
             <CardDescription className="flex items-center gap-2">
                {plan.mapType === WarMapType.BIG_THING ? "Big Thing Map" : "Standard Map"}
             </CardDescription>
           </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
             <Calendar className="h-3.5 w-3.5" />
             <span>Updated: {dateString}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t border-slate-800/50 bg-slate-900/20 gap-2">
        <Link href={`/planning/defense/${plan.id}`} className="flex-1">
          <Button variant="secondary" className="w-full gap-2 transition-all bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-600/30 hover:border-indigo-500">
            Open Planner
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        
        {isOfficer && (
            <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-950 border-slate-800">
                <AlertDialogHeader>
                <AlertDialogTitle>Delete Defense Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the plan <span className="text-white font-semibold">{plan.name}</span> and all defender assignments.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-900 border-slate-800 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={async () => {
                    if (isDeleting) return;
                    setIsDeleting(true);
                    try {
                        await deleteDefensePlan(plan.id);
                        toast({
                        title: "Plan Deleted",
                        description: `Defense plan has been deleted.`
                        });
                    } catch (error) {
                        console.error("Failed to delete plan:", error);
                        toast({
                        title: "Delete Failed",
                        description: "Could not delete the plan. Please try again.",
                        variant: "destructive"
                        });
                    } finally {
                        setIsDeleting(false);
                    }
                    }}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDeleting ? "Deleting..." : "Delete Plan"}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}
