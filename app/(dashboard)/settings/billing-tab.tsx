"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, Zap } from "lucide-react";
import type { BusinessProfile } from "./settings-actions";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    description: "Perfect for solo operators",
    features: [
      "1 user",
      "Up to 50 customers",
      "50 jobs per month",
      "Basic SMS reminders",
      "Invoice PDF generation",
      "Email support",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    description: "For growing businesses",
    features: [
      "1 user",
      "Unlimited customers",
      "Unlimited jobs",
      "Full SMS automation",
      "Stripe payment links",
      "Priority support",
    ],
    highlight: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: 149,
    description: "Scale with your team",
    features: [
      "Up to 3 users",
      "Everything in Pro",
      "Google Calendar sync",
      "Custom branding",
      "Advanced reporting",
      "Dedicated onboarding",
    ],
    highlight: false,
  },
] as const;

interface BillingTabProps {
  business: BusinessProfile;
}

export function BillingTab({ business }: BillingTabProps) {
  const status = business.subscription_status;
  const isActive = status === "active";
  const isTrial = status === "trial";
  const isPastDue = status === "past_due";

  // Days remaining in trial (14 days from account creation)
  const trialDaysLeft = (() => {
    const created = new Date(business.created_at);
    const trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
    const diff = Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, diff);
  })();

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Current status banner */}
      <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">
            Current Plan:{" "}
            <span className="capitalize">
              {isTrial ? "Free Trial" : isActive ? "Pro" : isPastDue ? "Past Due" : status}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTrial && trialDaysLeft > 0
              ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining in your trial`
              : isTrial
              ? "Your trial has expired"
              : isActive
              ? "Your subscription is active"
              : isPastDue
              ? "Payment failed — please update your payment method"
              : ""}
          </p>
        </div>
        <Badge
          variant={isActive ? "default" : isPastDue ? "destructive" : "secondary"}
          className="capitalize"
        >
          {status.replace("_", " ")}
        </Badge>
      </div>

      {/* Plan cards */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Choose a Plan</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={plan.highlight ? "border-primary shadow-md" : undefined}
            >
              <CardHeader className="pb-3">
                {plan.highlight && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                    <Zap className="w-3.5 h-3.5" />
                    Most Popular
                  </div>
                )}
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
                <p className="mt-2">
                  <span className="text-2xl font-bold">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  disabled
                >
                  {isActive ? "Current Plan" : "Upgrade — Coming Soon"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Manage subscription */}
      {business.stripe_customer_id && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Manage Subscription</h3>
          <p className="text-xs text-muted-foreground">
            Update payment method, view invoices, or cancel your subscription.
          </p>
          <Button variant="outline" size="sm" disabled>
            Open Stripe Customer Portal — Coming Soon
          </Button>
        </div>
      )}
    </div>
  );
}
