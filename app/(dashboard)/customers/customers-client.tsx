"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  ChevronRight,
  ChevronLeft,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerForm } from "./customer-form";
import { addCustomerAction } from "./customer-actions";

const PAGE_SIZE = 25;

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  tags: string[] | null;
  created_at: string;
  job_count: number;
  total_revenue: number;
  last_job_date: string | null;
};

type FilterType = "all" | "residential" | "commercial";

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);
  return debounced;
}

interface CustomersClientProps {
  customers: CustomerRow[];
}

export function CustomersClient({ customers }: CustomersClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<"name" | "newest" | "jobs">("name");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 250);

  const filtered = useMemo(() => {
    let rows = customers;

    // Tag filter
    if (filter !== "all") {
      rows = rows.filter((c) => c.tags?.includes(filter));
    }

    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q)
      );
    }

    // Sort
    const copy = [...rows];
    if (sort === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "newest") {
      copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sort === "jobs") {
      copy.sort((a, b) => b.job_count - a.job_count);
    }

    return copy;
  }, [customers, filter, debouncedSearch, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const goToPage = useCallback(
    (p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1))),
    [totalPages]
  );

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { setPage(0); }, [filter, debouncedSearch, sort]);

  const handleSuccess = () => {
    setDialogOpen(false);
    startTransition(() => router.refresh());
  };

  const filterLabels: Record<FilterType, string> = {
    all: "All",
    residential: "Residential",
    commercial: "Commercial",
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search name, phone, email…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter pills */}
          <div className="flex gap-1">
            {(["all", "residential", "commercial"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="name">Name A–Z</option>
            <option value="newest">Newest First</option>
            <option value="jobs">Most Jobs</option>
          </select>

          {/* Add Customer */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Customer</DialogTitle>
              </DialogHeader>
              <CustomerForm
                action={addCustomerAction}
                submitLabel="Add Customer"
                onSuccess={handleSuccess}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-xl border border-dashed">
          <UserPlus className="w-10 h-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-muted-foreground">No customers found</p>
            <p className="text-sm text-muted-foreground/70 mt-0.5">
              {search || filter !== "all"
                ? "Try adjusting your search or filter"
                : "Add your first customer to get started"}
            </p>
          </div>
          {!search && filter === "all" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Customer
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">City</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Jobs</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Revenue</TableHead>
                  <TableHead className="hidden xl:table-cell">Last Job</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {c.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 capitalize"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          className="hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[180px]">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.city ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-sm">
                      {c.job_count}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm font-medium">
                      {c.total_revenue > 0 ? fmt(c.total_revenue) : "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {c.last_job_date
                        ? new Date(c.last_job_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length} customers
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
