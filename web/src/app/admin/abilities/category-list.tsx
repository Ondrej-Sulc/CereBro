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
import { Edit2, Trash2, Plus } from "lucide-react"
import { createAbilityCategory, updateAbilityCategory, deleteAbilityCategory } from "./actions"
import { useToast } from "@/hooks/use-toast"

type Category = {
    id: number;
    name: string;
    description: string;
    _count: { abilities: number };
}

export function CategoryList({ initialCategories }: { initialCategories: Category[] }) {
    const [categories, setCategories] = useState(initialCategories)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()

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
                setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, name, description } : c))
                toast({ title: "Category updated" })
            } else {
                await createAbilityCategory(name, description)
                window.location.reload()
            }
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
            setCategories(categories.filter(c => c.id !== id))
            toast({ title: "Category deleted" })
        } catch (error) {
            toast({ title: "Error deleting category", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 mr-2" /> Add Category
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Linked Abilities</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={category.id}>
                                <TableCell className="font-medium">{category.name}</TableCell>
                                <TableCell className="text-muted-foreground">{category.description}</TableCell>
                                <TableCell>{category._count.abilities}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(category)}>
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(category.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {categories.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                    No categories found.
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
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !name.trim()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
