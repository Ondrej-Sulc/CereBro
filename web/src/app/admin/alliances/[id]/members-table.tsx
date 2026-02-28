"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCircle, ShieldAlert, Loader2 } from "lucide-react";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import axios from "axios";
import { computePaginationWindow } from "@/lib/pagination";
import { useRef } from "react";

interface Member {
  id: string;
  avatar: string | null;
  ingameName: string;
  summonerPrestige: number | null;
  championPrestige: number | null;
  isOfficer: boolean;
  battlegroup: number | null;
  timezone: string | null;
  createdAt: string;
  _count: { roster: number };
}

interface MembersTableProps {
  allianceId: string;
}

export function MembersTable({ allianceId }: MembersTableProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  const requestIdRef = useRef(0);

  const fetchMembers = useCallback(async (pageNum: number) => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/admin/alliances/${allianceId}/members`, {
        params: { page: pageNum, limit }
      });
      if (currentRequestId === requestIdRef.current) {
        setMembers(data.members);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
        setPage(data.currentPage);
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        console.error("Error fetching members:", error);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [allianceId]);

  useEffect(() => {
    fetchMembers(1);
  }, [fetchMembers]);

  const { windowStart, windowEnd } = computePaginationWindow(page, totalPages);

  if (loading && members.length === 0) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Prestige (S/C)</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>BG</TableHead>
              <TableHead>Roster</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead className="text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar || ""} />
                      <AvatarFallback><UserCircle className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <span>{member.ingameName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs">
                      <span className="font-medium text-sm">S: {member.summonerPrestige?.toLocaleString() || "-"}</span>
                      <span className="text-muted-foreground">C: {member.championPrestige?.toLocaleString() || "-"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {member.isOfficer ? (
                     <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                          <ShieldAlert className="mr-1 h-3 w-3" /> Officer
                     </Badge>
                  ) : (
                     <Badge variant="outline" className="text-slate-500">Member</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {member.battlegroup ? (
                     <span className="text-sm font-medium">BG {member.battlegroup}</span>
                  ) : (
                     <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-xs">
                      {member._count.roster}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {member.timezone || "Not set"}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
           <p className="text-sm text-muted-foreground">
             Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} results
           </p>
           <Pagination className="w-auto mx-0">
             <PaginationContent>
               <PaginationItem>
                 <PaginationPrevious 
                   href="#"
                   onClick={(e) => { e.preventDefault(); page > 1 && fetchMembers(page - 1) }}
                   className={page <= 1 ? "pointer-events-none opacity-50 cursor-not-allowed" : "cursor-pointer"}
                 />
               </PaginationItem>
               
               {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => {
                 const pageNum = windowStart + i;
                 return (
                   <PaginationItem key={pageNum}>
                     <PaginationLink 
                       href="#"
                       onClick={(e) => { e.preventDefault(); fetchMembers(pageNum) }}
                       isActive={page === pageNum}
                       className="cursor-pointer"
                     >
                       {pageNum}
                     </PaginationLink>
                   </PaginationItem>
                 );
               })}

               <PaginationItem>
                 <PaginationNext 
                   href="#"
                   onClick={(e) => { e.preventDefault(); page < totalPages && fetchMembers(page + 1) }}
                   className={page >= totalPages ? "pointer-events-none opacity-50 cursor-not-allowed" : "cursor-pointer"}
                 />
               </PaginationItem>
             </PaginationContent>
           </Pagination>
        </div>
      )}
    </div>
  );
}
