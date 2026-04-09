"use client";

// Renders time-sensitive greeting client-side so it reflects the user's
// local time rather than the server's timezone.
export function Greeting({ businessName }: { businessName: string }) {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        {salutation}, {businessName}
      </h1>
      <p className="text-muted-foreground mt-0.5">{today}</p>
    </div>
  );
}
