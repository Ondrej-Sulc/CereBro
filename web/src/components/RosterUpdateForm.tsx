"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function RosterUpdateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  
  const [stars, setStars] = useState("6");
  const [rank, setRank] = useState("3");
  const [isAscended, setIsAscended] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("stars", stars);
    formData.append("rank", rank);
    formData.append("isAscended", String(isAscended));
    
    for (let i = 0; i < files.length; i++) {
      formData.append("images", files[i]);
    }

    try {
      const res = await fetch("/api/profile/roster/update", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to update roster");
      }

      setResult({
        success: data.count,
        errors: data.errors || [],
      });
      
      // Clear files on success
      if (data.count > 0) {
        setFiles(null);
        // Reset file input value manually if needed, or rely on key change
      }
      
    } catch (err: any) {
      setResult({
        success: 0,
        errors: [err.message],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle>Upload Roster Screenshots</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stars">Star Level</Label>
                <Select value={stars} onValueChange={setStars}>
                  <SelectTrigger id="stars">
                    <SelectValue placeholder="Select Stars" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}-Star</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rank">Rank</Label>
                <Select value={rank} onValueChange={setRank}>
                  <SelectTrigger id="rank">
                    <SelectValue placeholder="Select Rank" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((r) => (
                      <SelectItem key={r} value={String(r)}>Rank {r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="ascended" 
                checked={isAscended} 
                onCheckedChange={(c) => setIsAscended(!!c)} 
              />
              <Label htmlFor="ascended" className="cursor-pointer font-normal">Is Ascended?</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="images">Screenshots</Label>
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="dropzone-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-950/50 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-400">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">PNG, JPG (MAX. 5 files)</p>
                  </div>
                  <Input 
                    id="dropzone-file" 
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                </label>
              </div>
              {files && files.length > 0 && (
                <div className="text-sm text-slate-300">
                  {files.length} file(s) selected
                </div>
              )}
            </div>

            {result && (
              <div className="space-y-4">
                 {result.success > 0 && (
                    <Alert className="border-green-900 bg-green-950/30 text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>
                            Successfully updated {result.success} champions!
                        </AlertDescription>
                    </Alert>
                 )}
                 {result.errors.length > 0 && (
                    <Alert variant="destructive" className="border-red-900 bg-red-950/30">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Errors</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1">
                                {result.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                 )}
              </div>
            )}

            <div className="flex justify-end gap-3">
               <Button type="button" variant="outline" onClick={() => router.push('/profile')}>
                 Cancel
               </Button>
               <Button type="submit" className="bg-sky-600 hover:bg-sky-700" disabled={loading || !files || files.length === 0}>
                  {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                  ) : (
                    "Upload & Update"
                  )}
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
