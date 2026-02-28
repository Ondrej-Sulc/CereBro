"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, Bug } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import axios from "axios";

export function DebugRosterForm() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ original: string; debug: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const addFiles = (newFiles: File[]) => {
      setFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
      URL.revokeObjectURL(previews[index]);
      setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          addFiles(Array.from(e.target.files));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setResults([]);
    setStatusMessage("Processing...");

    const formData = new FormData();
    files.forEach(file => {
        formData.append("images", file);
    });

    try {
        const response = await axios.post("/api/admin/debug-roster", formData);
        setResults(response.data.results);
        setFiles([]);
        setPreviews([]);
    } catch (err: unknown) {
        console.error(err);
        if (axios.isAxiosError<{ error: string }>(err)) {
            setStatusMessage("Error: " + (err.response?.data?.error || err.message));
        } else {
            setStatusMessage("Error: " + (err instanceof Error ? err.message : String(err)));
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Bug className="w-6 h-6 text-yellow-500" />
            Debug Roster Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label>Screenshots</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label
                  className="col-span-2 md:col-span-2 flex flex-col items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-950/30 hover:bg-slate-900/50 hover:border-yellow-500/50 transition-all group"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    <Upload className="w-10 h-10 mb-3 text-slate-500 group-hover:text-yellow-400 transition-colors" />
                    <p className="mb-2 text-sm text-slate-400">
                      <span className="font-semibold text-yellow-400">Click to upload</span>
                    </p>
                  </div>
                  <Input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>

                <AnimatePresence>
                    {previews.map((src, index) => (
                        <motion.div 
                            key={src}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="relative aspect-video rounded-lg overflow-hidden border border-slate-700 group"
                        >
                            <Image src={src} alt={`Preview ${index}`} fill className="object-cover" />
                            <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex justify-end">
               <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-white" disabled={loading || files.length === 0}>
                  {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                  ) : (
                    "Process & Debug"
                  )}
               </Button>
            </div>
          </form>

          {statusMessage && loading && (
              <p className="text-center text-slate-400 mt-4">{statusMessage}</p>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
          <div className="space-y-8">
              {results.map((res, i) => (
                  <Card key={i} className="border-slate-800 bg-slate-900/50 overflow-hidden">
                      <CardHeader>
                          <CardTitle>Result {i + 1}</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="relative w-full h-[600px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                              <Image 
                                  src={`data:image/jpeg;base64,${res.debug}`} 
                                  alt={`Debug Output ${i}`}
                                  fill
                                  className="object-contain"
                              />
                          </div>
                      </CardContent>
                  </Card>
              ))}
          </div>
      )}
    </div>
  );
}
