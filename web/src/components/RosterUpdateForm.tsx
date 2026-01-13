"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, Check, ImagePlus, Sparkles, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { ChampionImages } from "@/types/champion";
import { Progress } from "@/components/ui/progress";
import axios from "axios";

// Define local types matching what the API returns
interface ChampionData {
    id: number;
    name: string;
    images: ChampionImages;
}

interface RosterWithChampion {
    stars: number;
    rank: number;
    isAwakened: boolean;
    powerRating?: number | null; // Add this line
    champion: ChampionData;
}

interface UpdateResult {
    success: number;
    added: RosterWithChampion[];
    errors: string[];
}

export function RosterUpdateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);
  
  const [stars, setStars] = useState("6");
  const [rank, setRank] = useState("3");
  const [isAscended, setIsAscended] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const newFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
            newFiles.push(blob);
        }
      }
    }

    if (newFiles.length > 0) {
        addFiles(newFiles);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
        window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

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

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = document.createElement("img");
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Max dimension 2560px (good balance for OCR)
                const MAX_DIMENSION = 2560;
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Compression failed"));
                }, "image/jpeg", 0.85); // 0.85 quality JPEG
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setResult(null);
    setUploadProgress(0);
    setStatusMessage("Preparing images...");

    const formData = new FormData();
    formData.append("stars", stars);
    formData.append("rank", rank);
    formData.append("isAscended", String(isAscended));
    
    try {
        // Compress/Convert all images
        for (let i = 0; i < files.length; i++) {
            setStatusMessage(`Processing image ${i + 1} of ${files.length}...`);
            const compressedBlob = await compressImage(files[i]);
            formData.append("images", compressedBlob, files[i].name.replace(/\.[^/.]+$/, "") + ".jpg");
        }

        setStatusMessage("Uploading...");

        const response = await axios.post("/api/profile/roster/update", formData, {
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                setUploadProgress(percentCompleted);
                if (percentCompleted === 100) {
                    setStatusMessage("Analyzing roster... (this may take a moment)");
                }
            },
        });
      
        const data = response.data;
      
        setResult({
            success: data.count,
            added: data.added || [],
            errors: data.errors || [],
        });
      
        // Clear files on success
        if (data.count > 0) {
            setFiles([]);
            setPreviews([]);
        }
      
    } catch (err: unknown) {
        const error = err as any;
        const errorMessage = error.response?.data?.error || error.message || "Failed to update roster";
        setResult({
            success: 0,
            added: [],
            errors: [errorMessage],
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <ImagePlus className="w-6 h-6 text-sky-400" />
            Upload Roster Screenshots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Configuration Row */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-950/30 rounded-lg border border-slate-800/50">
                <div className="flex-1 space-y-2">
                    <Label htmlFor="stars">Star Level</Label>
                    <Select value={stars} onValueChange={setStars}>
                    <SelectTrigger id="stars" className="bg-slate-900 border-slate-700">
                        <SelectValue placeholder="Select Stars" />
                    </SelectTrigger>
                    <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}-Star</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 space-y-2">
                    <Label htmlFor="rank">Rank</Label>
                    <Select value={rank} onValueChange={setRank}>
                    <SelectTrigger id="rank" className="bg-slate-900 border-slate-700">
                        <SelectValue placeholder="Select Rank" />
                    </SelectTrigger>
                    <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((r) => (
                        <SelectItem key={r} value={String(r)}>Rank {r}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2 pt-8 sm:pt-0">
                    <Checkbox 
                        id="ascended" 
                        checked={isAscended} 
                        onCheckedChange={(c) => setIsAscended(!!c)} 
                        className="border-slate-600 data-[state=checked]:bg-sky-600"
                    />
                    <Label htmlFor="ascended" className="cursor-pointer font-normal text-slate-300">Is Ascended?</Label>
                </div>
            </div>

            {/* Dropzone & Preview Area */}
            <div className="space-y-4">
              <Label>Screenshots</Label>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Upload Button/Dropzone */}
                <label
                  htmlFor="dropzone-file"
                  className="col-span-2 md:col-span-2 flex flex-col items-center justify-center w-full h-48 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer bg-slate-950/30 hover:bg-slate-900/50 hover:border-sky-500/50 transition-all group"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    <Upload className="w-10 h-10 mb-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    <p className="mb-2 text-sm text-slate-400">
                      <span className="font-semibold text-sky-400">Click to upload</span> or paste (Ctrl+V)
                    </p>
                    <p className="text-xs text-slate-500">Supported formats: PNG, JPG</p>
                  </div>
                  <Input 
                    id="dropzone-file" 
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>

                {/* Image Previews */}
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

              {files.length > 0 && (
                <p className="text-sm text-slate-400 text-right">
                  {files.length} image{files.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
               <Button type="button" variant="ghost" onClick={() => router.push('/profile')}>
                 Cancel
               </Button>
               <Button type="submit" className="bg-sky-600 hover:bg-sky-700 min-w-[140px]" disabled={loading || files.length === 0}>
                  {loading ? (
                    <div className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </div>
                  ) : (
                    "Upload & Process"
                  )}
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Processing Animation / Results */}
      <AnimatePresence>
        {loading && (
             <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4"
             >
                <div className="relative w-24 h-24 mb-8">
                    <motion.div 
                        className="absolute inset-0 border-4 border-sky-500 rounded-lg"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                     <motion.div 
                        className="absolute inset-0 border-4 border-sky-500/30 rounded-lg rotate-45"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Upload className="w-10 h-10 text-sky-400 animate-pulse" />
                    </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 text-center">{statusMessage}</h3>
                
                {/* Progress Bar */}
                <div className="w-full max-w-sm mt-4">
                     <Progress value={uploadProgress} className="h-2" />
                     <p className="text-slate-400 text-sm text-center mt-2">{uploadProgress}%</p>
                </div>

             </motion.div>
        )}

        {result && (
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Success Summary */}
                {result.success > 0 && (
                     <Card className="border-green-900/50 bg-green-950/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-green-400 flex items-center gap-2">
                                <Check className="w-5 h-5" />
                                Updated {result.success} Champions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                                {result.added.map((item, i) => (
                                    <motion.div 
                                        key={`${item.champion.id}-${i}`}
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="relative aspect-square rounded-md overflow-hidden border border-slate-700 bg-slate-900 group"
                                    >
                                        <Image 
                                            src={getChampionImageUrl(item.champion.images, '128')}
                                            alt={item.champion.name}
                                            width={128}
                                            height={128}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-0.5 left-0.5 z-10">
                                            {item.isAwakened ? (
                                                <Sparkles className="w-3.5 h-3.5 text-slate-100 fill-slate-300 drop-shadow-md" />
                                            ) : (
                                                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-500 drop-shadow-md" />
                                            )}
                                        </div>
                                        {item.powerRating && (
                                            <span className="absolute bottom-0 left-0 z-10 text-[9px] text-slate-300 bg-black/70 px-1 py-0.5 rounded-tr-md">
                                                PR: {item.powerRating}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-1">
                                            <span className="text-[10px] text-white font-medium truncate w-full text-center">
                                                {item.champion.name}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </CardContent>
                     </Card>
                )}

                {/* Error Summary */}
                {result.errors.length > 0 && (
                    <Alert variant="destructive" className="border-red-900 bg-red-950/20">
                        <AlertTitle>Issues Found</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1 mt-2 text-sm text-red-200/80">
                                {result.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

