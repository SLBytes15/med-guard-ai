import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Zap, Activity, Lock, Server, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const features = [
  { icon: Shield, title: "Drug Interaction Detection", desc: "Instantly identify dangerous drug-drug interactions from our comprehensive database." },
  { icon: Activity, title: "Dosage Risk Analysis", desc: "Flag potentially harmful dosages based on clinical guidelines and patient context." },
  { icon: Zap, title: "Real-Time API", desc: "Sub-2-second response times for seamless integration into clinical workflows." },
  { icon: Lock, title: "HIPAA-Ready Security", desc: "Enterprise-grade encryption, access controls, and audit logging." },
  { icon: Server, title: "Hospital API Integration", desc: "RESTful API with API key management for EHR/EMR system integration." },
  { icon: BarChart3, title: "Usage Analytics", desc: "Track API usage, interaction trends, and system performance in real time." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="gradient-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-secondary blur-[120px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-secondary blur-[150px]" />
        </div>
        <div className="container relative py-24 md:py-36 flex flex-col items-center text-center gap-6 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-4 py-1.5 text-xs font-medium backdrop-blur-sm bg-primary-foreground/5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
            AI-Powered Medication Safety Platform
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl md:text-6xl font-bold leading-tight tracking-tight"
          >
            Prevent Medication Errors{" "}
            <span className="text-secondary">Before They Happen</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-primary-foreground/75 max-w-xl"
          >
            RxSense detects drug interactions, flags dosage risks, and provides actionable insights — via a sleek dashboard or powerful API.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground border-0 gap-2" asChild>
              <Link to="/signup">Start Free Trial <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/api-docs">View API Docs</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Everything You Need for <span className="text-gradient">Medication Safety</span>
          </h2>
          <p className="text-muted-foreground">
            A complete platform for healthcare providers to detect, prevent, and manage medication risks.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="group rounded-xl border border-border bg-card p-6 shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 py-24">
        <div className="container">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Input Medications", desc: "Enter drugs manually or send them via our REST API." },
              { step: "02", title: "Analyze Interactions", desc: "Our engine checks against known interactions and dosage risks." },
              { step: "03", title: "Get Actionable Results", desc: "Receive severity-coded alerts with clinical explanations." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="font-display text-5xl font-bold text-secondary/20 mb-2">{s.step}</div>
                <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <div className="gradient-hero rounded-2xl p-12 md:p-16 text-center text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-secondary blur-[100px]" />
          </div>
          <div className="relative">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to Enhance Patient Safety?
            </h2>
            <p className="text-primary-foreground/70 mb-8 max-w-lg mx-auto">
              Join healthcare providers using RxSense to prevent medication errors and save lives.
            </p>
            <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground border-0 gap-2" asChild>
              <Link to="/signup">Get Started Free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
