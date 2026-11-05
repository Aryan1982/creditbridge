"use client";

import { useEffect } from "react";
import { Button, ButtonLink, ErrorState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page max-w-xl! py-20">
      <ErrorState
        title="This page hit a problem"
        message="Something unexpected went wrong while showing this page. Try again, or start a new check."
        action={
          <div className="flex gap-3">
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/check" variant="tinted">
              Start a new check
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
