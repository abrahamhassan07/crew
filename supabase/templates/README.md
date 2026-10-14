# Branded auth emails

Three Supabase Auth emails, styled to match the app:

| File | Supabase template | Subject |
| --- | --- | --- |
| `confirmation.html` | Confirm sign up | Confirm your email to start with Crew & Grounds |
| `invite.html` | Invite user | You've been invited to join a team on Crew & Grounds |
| `recovery.html` | Reset password | Reset your Crew & Grounds password |

`supabase/config.toml` points at these files, so they apply locally.

## Production

Production doesn't read the files. In the Supabase dashboard open
Authentication > Emails > Templates, pick the template, paste the subject and
the full HTML, and save. Keep the `{{ .ConfirmationURL }}` placeholders.

Unlisted templates (magic link, change email, reauthentication) keep Supabase's
defaults; the app doesn't use them yet.
