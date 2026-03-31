import { Link } from "react-router-dom";
import logo from "@/assets/rxsense-logo.png";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <img src={logo} alt="RxSense" className="h-8" />
          <p className="text-sm text-muted-foreground">
            AI-powered medication safety for healthcare providers.
          </p>
        </div>
        <div>
          <h4 className="font-display font-semibold text-sm mb-3">Product</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <Link to="/#features" className="block hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="block hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/api-docs" className="block hover:text-foreground transition-colors">API Docs</Link>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-sm mb-3">Company</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <span className="block">About</span>
            <span className="block">Contact</span>
            <span className="block">Careers</span>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-sm mb-3">Legal</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <span className="block">Privacy Policy</span>
            <span className="block">Terms of Service</span>
            <span className="block">HIPAA Compliance</span>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-4">
        <p className="container text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} RxSense. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
