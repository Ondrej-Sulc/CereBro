"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Edit2, Trash2, Plus, LayoutGrid } from "lucide-react"
import { createAbilityCategory, updateAbilityCategory, deleteAbilityCategory } from "./actions"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

type Category = {
    id: number;
    name: string;
    description: string;
    _count: { abilities: number };
}

export function CategoryList({ initialCategories }: { initialCategories: Category[] }) {
    const categories = initialCategories;
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    const handleOpenDialog = (category?: Category) => {
        if (category) {
            setEditingCategory(category)
            setName(category.name)
            setDescription(category.description)
        } else {
            setEditingCategory(null)
            setName("")
            setDescription("")
        }
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!name.trim()) return

        setIsSubmitting(true)
        try {
            if (editingCategory) {
                await updateAbilityCategory(editingCategory.id, name, description)
                toast({ title: "Category updated" })
            } else {
                await createAbilityCategory(name, description)
                toast({ title: "Category created" })
            }
            router.refresh()
            setIsDialogOpen(false)
        } catch (error) {
            toast({ title: "Error saving category", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure?")) return
        try {
            await deleteAbilityCategory(id)
            toast({ title: "Category deleted" })
            router.refresh()
        } catch (error) {
            toast({ title: "Error deleting category", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="text-sm text-muted-foreground">
                    Organize abilities into logical groupings for easier management.
                </div>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 mr-2" /> Add Category
                </Button>
            </div>

            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[300px]">Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-[150px] text-center">Linked Abilities</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={category.id} className="group">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <LayoutGrid className="w-4 h-4 text-muted-foreground/50" />
                                        {category.name}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{category.description || <span className="italic opacity-50">No description</span>}</TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                        {category._count.abilities}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(category)} aria-label="Edit category">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(category.id)} aria-label="Delete category">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {categories.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <LayoutGrid className="w-8 h-8 opacity-20" />
                                        <p>No categories found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Damage, Utility" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." className="resize-none h-24" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !name.trim()}>Save Category</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
