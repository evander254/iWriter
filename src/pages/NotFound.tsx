import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Button, EmptyState } from "../components/common";

export function NotFoundPage() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh", padding: 24 }}>
      <div className="iw-card iw-card--pad-lg" style={{ maxWidth: 520, width: "100%" }}>
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="The page you're looking for doesn't exist, was moved, or you don't have access to it."
          action={
            <Link to="/">
              <Button variant="primary" icon={Home}>
                Back to dashboard
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh", padding: 24 }}>
      <div className="iw-card iw-card--pad-lg" style={{ maxWidth: 520, width: "100%" }}>
        <EmptyState
          icon={Compass}
          title="Access denied"
          description="Your account doesn't have permission to view this area."
          action={
            <Link to="/">
              <Button variant="primary" icon={Home}>
                Back to dashboard
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
