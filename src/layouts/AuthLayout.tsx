import { Outlet } from "react-router-dom";
import { PenLine, ShieldCheck, Zap, TrendingUp, FileCheck2 } from "lucide-react";

const FEATURES = [
  { icon: Zap, label: "Claim assignments in seconds" },
  { icon: FileCheck2, label: "Streamlined submission workflow" },
  { icon: TrendingUp, label: "Track earnings in real time" },
];

export function AuthLayout() {
  return (
    <div className="iw-auth">
      <aside className="iw-auth__aside">
        <div className="iw-auth__brand">
          <span
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.24)",
            }}
          >
            <PenLine size={19} strokeWidth={2.4} />
          </span>
          iWriter
        </div>

        <div>
          <h1 className="iw-auth__headline">The premium marketplace for academic writing talent.</h1>
          <p className="iw-auth__sub">
            Browse verified assignments, submit quality work, and get paid. iWriter gives writers and
            administrators one elegant workspace built for speed and trust.
          </p>

          <div className="iw-auth__features">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div className="iw-auth__feature" key={label}>
                <span className="iw-auth__feature-icon">
                  <Icon size={15} strokeWidth={2.3} />
                </span>
                {label}
              </div>
            ))}
          </div>

          <div className="iw-auth__stats">
            <div>
              <div className="iw-auth__stat-value">100%</div>
              <div className="iw-auth__stat-label">Secure payments</div>
            </div>
            <div>
              <div className="iw-auth__stat-value">24/7</div>
              <div className="iw-auth__stat-label">Assignment access</div>
            </div>
            <div>
              <div className="iw-auth__stat-value">
                <ShieldCheck size={26} style={{ display: "inline" }} />
              </div>
              <div className="iw-auth__stat-label">RLS-secured data</div>
            </div>
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5 }}>
          © {new Date().getFullYear()} iWriter. Academic excellence, delivered.
        </p>
      </aside>

      <main className="iw-auth__main">
        <div className="iw-auth__panel">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
