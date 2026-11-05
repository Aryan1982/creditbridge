import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-page max-w-xl! py-24 text-center">
      <h1 className="large-title">Page not found</h1>
      <p className="mt-3 text-[17px] text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <ButtonLink href="/" size="lg" className="mt-8">
        Go home
      </ButtonLink>
    </div>
  );
}
