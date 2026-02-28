"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, Bug, Clipboard, Maximize2, Hash, Award, Star, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import axios from "axios";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GridCell } from "@cerebro/core/services/roster/types";

interface DebugRosterApiItem {
  fileName: string;
  debug: string;
  success: boolean;
  error?: string;
  grid?: GridCell[];
}

export function DebugRosterForm() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DebugRosterApiItem[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const addFiles = useCallback((newFiles: File[]) => {
      setFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignore if user is typing in an input or textarea (except our file input)
      const target = e.target as HTMLElement;
      if ((target.tagName === "INPUT" && (target as HTMLInputElement).type !== "file") || target.tagName === "TEXTAREA") {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      let foundImage = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            foundImage = true;
            // Give it a name since clipboard files often lack them
            const namedFile = new File([file], `pasted-image-${Date.now()}-${i}.png`, { type: file.type });
            pastedFiles.push(namedFile);
          }
        }
      }

      if (foundImage) {
        e.preventDefault();
        addFiles(pastedFiles);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addFiles]);

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
        const response = await axios.post<{ results: DebugRosterApiItem[] }>("/api/admin/debug-roster", formData);
        setResults(response.data.results);
        setFiles([]);
        setPreviews([]);
    } catch (err: unknown) {
        console.error("Failed to process debug roster:", err);
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
                      <span className="font-semibold text-yellow-400">Click to upload</span> or <span className="text-yellow-400/80">Paste from clipboard</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                       <Clipboard className="w-3 h-3" />
                       <span>Ctrl+V supported</span>
                    </div>
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
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle>Result {i + 1}</CardTitle>
                            <p className="text-xs text-muted-foreground font-mono mt-1">{res.fileName}</p>
                          </div>
                          {res.success && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              {res.grid?.length || 0} Champions Detected
                            </Badge>
                          )}
                      </CardHeader>
                      <CardContent className="space-y-6">
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="relative w-full h-[600px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 group cursor-zoom-in">
                                  <Image 
                                      src={`data:image/jpeg;base64,${res.debug}`} 
                                      alt={`Debug Output ${i}`}
                                      fill
                                      className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                      <div className="bg-black/60 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all">
                                          <Maximize2 className="w-6 h-6" />
                                      </div>
                                  </div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] h-[900px] p-0 bg-slate-950 border-slate-800">
                                <DialogTitle className="sr-only">Debug Image Full View</DialogTitle>
                                <DialogDescription className="sr-only">
                                  Expanded view of the OCR debug output for {res.fileName}
                                </DialogDescription>
                                <div className="relative w-full h-full overflow-auto p-4 flex items-center justify-center bg-slate-950">
                                    <img 
                                      src={`data:image/jpeg;base64,${res.debug}`} 
                                      alt={`Debug Full Output ${i}`}
                                      className="max-w-none min-w-full"
                                    />
                                </div>
                            </DialogContent>
                          </Dialog>

                          {res.grid && res.grid.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {res.grid.map((cell, idx) => (
                                <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex flex-col gap-2 hover:border-yellow-500/30 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-100 truncate flex-1">{cell.championName || "Unknown Champion"}</span>
                                    {cell.isAscended && <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {cell.stars && (
                                      <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border border-yellow-500/20">
                                        <Star className="w-2.5 h-2.5 fill-yellow-500" />
                                        {cell.stars}★
                                      </div>
                                    )}
                                    {cell.rank && (
                                      <div className="flex items-center gap-1 bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-500/20">
                                        <Award className="w-2.5 h-2.5" />
                                        R{cell.rank}
                                      </div>
                                    )}
                                    {cell.powerRating && (
                                      <div className="flex items-center gap-1 bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border border-green-500/20">
                                        <Hash className="w-2.5 h-2.5" />
                                        {cell.powerRating.toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {res.error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-3">
                              <X className="w-5 h-5" />
                              <p className="text-sm font-medium">{res.error}</p>
                            </div>
                          )}
                      </CardContent>
                  </Card>
              ))}
          </div>
      )}
    </div>
  );
}

