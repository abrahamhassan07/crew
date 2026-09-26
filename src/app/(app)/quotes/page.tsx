import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

export default function QuotesPage() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="px-6 py-8 border-b border-line bg-card-bg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink-primary">Quotes</h1>
            <p className="text-sm text-ink-secondary mt-1">
              Create and manage quotes for your clients.
            </p>
          </div>
          <Link href="/quotes/new">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New quote
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-6 py-16">
        <div className="max-w-7xl mx-auto text-center">
          <div className="bg-info-bg border border-info-fg/20 rounded-lg p-8 inline-block">
            <h2 className="text-lg font-bold text-info-fg mb-2">
              Coming Soon
            </h2>
            <p className="text-sm text-info-fg/80">
              Quotes feature is in development.
              <br />
              Database schema and backend logic to follow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
