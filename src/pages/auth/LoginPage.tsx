import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import { Alert, Button, Field, Input } from "../../components/common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error, profile } = await signIn(values.email.trim(), values.password);
    if (error) {
      setFormError(error);
      return;
    }
    if (!profile) {
      setFormError(
        "Your credentials were accepted, but iWriter could not load the matching profile and role. Verify the Supabase profile UUID and profile access policies, then try again.",
      );
      return;
    }
    if (profile?.status === "suspended") {
      setFormError("Your account has been suspended. Please contact an administrator.");
      return;
    }
    if (profile.status !== "active") {
      setFormError("Your account is inactive. Please contact an administrator.");
      return;
    }
    toast.success("Welcome back", "You're signed in to iWriter.");
    const home = profile.role === "admin" ? "/admin" : "/writer";
    const fromMatchesRole = from === home || from?.startsWith(`${home}/`);
    const destination = fromMatchesRole ? from! : home;
    navigate(destination, { replace: true });
  };

  return (
    <div>
      <h1 className="iw-auth__title">Sign in to iWriter</h1>
      <p className="iw-auth__desc">Welcome back. Enter your credentials to continue.</p>

      <form className="iw-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert tone="danger" icon={AlertCircle}>
            {formError}
          </Alert>
        )}

        <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={Mail}
            invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          error={errors.password?.message}
          action={
            <Link to="/forgot-password" style={{ fontSize: 12.5, fontWeight: 500 }}>
              Forgot password?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={Lock}
            invalid={Boolean(errors.password)}
            {...register("password")}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" block loading={isSubmitting} iconRight={ArrowRight}>
          Sign in
        </Button>
      </form>

      <p className="iw-auth__foot">
        New to iWriter?{" "}
        <Link to="/register" style={{ fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
