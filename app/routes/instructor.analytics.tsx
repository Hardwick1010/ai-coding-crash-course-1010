import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import {
  getInstructorRevenue,
  PLATFORM_FEE_PERCENT,
} from "~/services/analyticsService";
import { UserRole } from "~/db/schema";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";

// ─── Instructor Analytics ───
// What the instructor's courses have earned: gross revenue, Cadence's platform
// fee, and the instructor's net earnings. All time for now; the figures and the
// fee split come from analyticsService.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Cents to "$1,234.56". Zero is "$0.00" — a money figure, never "Free". */
function formatUsd(cents: number) {
  return usd.format(cents / 100);
}

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "Revenue and earnings for your courses" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view your analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access this page.", {
      status: 403,
    });
  }

  return { revenue: getInstructorRevenue(currentUserId) };
}

function MoneyCard({
  label,
  amount,
  helper,
  emphasised = false,
}: {
  label: string;
  amount: string;
  helper: string;
  emphasised?: boolean;
}) {
  return (
    <Card className={cn(emphasised && "border-primary bg-primary/5")}>
      <CardContent>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 text-3xl font-bold tabular-nums",
            emphasised && "text-primary"
          )}
        >
          {amount}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-3 h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { revenue } = loaderData;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and earnings for your courses.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <MoneyCard
          label="Gross revenue"
          amount={formatUsd(revenue.grossRevenue)}
          helper={`What students paid, across ${revenue.purchaseCount} ${
            revenue.purchaseCount === 1 ? "purchase" : "purchases"
          }.`}
        />
        <MoneyCard
          label={`Platform fee (${PLATFORM_FEE_PERCENT}%)`}
          amount={formatUsd(revenue.platformFee)}
          helper="Cadence's cut. Already deducted from your earnings."
        />
        <MoneyCard
          label="Your net earnings"
          amount={formatUsd(revenue.netEarnings)}
          helper="What you keep — gross revenue minus the platform fee."
          emphasised
        />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading your analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
