"use client";

import { useState, useActionState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Users, UserPlus, Mail, Shield, ShieldOff, Trash2, Loader2,
  ChevronDown, Crown, Settings2, Wrench, Eye,
} from "lucide-react";
import {
  inviteUserAction,
  changeRoleAction,
  suspendUserAction,
  reinstateUserAction,
  removeUserAction,
  revokeInvitationAction,
  type TeamMember,
  type PendingInvite,
  type TeamData,
} from "./actions";
import { INVITABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/permissions-shared";

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  owner:      "bg-purple-100 text-purple-800",
  admin:      "bg-blue-100 text-blue-800",
  technician: "bg-orange-100 text-orange-800",
  viewer:     "bg-gray-100 text-gray-700",
};

const ROLE_ICONS: Record<Role, React.FC<{ className?: string }>> = {
  owner:      Crown,
  admin:      Settings2,
  technician: Wrench,
  viewer:     Eye,
};

function RoleBadge({ role }: { role: Role }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
      <Icon className="w-3 h-3" />
      {ROLE_LABELS[role]}
    </span>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(inviteUserAction, { error: null, success: false });
  const [role, setRole] = useState<Role>("technician");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    fd.set("role", role);
    e.preventDefault();
    formAction(fd);
  };

  if (state.success && open) {
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email with a link to join your business.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="tech@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    <div>
                      <p className="font-medium">{ROLE_LABELS[r]}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canManage,
  currentUserId,
  currentUserRole,
  onRefresh,
}: {
  member: TeamMember;
  canManage: boolean;
  currentUserId: string;
  currentUserRole: Role;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [roleChanging, setRoleChanging] = useState(false);

  const initials = member.fullName
    ? member.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : member.email.slice(0, 2).toUpperCase();

  const canEditRole =
    canManage &&
    !member.isCurrentUser &&
    // Admin cannot change owner's role
    !(currentUserRole === "admin" && member.role === "owner");

  const canSuspend =
    canManage &&
    !member.isCurrentUser &&
    member.status === "active" &&
    member.role !== "owner";

  const canReinstate =
    canManage &&
    !member.isCurrentUser &&
    member.status === "suspended";

  const canRemove =
    canManage &&
    !member.isCurrentUser &&
    member.role !== "owner";

  const act = async (action: (prev: { error: string | null; success: boolean }, fd: FormData) => Promise<{ error: string | null; success: boolean }>, fd: FormData, successMsg: string) => {
    startTransition(async () => {
      const result = await action({ error: null, success: false }, fd);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: successMsg });
        onRefresh();
      }
    });
  };

  const changeRole = async (newRole: Role) => {
    setRoleChanging(true);
    const fd = new FormData();
    fd.set("userId", member.userId);
    fd.set("role", newRole);
    await act(changeRoleAction, fd, `Role changed to ${ROLE_LABELS[newRole]}`);
    setRoleChanging(false);
  };

  const suspend = () => {
    const fd = new FormData();
    fd.set("userId", member.userId);
    act(suspendUserAction, fd, "User suspended");
  };

  const reinstate = () => {
    const fd = new FormData();
    fd.set("userId", member.userId);
    act(reinstateUserAction, fd, "User reinstated");
  };

  const remove = () => {
    if (!confirm(`Remove ${member.email} from your team?`)) return;
    const fd = new FormData();
    fd.set("userId", member.userId);
    act(removeUserAction, fd, "Member removed");
  };

  const lastSeen = member.lastLoginAt
    ? new Date(member.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Never";

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${member.status === "suspended" ? "opacity-60 bg-muted/20" : ""}`}>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium truncate">{member.fullName || member.email}</span>
          {member.fullName && <span className="text-xs text-muted-foreground truncate">{member.email}</span>}
          {member.isCurrentUser && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>
          )}
          {member.status === "suspended" && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Suspended</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Last login: {lastSeen}</p>
      </div>

      {/* Role */}
      <div className="shrink-0">
        {canEditRole ? (
          <Select value={member.role} onValueChange={(v) => changeRole(v as Role)} disabled={roleChanging}>
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted px-2 gap-1 w-auto">
              <RoleBadge role={member.role} />
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </SelectTrigger>
            <SelectContent align="end">
              {(currentUserRole === "owner" ? (["owner", ...INVITABLE_ROLES] as Role[]) : INVITABLE_ROLES).map((r) => (
                <SelectItem key={r} value={r}>
                  <span className="flex items-center gap-2">
                    <RoleBadge role={r} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <RoleBadge role={member.role} />
        )}
      </div>

      {/* Actions */}
      {canManage && !member.isCurrentUser && member.role !== "owner" && (
        <div className="flex items-center gap-1 shrink-0">
          {canSuspend && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={suspend} title="Suspend">
              <ShieldOff className="w-3.5 h-3.5" />
            </Button>
          )}
          {canReinstate && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600" onClick={reinstate} title="Reinstate">
              <Shield className="w-3.5 h-3.5" />
            </Button>
          )}
          {canRemove && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={remove} title="Remove">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Invite row ────────────────────────────────────────────────────────────────

function InviteRow({
  invite,
  canManage,
  onRefresh,
}: {
  invite: PendingInvite;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const revoke = () => {
    if (!confirm(`Revoke invitation for ${invite.email}?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("invitationId", invite.id);
      const result = await revokeInvitationAction({ error: null, success: false }, fd);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Invitation revoked" });
        onRefresh();
      }
    });
  };

  const expiresIn = Math.max(0, Math.round((new Date(invite.expiresAt).getTime() - Date.now()) / 3_600_000));

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed opacity-75">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm truncate">{invite.email}</span>
        <p className="text-xs text-muted-foreground mt-0.5">
          Invited · expires in {expiresIn}h
        </p>
      </div>

      <RoleBadge role={invite.role} />

      {canManage && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={revoke} title="Revoke">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface TeamClientProps {
  initialData:     TeamData;
  currentUserId:   string;
  currentUserRole: Role;
}

export function TeamClient({ initialData, currentUserId, currentUserRole }: TeamClientProps) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [data, setData] = useOptimistic(initialData);

  const canManage = ["owner", "admin"].includes(currentUserRole);
  const atSeatLimit = data.seatUsed >= data.seatLimit;

  const refresh = () => router.refresh();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Members
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who has access to {data.businessName || "your business"}.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setShowInvite(true)}
            disabled={atSeatLimit}
            title={atSeatLimit ? `Seat limit reached (${data.seatLimit})` : undefined}
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Invite
          </Button>
        )}
      </div>

      {/* Seat counter */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${atSeatLimit ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min(100, (data.seatUsed / data.seatLimit) * 100)}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${atSeatLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {data.seatUsed} / {data.seatLimit} seats used
        </span>
      </div>

      {/* Members list */}
      <div className="space-y-2">
        {data.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            canManage={canManage}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onRefresh={refresh}
          />
        ))}

        {data.invites.map((inv) => (
          <InviteRow
            key={inv.id}
            invite={inv}
            canManage={canManage}
            onRefresh={refresh}
          />
        ))}

        {data.members.length === 0 && data.invites.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No team members yet. Invite someone to get started.
          </p>
        )}
      </div>

      {/* Role legend */}
      <div className="rounded-xl border p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role permissions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["owner", "admin", "technician", "viewer"] as Role[]).map((r) => (
            <div key={r} className="flex items-start gap-2">
              <RoleBadge role={r} />
              <p className="text-xs text-muted-foreground leading-4">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite modal */}
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={() => {
          setShowInvite(false);
          refresh();
        }}
      />

      {/* Suppress unused setData warning */}
      {void setData}
    </div>
  );
}
