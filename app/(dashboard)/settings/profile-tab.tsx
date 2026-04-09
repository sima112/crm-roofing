"use client";

import { useState, useRef, useTransition } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { saveBusinessProfileAction, type BusinessProfile } from "./settings-actions";
import { createClient } from "@/lib/supabase/client";
import { Upload, Loader2, Building2 } from "lucide-react";

const TRADE_OPTIONS = [
  { value: "roofing", label: "Roofing" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "landscaping", label: "Landscaping" },
  { value: "general", label: "General Contractor" },
];

interface ProfileTabProps {
  business: BusinessProfile;
}

export function ProfileTab({ business }: ProfileTabProps) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [name, setName] = useState(business.name);
  const [trade, setTrade] = useState(business.trade);
  const [phone, setPhone] = useState(business.phone ?? "");
  const [email, setEmail] = useState(business.email ?? "");
  const [address, setAddress] = useState(business.address ?? "");
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [nameError, setNameError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_MB = 2;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max ${MAX_MB} MB`, variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${business.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("business-logos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("business-logos")
        .getPublicUrl(path);

      // Bust cache by appending timestamp
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      setLogoUrl(bustedUrl);

      const { error: saveError } = await saveBusinessProfileAction({ logo_url: bustedUrl });
      if (saveError) throw new Error(saveError);

      toast({ title: "Logo updated" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = () => {
    setNameError("");
    if (!name.trim()) {
      setNameError("Business name is required");
      return;
    }

    setSaving(true);
    startTransition(async () => {
      const { error } = await saveBusinessProfileAction({
        name: name.trim(),
        trade,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      });
      setSaving(false);
      if (error) {
        toast({ title: "Save failed", description: error, variant: "destructive" });
      } else {
        toast({ title: "Profile saved" });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-xl">
      {/* Logo */}
      <div className="space-y-3">
        <Label>Business Logo</Label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Business logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 mr-1.5" />
              )}
              {uploadingLogo ? "Uploading…" : "Upload Logo"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 2 MB</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleLogoChange}
        />
      </div>

      {/* Business name */}
      <div className="space-y-1.5">
        <Label htmlFor="biz-name">Business Name</Label>
        <Input
          id="biz-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          placeholder="Lone Star Roofing Co."
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>

      {/* Trade */}
      <div className="space-y-1.5">
        <Label>Trade</Label>
        <Select value={trade} onValueChange={setTrade}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRADE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-phone">Phone</Label>
          <Input
            id="biz-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (512) 555-0100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-email">Email</Label>
          <Input
            id="biz-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="info@yourcompany.com"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="biz-address">Address</Label>
        <Input
          id="biz-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Austin, TX 78701"
        />
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Profile"}
      </Button>
    </div>
  );
}
