import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Enterprise",
    price: "To be announced",
    period: "",
    desc: "For hospitals and health systems at scale.",
    features: ["Real-time interaction detection API", "EHR/EMR integration support", "Dedicated onboarding and support", "Security and compliance assistance"],
    cta: "Contact Sales",
    featured: true,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="font-display text-4xl font-bold mb-4">Enterprise Pricing</h1>
          <p className="text-muted-foreground">Single enterprise plan. Pricing will be announced soon.</p>
        </div>
        <div className="grid md:grid-cols-1 gap-6 max-w-2xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "rounded-2xl border p-8 flex flex-col",
                plan.featured
                  ? "border-secondary shadow-elevated relative gradient-hero text-primary-foreground"
                  : "border-border bg-card shadow-card"
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
              <div className="mt-4 mb-2">
                <span className="font-display text-4xl font-bold">{plan.price}</span>
                <span className={cn("text-sm ml-1", plan.featured ? "text-primary-foreground/60" : "text-muted-foreground")}>
                  {plan.period}
                </span>
              </div>
              <p className={cn("text-sm mb-6", plan.featured ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {plan.desc}
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={cn("h-4 w-4 mt-0.5 shrink-0", plan.featured ? "text-secondary" : "text-success")} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={cn(
                  "w-full",
                  plan.featured
                    ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground border-0"
                    : ""
                )}
                variant={plan.featured ? "default" : "outline"}
                asChild
              >
                <Link to="/signup">{plan.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
