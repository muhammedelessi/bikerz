import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Plus,
  Eye,
  Heart,
  MessageCircle,
  Video as VideoIcon,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminChampions } from "@/hooks/admin/useAdminChampions";

const AdminChampions: React.FC = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { champions, isLoading, deleteChampion, isDeleting } =
    useAdminChampions();

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteChampion(confirmDelete);
      toast.success(isRTL ? "تم الحذف" : "Deleted");
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error(err?.message || (isRTL ? "فشل الحذف" : "Failed to delete"));
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              {isRTL ? "أبطال المجتمع" : "Community Champions"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isRTL
                ? `${champions.length} بطل مُسجّل`
                : `${champions.length} champions`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/community-champions" target="_blank" rel="noopener noreferrer">
                <Eye className="w-4 h-4 me-2" />
                {isRTL ? "عرض الصفحة" : "View Page"}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/admin/champions/new">
                <Plus className="w-4 h-4 me-2" />
                {isRTL ? "إضافة بطل" : "Add Champion"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? "البطل" : "Champion"}</TableHead>
                <TableHead className="text-center">
                  <VideoIcon className="w-4 h-4 inline" />
                </TableHead>
                <TableHead className="text-center">
                  <Heart className="w-4 h-4 inline" />
                </TableHead>
                <TableHead className="text-center">
                  <MessageCircle className="w-4 h-4 inline" />
                </TableHead>
                <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-end">
                  {isRTL ? "إجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : champions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground text-sm">
                    {isRTL ? "لا يوجد أبطال بعد." : "No champions yet."}
                  </TableCell>
                </TableRow>
              ) : (
                champions.map((c) => {
                  const initials = c.full_name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            {c.photo_url && <AvatarImage src={c.photo_url} />}
                            <AvatarFallback className="text-xs bg-primary/15 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {c.full_name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {c.video_count}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {c.total_likes}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {c.total_comments}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge variant="default" className="text-xs">
                            {isRTL ? "فعال" : "Active"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {isRTL ? "مخفي" : "Hidden"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/champions/${c.id}`)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(c.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete confirm */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isRTL ? "تأكيد الحذف" : "Confirm delete"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "سيتم حذف البطل وكل الفيديوهات والتعليقات والإعجابات المرتبطة. لا يمكن التراجع."
                : "This will remove the champion and all related videos, comments, and likes. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : (
                <Trash2 className="w-4 h-4 me-2" />
              )}
              {isRTL ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminChampions;
