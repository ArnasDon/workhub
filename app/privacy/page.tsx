import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

/** Plain-language privacy note. Operators: edit the bracketed parts for your deployment. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <article className="prose prose-sm max-w-none dark:prose-invert">
        <h1>Privacy</h1>
        <p>WorkHub is a personal work tracker. This note explains what it stores and who can see it.</p>
        <h2>What is stored</h2>
        <ul>
          <li>Your email address and a password hash, held by Supabase Auth to sign you in.</li>
          <li>Everything you type into the app: initiatives, descriptions, log entries, to-dos, links and templates. All of it is tied to your account id.</li>
          <li>Server logs with request paths and error messages, kept by the hosting provider for a limited time. They do not contain the content you write.</li>
        </ul>
        <h2>Who can see it</h2>
        <p>Only you. Every read and write is scoped to your account in the application, and the database enforces per-user row-level policies as a second layer. The operator of this deployment can access the database directly and is expected not to look at your content except to fix a fault you report.</p>
        <h2>Where it lives</h2>
        <p>The application runs on [hosting provider and region]. The database and authentication are provided by Supabase in [region].</p>
        <h2>Cookies</h2>
        <p>One session cookie set by Supabase Auth keeps you signed in. It is HttpOnly and not used for tracking. There are no analytics or advertising cookies.</p>
        <h2>Your controls</h2>
        <ul>
          <li>Export everything you own as JSON, Markdown or CSV at any time from the header menu.</li>
          <li>Delete your account and all of its data from the <Link href="/account">Account</Link> page. Deletion is immediate and cannot be undone.</li>
        </ul>
        <h2>Contact</h2>
        <p>[Operator name and contact email].</p>
        <p className="text-xs text-muted-foreground">Last updated 2026-09-22.</p>
      </article>
    </main>
  );
}
