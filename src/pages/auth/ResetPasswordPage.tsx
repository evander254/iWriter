import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Alert, Button, Field, Input } from "../../components/common";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { updatePassword, profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: "", confirmPassword: "" } });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error } = await updatePassword(values.password);
    if (error) {
      setFormError(error);
      return;
    }
    setDone(true);
    toast.success("Password updated", "You can now use your new password.");
    setTimeout(() => navigate(profile?.role === "admin" ? "/admin" : "/writer", { replace: true }), 1200);
  };

  if (done) {
    return (
      <div>
        <div className="iw-empty__icon" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={28} strokeWidth={2} />
        </div>
        <h1 className="iw-auth__title">Password updated</h1>
        <p className="iw-auth__desc">Your new password is active. Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="iw-auth__title">Choose a new password</h1>
      <p className="iw-auth__desc">Set a strong password to secure your iWriter account.</p>

      <form className="iw-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert tone="danger" icon={AlertCircle}>
            {formError}
          </Alert>
        )}

        <Field label="New password" htmlFor="password" required hint="At least 8 characters with a number" error={errors.password?.message}>
          <Input id="password" type="password" placeholder="New password" autoComplete="new-password" icon={Lock} invalid={Boolean(errors.password)} {...register("password")} />
        </Field>

        <Field label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" placeholder="Repeat new password" autoComplete="new-password" icon={Lock} invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
        </Field>

        <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
          Update password
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
