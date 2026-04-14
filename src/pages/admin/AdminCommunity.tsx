import React, { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminCommunity } from "@/hooks/admin/useAdminCommunity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const AdminCommunity: React.FC = () => {
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterMotorcycle, setFilterMotorcycle] = useState("all");
  const [page, setPage] = useState(0);

  const { members, total, totalPages, countries, isLoading } = useAdminCommunity({
    searchQuery,
    filterCountry,
    filterMotorcycle,
    page,
  });

  const formatPhone = (phone: string) => phone.replace(/[^0-9+]/g, "");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "مجتمع بايكرز" : "Bikers Community"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRTL ? `${total} عضو مسجل` : `${total} registered members`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={isRTL ? "بحث بالاسم، البريد، الهاتف..." : "Search by name, email, phone..."}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            />
          </div>
          <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={isRTL ? "الدولة" : "Country"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? "كل الدول" : "All Countries"}</SelectItem>
              {(countries || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMotorcycle} onValueChange={(v) => { setFilterMotorcycle(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={isRTL ? "دراجة نارية" : "Motorcycle"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
              <SelectItem value="yes">{isRTL ? "يمتلك" : "Has Motorcycle"}</SelectItem>
              <SelectItem value="no">{isRTL ? "لا يمتلك" : "No Motorcycle"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? "الاسم" : "Full Name"}</TableHead>
                <TableHead>{isRTL ? "الهاتف" : "Phone"}</TableHead>
                <TableHead>{isRTL ? "البريد" : "Email"}</TableHead>
                <TableHead>{isRTL ? "الدولة" : "Country"}</TableHead>
                <TableHead>{isRTL ? "المدينة" : "City"}</TableHead>
                <TableHead>{isRTL ? "دراجة" : "Motorcycle"}</TableHead>
                <TableHead>{isRTL ? "شراء؟" : "Considering?"}</TableHead>
                <TableHead>{isRTL ? "تاريخ الانضمام" : "Join Date"}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {isRTL ? "جاري التحميل..." : "Loading..."}
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {isRTL ? "لا توجد نتائج" : "No results found"}
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium whitespace-nowrap">{m.full_name}</TableCell>
                    <TableCell dir="ltr" className="whitespace-nowrap">{m.phone}</TableCell>
                    <TableCell className="whitespace-nowrap">{m.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{m.country}</TableCell>
                    <TableCell className="whitespace-nowrap">{m.city}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.has_motorcycle
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {m.has_motorcycle ? (isRTL ? "نعم" : "Yes") : (isRTL ? "لا" : "No")}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.considering_purchase
                        ? m.considering_purchase === "yes"
                          ? (isRTL ? "نعم" : "Yes")
                          : m.considering_purchase === "no"
                            ? (isRTL ? "لا" : "No")
                            : (isRTL ? "ربما" : "Maybe")
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                      {format(new Date(m.created_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://wa.me/${formatPhone(m.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                          <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
                          <span className="hidden sm:inline">{isRTL ? "واتساب" : "WhatsApp"}</span>
                        </Button>
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? `صفحة ${page + 1} من ${totalPages}`
                : `Page ${page + 1} of ${totalPages}`}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCommunity;
