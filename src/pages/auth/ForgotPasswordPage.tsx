import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { Alert, Button, Field, Input } from "../../components/common";
import { useAuth } from "../../contexts/AuthContext";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error } = await requestPasswordReset(values.email.trim());
    if (error) {
      setFormError(error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div>
        <div className="iw-empty__icon" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={28} strokeWidth={2} />
        </div>
        <h1 className="iw-auth__title">Check your email</h1>
        <p className="iw-auth__desc">
          If an iWriter account exists for that address, we've sent a secure link to reset your password.
        </p>
        <div className="iw-mt-6">
          <Link to="/login">
            <Button variant="outline" block size="lg" icon={ArrowLeft}>
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="iw-auth__title">Reset your password</h1>
      <p className="iw-auth__desc">Enter your account email and we'll send you a reset link.</p>

      <form className="iw-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert tone="danger" icon={AlertCircle}>
            {formError}
          </Alert>
        )}

        <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" icon={Mail} invalid={Boolean(errors.email)} {...register("email")} />
        </Field>

        <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <p className="iw-auth__foot">
        <Link to="/login" style={{ fontWeight: 600 }}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
