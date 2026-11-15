import { Link, isRouteErrorResponse, useSearchParams } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { requireInstructor } from "~/lib/access.server";
import {
  getInstructorRevenue,
  PLATFORM_FEE_PERCENT,
} from "~/services/analyticsService";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { cn, DAY_MS, formatMoney } from "~/lib/utils";

// ─── Instructor Analytics ───
// What the instructor's courses have earned: gross revenue, Cadence's platform
// fee, and the instructor's net earnings over a chosen date range. The figures
// and the fee split come from analyticsService.

// ─── Date range ───
// Held in the `range` search param. Missing or unknown values mean Last 30 days.
// The range starts `days` before now (inclusive); All time has no start.

const DATE_RANGES = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
] as const;

type DateRange = (typeof DATE_RANGES)[number];

const DEFAULT_RANGE = DATE_RANGES[1];

function parseRange(value: string | null): DateRange {
  return DATE_RANGES.find((range) => range.value === value) ?? DEFAULT_RANGE;
}

function rangeStart(range: DateRange, now = new Date()): Date | undefined {
  if (range.days === null) return undefined;
  return new Date(now.getTime() - range.days * DAY_MS);
}

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "Revenue and earnings for your courses" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { userId: currentUserId } = await requireInstructor(
    request,
    "Select a user from the DevUI panel to view your analytics."
  );

  const range = parseRange(new URL(request.url).searchParams.get("range"));

  return {
    range: range.value,
    revenue: getInstructorRevenue(currentUserId, rangeStart(range)),
    platformFeePercent: PLATFORM_FEE_PERCENT,
  };
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
  const { range, revenue, platformFeePercent } = loaderData;
  const [, setSearchParams] = useSearchParams();

  function handleRangeChange(value: string) {
    setSearchParams((params) => {
      params.set("range", value);
      return params;
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Revenue and earnings for your courses.
          </p>
        </div>
        <Select value={range} onValueChange={handleRangeChange}>
          <SelectTrigger className="w-40" aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <MoneyCard
          label="Gross revenue"
          amount={formatMoney(revenue.grossRevenue)}
          helper={`What students paid, across ${revenue.purchaseCount} ${
            revenue.purchaseCount === 1 ? "purchase" : "purchases"
          }.`}
        />
        <MoneyCard
          label={`Platform fee (${platformFeePercent}%)`}
          amount={formatMoney(revenue.platformFee)}
          helper="Cadence's cut. Already deducted from your earnings."
        />
        <MoneyCard
          label="Your net earnings"
          amount={formatMoney(revenue.netEarnings)}
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
