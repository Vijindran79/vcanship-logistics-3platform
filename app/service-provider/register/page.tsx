// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { RegisterForm } from "../../../components/service-provider/RegisterForm.tsx";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Provider Registration",
  description: "Join our network of trusted logistics partners.",
};

export default function ServiceProviderRegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-8">
      <div className="card w-full max-w-4xl">
        <div className="card-header" style={{padding: '1.5rem 1.5rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem'}}>
          <h3 className="text-2xl" style={{fontSize: '1.5rem', fontWeight: '600'}}>
            Register as a Service Provider
          </h3>
          <p className="subtitle" style={{margin: '0.5rem 0 1rem'}}>
            Join our network of logistics partners. Fill out the form below to
            get started.
          </p>
        </div>
        <div className="card-content" style={{padding: '0 1.5rem 1.5rem'}}>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}