"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { changePasswordAction, deleteAccountAction } from "./settings-actions";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";

interface AccountTabProps {
  email: string;
}

export function AccountTab({ email }: AccountTabProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // Password form
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handlePasswordChange = () => {
    const errors: typeof pwErrors = {};
    if (!currentPw) errors.current = "Required";
    if (newPw.length < 10) errors.new = "Must be at least 10 characters";
    if (newPw !== confirmPw) errors.confirm = "Passwords do not match";
    if (Object.keys(errors).length) { setPwErrors(errors); return; }

    setPwErrors({});
    setPwSaving(true);
    startTransition(async () => {
      const { error } = await changePasswordAction(currentPw, newPw);
      setPwSaving(false);
      if (error) {
        if (error.toLowerCase().includes("current")) {
          setPwErrors({ current: error });
        } else {
          toast({ title: "Error", description: error, variant: "destructive" });
        }
      } else {
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        toast({ title: "Password updated successfully" });
      }
    });
  };

  const handleDeleteAccount = () => {
    setDeleting(true);
    startTransition(async () => {
      await deleteAccountAction();
      // deleteAccountAction redirects, so we won't reach here on success
      setDeleting(false);
    });
  };

  return (
    <div className="space-y-10 max-w-xl">
      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <Label>Email Address</Label>
        <div className="flex items-center gap-2">
          <Input value={email} readOnly className="bg-muted/40 text-muted-foreground" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Read-only</span>
        </div>
        <p className="text-xs text-muted-foreground">
          To change your email, contact support.
        </p>
      </div>

      <Separator />

      {/* Change password */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Change Password</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use a strong password you don&apos;t use elsewhere.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="current-pw">Current Password</Label>
          <Input
            id="current-pw"
            type="password"
            value={currentPw}
            onChange={(e) => { setCurrentPw(e.target.value); setPwErrors((p) => ({ ...p, current: undefined })); }}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {pwErrors.current && <p className="text-xs text-destructive">{pwErrors.current}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New Password</Label>
          <Input
            id="new-pw"
            type="password"
            value={newPw}
            onChange={(e) => { setNewPw(e.target.value); setPwErrors((p) => ({ ...p, new: undefined })); }}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {pwErrors.new
            ? <p className="text-xs text-destructive">{pwErrors.new}</p>
            : <PasswordStrengthMeter password={newPw} showChecklist={newPw.length > 0} />
          }
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-pw">Confirm New Password</Label>
          <Input
            id="confirm-pw"
            type="password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setPwErrors((p) => ({ ...p, confirm: undefined })); }}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {pwErrors.confirm && <p className="text-xs text-destructive">{pwErrors.confirm}</p>}
        </div>

        <Button onClick={handlePasswordChange} disabled={pwSaving} size="sm">
          {pwSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Updating…</> : "Update Password"}
        </Button>
      </div>

      <Separator />

      {/* Export data */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Export My Data</h3>
        <p className="text-xs text-muted-foreground">
          Download a copy of your customers, jobs, and invoices.
        </p>
        <Button variant="outline" size="sm" disabled>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export Data — Coming Soon
        </Button>
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Deleting your account permanently removes all data — customers, jobs, invoices — and
              cannot be undone.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Account
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(o) => { if (!deleting) setDeleteDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data. There is no undo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">
                Type <span className="font-mono font-semibold">delete my account</span> to confirm
              </Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="delete my account"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDeleteDialogOpen(false); setDeleteConfirm(""); }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteConfirm !== "delete my account" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…</> : "Delete Everything"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
