import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] px-6 py-10 text-[#F1F5F9]">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-sm text-[#0EA5E9] hover:underline mb-8">
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#8A98AC] mb-8">Last updated: June 2026</p>

        <div className="flex flex-col gap-8 text-sm text-[#94A3B8] leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-[#F1F5F9] mb-2">What We Collect</h2>
            <p>
              PaddleIQ collects only the data you provide: your email address and name at sign-up,
              and the training sessions, personal records, and team interactions you log inside the
              app. We do not collect location data, device identifiers, or advertising identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#F1F5F9] mb-2">How We Use Your Data</h2>
            <p>
              Your data is used solely to provide the PaddleIQ service: displaying your training
              history, computing analytics, running the coach engine, and enabling team features.
              We do not sell your data or share it with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#F1F5F9] mb-2">Data Storage</h2>
            <p>
              Training sessions are stored locally on your device (IndexedDB) and synchronised to
              our database (Supabase / PostgreSQL) when you are online. Authentication is handled by
              Supabase Auth. Data is stored in the US.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#F1F5F9] mb-2">Data Deletion</h2>
            <p>
              You can delete your account at any time from your Profile page. This permanently
              removes your profile and all associated training data from our servers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#F1F5F9] mb-2">Cookies</h2>
            <p>
              We use session cookies solely for authentication (managed by Supabase). We do not use
              advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#F1F5F9] mb-2">Contact</h2>
            <p>
              Questions? Email us at{" "}
              <a href="mailto:privacy@paddleiq.app" className="text-[#0EA5E9] hover:underline">
                privacy@paddleiq.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
