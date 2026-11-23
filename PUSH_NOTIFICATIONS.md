# Web push notification setup

Web push delivers system notifications while users are away from the app. It requires HTTPS (Vercel provides this), a browser/device that supports Push API, and one-time server configuration.

1. Generate a VAPID key pair with `npx web-push generate-vapid-keys`.
2. Set the public key as `VITE_VAPID_PUBLIC_KEY` in the local environment and Vercel, then redeploy the frontend.
3. Apply `supabase/migrations/0007_web_push_notifications.sql` to the Supabase project.
4. Deploy the sender and set its secrets (use the same random dispatch secret in both places):

   ```sh
   supabase secrets set VAPID_PUBLIC_KEY="<public-key>" VAPID_PRIVATE_KEY="<private-key>" VAPID_SUBJECT="mailto:admin@example.com" PUSH_DISPATCH_SECRET="<random-secret>"
   supabase functions deploy send-push --no-verify-jwt
   ```

5. In the Supabase SQL editor, store the project URL and the same dispatch secret in Vault:

   ```sql
   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'supabase_project_url');
   select vault.create_secret('<same-random-secret>', 'push_dispatch_secret');
   ```

6. Users enable **Device alerts** from Notifications on each device/browser. On iPhone/iPad, install the site to the Home Screen before enabling push, as required by iOS.

The sender removes expired device subscriptions automatically. Tapping a push opens the exact notification in the user's admin or writer notification center.
