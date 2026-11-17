import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowRight, CheckCircle2, Lock, Mail, User } from "lucide-react";
import { Alert, Button, Field, Input } from "../../components/common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const schema = z
  .object({
    fullName: z.string().min(2, "Please enter your full name").max(80, "Name is too long"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    terms: z.literal(true, { message: "You must accept the terms to continue" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error, needsConfirmation: confirm } = await signUp({
      email: values.email.trim(),
      password: values.password,
      fullName: values.fullName.trim(),
    });
    if (error) {
      setFormError(error);
      return;
    }
    if (confirm) {
      setNeedsConfirmation(true);
      return;
    }
    toast.success("Account created", "Welcome to iWriter!");
    navigate("/writer", { replace: true });
  };

  if (needsConfirmation) {
    return (
      <div>
        <div className="iw-empty__icon" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={28} strokeWidth={2} />
        </div>
        <h1 className="iw-auth__title">Check your inbox</h1>
        <p className="iw-auth__desc">
          We sent a confirmation link to your email. Confirm your address to activate your iWriter writer
          account, then sign in.
        </p>
        <div className="iw-mt-6">
          <Link to="/login">
            <Button variant="primary" block size="lg">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="iw-auth__title">Create your writer account</h1>
      <p className="iw-auth__desc">Join iWriter to browse and claim academic assignments.</p>

      <form className="iw-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert tone="danger" icon={AlertCircle}>
            {formError}
          </Alert>
        )}

        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input id="fullName" placeholder="Jane Doe" autoComplete="name" icon={User} invalid={Boolean(errors.fullName)} {...register("fullName")} />
        </Field>

        <Field label="Email address" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" icon={Mail} invalid={Boolean(errors.email)} {...register("email")} />
        </Field>

        <Field label="Password" htmlFor="password" required hint="At least 8 characters with a number" error={errors.password?.message}>
          <Input id="password" type="password" placeholder="Create a password" autoComplete="new-password" icon={Lock} invalid={Boolean(errors.password)} {...register("password")} />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" placeholder="Repeat your password" autoComplete="new-password" icon={Lock} invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
        </Field>

        <div>
          <label className="iw-check">
            <input type="checkbox" {...register("terms")} />
            <span className="iw-check__text">
              I agree to the iWriter terms of service and privacy policy.
              {errors.terms && <span className="iw-field__error" style={{ display: "flex", marginTop: 4 }}>{errors.terms.message}</span>}
            </span>
          </label>
        </div>

        <Button type="submit" variant="primary" size="lg" block loading={isSubmitting} iconRight={ArrowRight}>
          Create account
        </Button>
      </form>

      <p className="iw-auth__foot">
        Already have an account?{" "}
        <Link to="/login" style={{ fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
