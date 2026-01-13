"use client";

import { motion } from "framer-motion";
import { Check, Zap, User, CreditCard, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  current: boolean;
  recommended?: boolean;
}

interface MobileSettingsProps {
  email: string;
  name: string;
  subscriptionStatus: string;
  plans: Plan[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export function MobileSettings({ email, name, subscriptionStatus, plans }: MobileSettingsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account
        </p>
      </motion.div>

      {/* Account Section */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Account
        </h2>
        <Card>
          <CardContent className="p-0 divide-y">
            <div className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-muted">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Current Plan</p>
                <Badge
                  variant={subscriptionStatus === "free" ? "secondary" : "default"}
                  className="capitalize mt-1"
                >
                  {subscriptionStatus}
                </Badge>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plans Section */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Subscription Plans
        </h2>
        <div className="space-y-3">
          {plans.map((plan) => (
            <MobilePlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MobilePlanCard({ plan }: { plan: Plan }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Card className={plan.recommended ? "border-primary" : ""}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                {plan.recommended && (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Zap className="h-3 w-3" />
                    Best
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                )}
              </div>
            </div>
            {plan.current && (
              <Badge variant="outline" className="shrink-0">Current</Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>

          {/* Features */}
          <ul className="space-y-2 mb-4">
            {plan.features.slice(0, 4).map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
            {plan.features.length > 4 && (
              <li className="text-sm text-muted-foreground pl-6">
                +{plan.features.length - 4} more features
              </li>
            )}
          </ul>

          {/* Action */}
          {plan.current ? (
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
          ) : plan.name === "Enterprise" ? (
            <Button variant="outline" className="w-full">
              Contact Sales
            </Button>
          ) : (
            <Button className="w-full">
              Upgrade to {plan.name}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
