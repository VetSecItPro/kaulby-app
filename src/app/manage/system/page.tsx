import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Database, Zap, Mail, CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const services = [
  {
    title: "Database",
    description: "PostgreSQL (Neon) — table sizes, row counts, connections, indexes",
    href: "/manage/system/database",
    icon: Database,
    color: "text-blue-500",
    borderColor: "border-blue-500/30",
  },
  {
    title: "AI Service",
    description: "OpenRouter — costs, tokens, latency, cache efficiency, model breakdown",
    href: "/manage/system/ai",
    icon: Zap,
    color: "text-amber-500",
    borderColor: "border-amber-500/30",
  },
  {
    title: "Email",
    description: "Resend — send volume, open/click rates, domain health, engagement",
    href: "/manage/system/email",
    icon: Mail,
    color: "text-green-500",
    borderColor: "border-green-500/30",
  },
  {
    title: "Payments",
    description: "Polar — MRR/ARR, subscriptions, transactions, founding members",
    href: "/manage/system/payments",
    icon: CreditCard,
    color: "text-purple-500",
    borderColor: "border-purple-500/30",
  },
];

export default async function SystemHubPage() {
  // Auth + admin check handled by /manage/layout.tsx
  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground">Service dashboards and infrastructure monitoring</p>
          </div>
        </div>
        <Badge variant="outline" className="border-green-500 text-green-500">
          All Systems
        </Badge>
      </div>

      {/* Service Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <Link key={service.href} href={service.href} className="block">
            <Card className={`transition-all hover:border-primary hover:shadow-md cursor-pointer ${service.borderColor}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <service.icon className={`h-5 w-5 ${service.color}`} />
                    {service.title}
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
